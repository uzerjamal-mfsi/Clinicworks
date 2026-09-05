import { describe, it, expect } from "vitest";
import { resolveDocumentInput, decideOutcome } from "./process.js";
import type { AiCandidates, DocumentInput } from "./ai.js";

const scannedPdf = Buffer.from("%PDF-1.4 scanned-bytes");

function candidatesFor(kind: "BP" | "HBA1C", value = 6.4): AiCandidates {
  if (kind === "BP") {
    return {
      documentType: "BP",
      bpReadings: [
        { systolic: 128, diastolic: 84, date: "2026-08-20", isGoal: false, isHistorical: false },
      ],
      hba1cValues: [],
      patientAgeYears: 45,
    };
  }
  return {
    documentType: "HBA1C",
    bpReadings: [],
    hba1cValues: [
      {
        value,
        date: "2026-08-20",
        isGoal: false,
        isHistorical: false,
        isReferenceRange: false,
      },
    ],
    patientAgeYears: null,
  };
}

async function runCase(
  kind: "BP" | "HBA1C",
  pdf: Buffer,
  extracted: string,
  value = 6.4
): Promise<{ outcome: ReturnType<typeof decideOutcome>; input: DocumentInput }> {
  const input = await resolveDocumentInput(pdf, async () => extracted);
  const outcome = decideOutcome(candidatesFor(kind, value), input.kind === "pdf");
  return { outcome, input };
}

describe("document processing pipeline", () => {
  it("processes selectable-text BP PDF as text", async () => {
    const { outcome, input } = await runCase(
      "BP",
      scannedPdf,
      "Blood pressure 128/84 measured on 2026-08-20."
    );
    expect(input).toEqual({ kind: "text", text: "Blood pressure 128/84 measured on 2026-08-20." });
    expect(outcome.status).toBe("SUCCESS");
    expect(outcome.measureValue).toBe("128/84");
  });

  it("processes selectable-text HbA1c PDF as text", async () => {
    const { outcome, input } = await runCase("HBA1C", scannedPdf, "HbA1c 6.4% dated 2026-08-20.");
    expect(input.kind).toBe("text");
    expect(outcome.status).toBe("SUCCESS");
    expect(outcome.classification).toBe("Diabetes");
  });

  it("processes scanned BP PDF using the original PDF bytes", async () => {
    const { outcome, input } = await runCase("BP", scannedPdf, "");
    expect(input).toEqual({ kind: "pdf", pdfBase64: scannedPdf.toString("base64") });
    expect(outcome.status).toBe("SUCCESS");
    expect(outcome.documentType).toBe("BP");
  });

  it("processes scanned HbA1c PDF using the original PDF bytes", async () => {
    const { outcome, input } = await runCase("HBA1C", scannedPdf, "", 5.8);
    expect(input.kind).toBe("pdf");
    expect(outcome.status).toBe("SUCCESS");
    expect(outcome.classification).toBe("Prediabetes");
  });

  it("sends empty extraction failures to Gemini as PDF, never as empty text", async () => {
    const input = await resolveDocumentInput(scannedPdf, async () => {
      throw new Error("pdf-parse failed");
    });
    expect(input.kind).toBe("pdf");
  });
});
