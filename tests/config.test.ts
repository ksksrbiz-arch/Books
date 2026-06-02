/**
 * Unit tests for the centralised config + helper modules added during the
 * AI-Studio decoupling refactor.
 */
import { describe, it, expect } from "vitest";
import { MODEL_IDS } from "../config/models";
import { logger } from "../src/lib/logger";

describe("config/models", () => {
  it("exposes a stable model identifier set", () => {
    expect(MODEL_IDS.TEXT_PRIMARY_MODEL).toBeTruthy();
    expect(MODEL_IDS.TEXT_FALLBACK_MODEL).toBeTruthy();
    expect(MODEL_IDS.IMAGE_PRIMARY_MODEL).toBeTruthy();
    expect(MODEL_IDS.OPENAI_FALLBACK_MODEL).toBeTruthy();
  });

  it("primary and fallback text models are distinct so quota fallback is meaningful", () => {
    expect(MODEL_IDS.TEXT_PRIMARY_MODEL).not.toBe(MODEL_IDS.TEXT_FALLBACK_MODEL);
  });
});

describe("logger", () => {
  it("exposes the standard log methods", () => {
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.child).toBe("function");
  });

  it("can create child loggers without throwing", () => {
    const child = logger.child({ component: "test" });
    expect(typeof child.info).toBe("function");
  });
});
