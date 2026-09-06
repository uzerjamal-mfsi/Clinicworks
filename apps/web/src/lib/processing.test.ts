import { describe, expect, it, vi, afterEach } from "vitest";
import {
  canRetry,
  isFinalStatus,
  isStaleProcessing,
  retryDocument,
  triggerFunction,
  triggerLogicApp,
  triggerProcessing,
} from "./processing";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.LOGIC_APP_WEBHOOK_URL;
  delete process.env.FUNCTION_PROCESS_DOCUMENT_URL;
});

describe("logic app trigger", () => {
  it("skips when no webhook is configured", async () => {
    await expect(triggerLogicApp(1, "corr")).resolves.toBe(false);
  });

  it("posts document id with correlation id", async () => {
    process.env.LOGIC_APP_WEBHOOK_URL = "https://logic.test/trigger";
    const fetchMock = vi.fn(async () => ({ ok: true }) as Response);
    vi.stubGlobal("fetch", fetchMock);
    await expect(triggerLogicApp(42, "corr-1")).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://logic.test/trigger",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ documentId: 42 }),
      })
    );
  });

  it("reuses the same document id on retry triggers", async () => {
    process.env.LOGIC_APP_WEBHOOK_URL = "https://logic.test/trigger";
    const seen: Array<{ url: unknown; options: unknown }> = [];
    const fetchMock = vi.fn(async (url: unknown, options: unknown) => {
      seen.push({ url, options });
      return { ok: true } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    await triggerLogicApp(7, "corr-retry");
    await triggerLogicApp(7, "corr-retry-2");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(seen).toHaveLength(2);
    for (const call of seen) {
      expect(call.url).toBe("https://logic.test/trigger");
      expect(call.options).toMatchObject({
        method: "POST",
        body: JSON.stringify({ documentId: 7 }),
      });
    }
  });
});

describe("final statuses", () => {
  it("treats success, needs-review, and failed as final", () => {
    expect(isFinalStatus("SUCCESS")).toBe(true);
    expect(isFinalStatus("NEEDS_REVIEW")).toBe(true);
    expect(isFinalStatus("FAILED")).toBe(true);
  });

  it("treats processing as non-final", () => {
    expect(isFinalStatus("PROCESSING")).toBe(false);
  });
});

describe("retry eligibility", () => {
  it("allows retry for failed and needs-review", () => {
    expect(canRetry("FAILED")).toBe(true);
    expect(canRetry("NEEDS_REVIEW")).toBe(true);
  });

  it("blocks retry for success and fresh processing", () => {
    expect(canRetry("SUCCESS")).toBe(false);
    expect(canRetry("PROCESSING", new Date().toISOString(), new Date())).toBe(false);
  });

  it("allows retry for stale processing so the UI never sticks", () => {
    const old = new Date(Date.now() - 11 * 60 * 1000).toISOString();
    expect(canRetry("PROCESSING", old, new Date())).toBe(true);
    expect(isStaleProcessing("PROCESSING", old, new Date())).toBe(true);
  });

  it("ignores unparseable processing timestamps", () => {
    expect(canRetry("PROCESSING", "not-a-date", new Date())).toBe(false);
  });
});

describe("processing target selection", () => {
  it("prefers the logic app when a webhook is configured", async () => {
    process.env.LOGIC_APP_WEBHOOK_URL = "https://logic.test/trigger";
    process.env.FUNCTION_PROCESS_DOCUMENT_URL = "http://function:7071/api/process-document";
    const fetchMock = vi.fn(async () => ({ ok: true }) as Response);
    vi.stubGlobal("fetch", fetchMock);
    await expect(triggerProcessing(11, "corr-webhook")).resolves.toBe("logic-app");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://logic.test/trigger",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ documentId: 11 }),
      })
    );
  });

  it("calls the function directly with the same document when no webhook is set", async () => {
    process.env.FUNCTION_PROCESS_DOCUMENT_URL = "http://function:7071/api/process-document";
    const fetchMock = vi.fn(async () => ({ ok: true }) as Response);
    vi.stubGlobal("fetch", fetchMock);
    await expect(triggerProcessing(12, "corr-direct")).resolves.toBe("function");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://function:7071/api/process-document",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ documentId: 12 }),
      })
    );
  });

  it("reports none when neither target is configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(triggerProcessing(13, "corr-none")).resolves.toBe("none");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips the direct function call when no function url is configured", async () => {
    await expect(triggerFunction(1, "corr")).resolves.toBe(false);
  });

  it("surfaces direct function failures", async () => {
    process.env.FUNCTION_PROCESS_DOCUMENT_URL = "http://function:7071/api/process-document";
    const fetchMock = vi.fn(async () => ({ ok: false, status: 500 }) as Response);
    vi.stubGlobal("fetch", fetchMock);
    await expect(triggerFunction(4, "corr")).rejects.toThrow(
      "Function trigger failed with status 500"
    );
  });
});

describe("retryDocument", () => {
  it("posts to the same document retry endpoint", async () => {
    const fetchMock = vi.fn(
      async () => ({ ok: true, json: async () => ({ id: "9", status: "PROCESSING" }) }) as Response
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(retryDocument("9")).resolves.toEqual({ id: "9", status: "PROCESSING" });
    expect(fetchMock).toHaveBeenCalledWith("/api/documents/9/retry", { method: "POST" });
  });

  it("rejects invalid ids without a network call", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(retryDocument("abc")).rejects.toThrow("Invalid document id");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces retry failures", async () => {
    const fetchMock = vi.fn(
      async () => ({ ok: false, status: 500, json: async () => ({ error: "boom" }) }) as Response
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(retryDocument("3")).rejects.toThrow("boom");
  });
});
