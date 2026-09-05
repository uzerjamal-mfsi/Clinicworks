import { describe, expect, it, vi, afterEach } from "vitest";
import { triggerLogicApp } from "./processing";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.LOGIC_APP_WEBHOOK_URL;
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
});
