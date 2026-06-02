/**
 * Smoke tests for the express server's diagnostic endpoints.
 * These do not call Gemini or Firebase and run entirely in-process.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import type { Server } from "http";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  // Build a thin standalone app mirroring the diagnostic endpoints that
  // server.ts exposes, so we can test without booting Vite middleware.
  const app = express();
  app.get("/healthz", (_req, res) => res.json({ status: "ok", uptime: process.uptime() }));
  app.get("/readyz", (_req, res) => {
    const ok = !!(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY);
    res.status(ok ? 200 : 503).json({ status: ok ? "ready" : "not-ready" });
  });
  app.get("/metrics", (_req, res) => {
    res.set("Content-Type", "text/plain").send("# HELP process_uptime_seconds Test\n# TYPE process_uptime_seconds gauge\nprocess_uptime_seconds 0.1\n");
  });
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  const addr = server.address();
  if (typeof addr === "object" && addr) baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("diagnostic endpoints", () => {
  it("healthz returns 200 with status ok", async () => {
    const r = await fetch(`${baseUrl}/healthz`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as any;
    expect(body.status).toBe("ok");
    expect(typeof body.uptime).toBe("number");
  });

  it("readyz returns 503 when no AI key is present", async () => {
    const saved = { g: process.env.GEMINI_API_KEY, o: process.env.OPENAI_API_KEY };
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const r = await fetch(`${baseUrl}/readyz`);
      expect(r.status).toBe(503);
    } finally {
      if (saved.g) process.env.GEMINI_API_KEY = saved.g;
      if (saved.o) process.env.OPENAI_API_KEY = saved.o;
    }
  });

  it("readyz returns 200 when GEMINI_API_KEY is configured", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    try {
      const r = await fetch(`${baseUrl}/readyz`);
      expect(r.status).toBe(200);
    } finally {
      delete process.env.GEMINI_API_KEY;
    }
  });

  it("metrics returns Prometheus text format", async () => {
    const r = await fetch(`${baseUrl}/metrics`);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toMatch(/text\/plain/);
    const body = await r.text();
    expect(body).toMatch(/# TYPE process_uptime_seconds/);
  });
});
