import { describe, it, expect, vi } from "vitest";
import { createLogger, getCorrelationId } from "./logger.js";

describe("logger", () => {
  it("logs with correlationId and redacts sensitive keys", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = createLogger("test-id-123");
    logger.info("hello", { foo: "bar", apiKey: "secret123" });
    expect(spy).toHaveBeenCalledOnce();
    const payload = JSON.parse(spy.mock.calls[0]?.[0] as string);
    expect(payload.correlationId).toBe("test-id-123");
    expect(payload.message).toBe("hello");
    expect(payload.foo).toBe("bar");
    expect(payload.apiKey).toBe("[REDACTED]");
    spy.mockRestore();
  });

  it("getCorrelationId returns existing or generates", () => {
    expect(getCorrelationId({ "x-correlation-id": "abc" })).toBe("abc");
    const generated = getCorrelationId({});
    expect(generated).toHaveLength(36);
  });
});
