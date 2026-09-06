import { describe, it, expect, vi, beforeEach } from "vitest";

const queries: Array<{ text: string; params: unknown[] }> = [];

vi.mock("pg", () => {
  class FakeClient {
    async query(text: string, params?: unknown[]) {
      queries.push({ text, params: params ?? [] });
      if (text.includes("SELECT id")) {
        return { rows: [{ id: 5, fileName: "report.pdf", blobName: "5/report.pdf" }] };
      }
      return { rows: [] };
    }
    release() {}
  }
  class FakePool {
    async connect() {
      return new FakeClient();
    }
  }
  return { default: { Pool: FakePool } };
});

import { decideOutcome, runProcessing, toSafeReason } from "./process.js";

beforeEach(() => {
  queries.length = 0;
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  process.env.BLOB_CONNECTION_STRING = "test-connection-string";
  process.env.BLOB_CONTAINER_NAME = "documents";
  process.env.AI_API_KEY = "test-key";
  process.env.AI_MODEL = "test-model";
});

function successCandidates() {
  return {
    documentType: "BP" as const,
    bpReadings: [
      { systolic: 128, diastolic: 84, date: "2026-08-20", isGoal: false, isHistorical: false },
    ],
    hba1cValues: [],
    patientAgeYears: 45 as number | null,
  };
}

function successOverrides() {
  return {
    downloadBlob: async () => Buffer.from("%PDF-1.4 fake"),
    extractText: async () => "Blood pressure 128/84 measured on 2026-08-20.",
    extractAi: async () => successCandidates(),
  };
}

describe("reprocessing idempotency", () => {
  it("produces the same authoritative outcome on repeated runs", () => {
    const first = decideOutcome(successCandidates(), false);
    const second = decideOutcome(successCandidates(), false);
    expect(second).toEqual(first);
    expect(first.status).toBe("SUCCESS");
  });

  it("reprocessing the same documentId updates instead of inserting", async () => {
    await runProcessing(5, "corr-1", successOverrides());
    await runProcessing(5, "corr-1", successOverrides());
    const updates = queries.filter((q) => q.text.includes("UPDATE documents"));
    const inserts = queries.filter((q) => q.text.includes("INSERT INTO documents"));
    expect(inserts).toHaveLength(0);
    expect(updates).toHaveLength(2);
    for (const update of updates) {
      expect(update.params[0]).toBe(5);
    }
  });

  it("a retry targets the same blob name for the same document", async () => {
    await runProcessing(5, "corr-2", successOverrides());
    const outcomeUpdate = queries.find((q) => q.text.includes("UPDATE documents"));
    expect(outcomeUpdate?.params).toContain("5/report.pdf");
  });
});

describe("failure handling", () => {
  it("marks the same document FAILED without inserting when AI fails", async () => {
    await expect(
      runProcessing(5, "corr-3", {
        ...successOverrides(),
        extractAi: async () => {
          throw new Error("AI request failed: timeout");
        },
      })
    ).rejects.toThrow();
    const failedUpdates = queries.filter((q) => q.text.includes("processing_status = 'FAILED'"));
    expect(failedUpdates).toHaveLength(1);
    expect(failedUpdates[0]?.params[0]).toBe(5);
    const inserts = queries.filter((q) => q.text.includes("INSERT INTO documents"));
    expect(inserts).toHaveLength(0);
  });

  it("maps failures to safe reasons without clinical payloads", () => {
    expect(toSafeReason(new Error("Document 9 not found"))).toBe("Document not found");
    expect(toSafeReason(new Error("AI request failed: 500"))).toBe("AI request failed");
    const reason = toSafeReason(new Error("weird 128/84 HbA1c 6.4% boom"));
    expect(reason).toBe("Processing failed");
    expect(reason).not.toContain("128/84");
    expect(reason).not.toContain("6.4");
  });

  it("marks the same document FAILED instead of stuck PROCESSING when AI is unconfigured", async () => {
    delete process.env.AI_API_KEY;
    await expect(runProcessing(5, "corr-no-key", successOverrides())).rejects.toThrow(
      "AI_API_KEY is required"
    );
    const failedUpdates = queries.filter((q) => q.text.includes("processing_status = 'FAILED'"));
    expect(failedUpdates).toHaveLength(1);
    expect(failedUpdates[0]?.params[0]).toBe(5);
    expect(failedUpdates[0]?.params[2]).toBe("AI request failed");
  });
});
