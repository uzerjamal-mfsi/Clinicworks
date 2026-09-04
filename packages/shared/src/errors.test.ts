import { describe, it, expect } from "vitest";
import { AppError, badRequest, toErrorResponse } from "./errors.js";

describe("errors", () => {
  it("creates AppError with correct fields", () => {
    const err = badRequest("invalid", "cid-1");
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("BAD_REQUEST");
    expect(err.correlationId).toBe("cid-1");
  });

  it("toErrorResponse maps AppError", () => {
    const err = badRequest("oops", "cid-2");
    const res = toErrorResponse(err);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("oops");
    expect(res.body.correlationId).toBe("cid-2");
  });

  it("toErrorResponse maps generic error", () => {
    const res = toErrorResponse(new Error("boom"), "cid-3");
    expect(res.status).toBe(500);
    expect(res.body.correlationId).toBe("cid-3");
  });
});
