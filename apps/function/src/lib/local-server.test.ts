import { describe, it, expect, afterEach } from "vitest";
import type { Server } from "node:http";
import { startLocalServer } from "../local-server.js";

let server: Server | null = null;

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    server = null;
  }
});

async function listen() {
  server = startLocalServer(0);
  await new Promise<void>((resolve) => server?.once("listening", () => resolve()));
  const address = server?.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return `http://127.0.0.1:${port}`;
}

describe("local function server", () => {
  it("answers health checks", async () => {
    const base = await listen();
    const response = await fetch(`${base}/api/health`);
    expect(response.status).toBe(200);
    const json = (await response.json()) as { status?: string };
    expect(json.status).toBe("ok");
  });

  it("routes process-document and validates the body before touching dependencies", async () => {
    const base = await listen();
    const response = await fetch(`${base}/api/process-document`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-correlation-id": "corr-local-test" },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(400);
    const json = (await response.json()) as { error?: string; correlationId?: string };
    expect(json.error).toBe("documentId is required");
    expect(json.correlationId).toBe("corr-local-test");
  });

  it("rejects unknown routes and wrong methods", async () => {
    const base = await listen();
    const missing = await fetch(`${base}/api/unknown`);
    expect(missing.status).toBe(404);
    const wrongMethod = await fetch(`${base}/api/health`, { method: "POST" });
    expect(wrongMethod.status).toBe(405);
  });
});
