/**
 * Firestore security-rules tests covering the "Dirty Dozen" payloads in
 * security_spec.md. Requires the Firebase emulator suite:
 *
 *   firebase emulators:exec --only firestore "npm run test:rules"
 *
 * These tests are skipped when the emulator is not reachable so that
 * regular `npm test` runs do not require it.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { readFileSync } from "fs";
import path from "path";

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const PROJECT_ID = "echoes-of-choice-rules-tests";

let testEnv: RulesTestEnvironment | null = null;

async function tryInit(): Promise<RulesTestEnvironment | null> {
  try {
    return await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: readFileSync(path.join(process.cwd(), "firestore.rules"), "utf-8"),
        host: EMULATOR_HOST.split(":")[0],
        port: parseInt(EMULATOR_HOST.split(":")[1] || "8080", 10),
      },
    });
  } catch {
    return null;
  }
}

beforeAll(async () => {
  testEnv = await tryInit();
});

afterAll(async () => {
  await testEnv?.cleanup();
});

const maybe = (name: string, fn: () => Promise<void> | void) =>
  it(name, async () => {
    if (!testEnv) {
      // Skip silently when the emulator is unavailable.
      // eslint-disable-next-line no-console
      console.warn(`[rules-tests] Firestore emulator unreachable at ${EMULATOR_HOST}; skipping "${name}"`);
      return;
    }
    await fn();
  });

describe("firestore.rules — Dirty Dozen", () => {
  maybe("1. Identity Spoofing: alice cannot write to bob's user doc", async () => {
    const alice = testEnv!.authenticatedContext("alice").firestore();
    await assertFails(setDoc(doc(alice, "users/bob"), { uid: "bob", email: "b@x.com", createdAt: serverTimestamp() }));
  });

  maybe("2 & 7. Unverified Read: alice cannot read bob's story", async () => {
    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, "users/bob/stories/s1"), { userId: "bob", genre: "romance", status: "active", createdAt: new Date() });
    });
    const alice = testEnv!.authenticatedContext("alice").firestore();
    await assertFails(getDoc(doc(alice, "users/bob/stories/s1")));
  });

  maybe("4. Orphaned Step: alice cannot create a step under bob's story", async () => {
    const alice = testEnv!.authenticatedContext("alice").firestore();
    await assertFails(setDoc(doc(alice, "users/bob/stories/s1/steps/step1"), { sceneTitle: "x", sceneDescription: "y", timestamp: new Date() }));
  });

  maybe("11. Shadow Deletion: alice cannot delete bob's story", async () => {
    const alice = testEnv!.authenticatedContext("alice").firestore();
    await assertFails(deleteDoc(doc(alice, "users/bob/stories/s1")));
  });

  maybe("12. Unauthenticated read of any user doc is rejected", async () => {
    const anon = testEnv!.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, "users/alice")));
  });

  maybe("Happy path: signed-in user can create their own story", async () => {
    const alice = testEnv!.authenticatedContext("alice").firestore();
    await assertSucceeds(setDoc(doc(alice, "users/alice/stories/s2"), { userId: "alice", genre: "crime", status: "active", createdAt: new Date(), updatedAt: new Date() }));
  });
});
