import pg from "pg";
import { createLogger, type Logger } from "@clinicworks/shared";
import { resolveAiConfig, extractCandidates, type AiCandidates, type DocumentInput } from "./ai.js";
import { extractPdfText, needsOcr } from "./pdf.js";
import { blobNameForDocument, downloadDocumentBlob } from "./blob.js";
import {
  selectBpReading,
  selectHba1cValue,
  classifyHba1c,
  isBpUnderage,
  isValidDate,
  scoreConfidence,
  type BpReading,
  type Hba1cValue,
} from "./rules.js";
import { getEnv } from "./env.js";

export type FinalStatus = "SUCCESS" | "NEEDS_REVIEW" | "FAILED";
export type FinalDocumentType = "BP" | "HBA1C" | "UNKNOWN";

export interface Outcome {
  status: FinalStatus;
  documentType: FinalDocumentType;
  measureValue: string | null;
  measureDate: string | null;
  classification: string | null;
  confidenceScore: number;
}

export function decideOutcome(candidates: AiCandidates, usedPdf: boolean): Outcome {
  const bpReadings: BpReading[] = candidates.bpReadings.map((reading) => ({
    systolic: Number(reading.systolic),
    diastolic: Number(reading.diastolic),
    date: isValidDate(reading.date ?? null) ? String(reading.date) : null,
    isGoal: Boolean(reading.isGoal),
    isHistorical: Boolean(reading.isHistorical),
  }));
  const hba1cValues: Hba1cValue[] = candidates.hba1cValues.map((entry) => ({
    value: Number(entry.value),
    date: isValidDate(entry.date ?? null) ? String(entry.date) : null,
    isGoal: Boolean(entry.isGoal),
    isHistorical: Boolean(entry.isHistorical),
    isReferenceRange: Boolean(entry.isReferenceRange),
  }));
  const candidateCount = bpReadings.length + hba1cValues.length;
  const hint = candidates.documentType;

  if (hint !== "HBA1C") {
    if (isBpUnderage(candidates.patientAgeYears ?? null)) {
      return {
        status: "NEEDS_REVIEW",
        documentType: "BP",
        measureValue: null,
        measureDate: null,
        classification: null,
        confidenceScore: 0.4,
      };
    }
    const selected = selectBpReading(bpReadings, candidates.patientAgeYears ?? null);
    if (selected) {
      const hasDate = isValidDate(selected.date);
      return {
        status: "SUCCESS",
        documentType: "BP",
        measureValue: `${selected.systolic}/${selected.diastolic}`,
        measureDate: hasDate ? String(selected.date) : null,
        classification: null,
        confidenceScore: scoreConfidence({ hasDate, candidateCount, usedPdf }),
      };
    }
  }

  if (hint !== "BP") {
    const selected = selectHba1cValue(hba1cValues);
    if (selected) {
      const hasDate = isValidDate(selected.date);
      return {
        status: "SUCCESS",
        documentType: "HBA1C",
        measureValue: String(selected.value),
        measureDate: hasDate ? String(selected.date) : null,
        classification: classifyHba1c(selected.value),
        confidenceScore: scoreConfidence({ hasDate, candidateCount, usedPdf }),
      };
    }
  }

  if (hint === "BP" || hint === "HBA1C") {
    return {
      status: "NEEDS_REVIEW",
      documentType: hint,
      measureValue: null,
      measureDate: null,
      classification: null,
      confidenceScore: scoreConfidence({ hasDate: false, candidateCount, usedPdf }),
    };
  }

  const fallbackBp = selectBpReading(bpReadings, candidates.patientAgeYears ?? null);
  if (fallbackBp) {
    const hasDate = isValidDate(fallbackBp.date);
    return {
      status: "SUCCESS",
      documentType: "BP",
      measureValue: `${fallbackBp.systolic}/${fallbackBp.diastolic}`,
      measureDate: hasDate ? String(fallbackBp.date) : null,
      classification: null,
      confidenceScore: scoreConfidence({ hasDate, candidateCount, usedPdf }),
    };
  }
  const fallbackA1c = selectHba1cValue(hba1cValues);
  if (fallbackA1c) {
    const hasDate = isValidDate(fallbackA1c.date);
    return {
      status: "SUCCESS",
      documentType: "HBA1C",
      measureValue: String(fallbackA1c.value),
      measureDate: hasDate ? String(fallbackA1c.date) : null,
      classification: classifyHba1c(fallbackA1c.value),
      confidenceScore: scoreConfidence({ hasDate, candidateCount, usedPdf }),
    };
  }

  return {
    status: "NEEDS_REVIEW",
    documentType: "UNKNOWN",
    measureValue: null,
    measureDate: null,
    classification: null,
    confidenceScore: scoreConfidence({ hasDate: false, candidateCount, usedPdf }),
  };
}

interface DocumentRef {
  id: number;
  fileName: string;
  blobName: string | null;
}

let pool: pg.Pool | null = null;

function getPool(databaseUrl: string): pg.Pool {
  if (pool) return pool;
  pool = new pg.Pool({ connectionString: databaseUrl });
  return pool;
}

export async function saveOutcome(
  databaseUrl: string,
  id: number,
  outcome: Outcome,
  blobName: string,
  errorMessage: string | null = null
): Promise<void> {
  const client = await getPool(databaseUrl).connect();
  try {
    await client.query(
      `UPDATE documents
       SET blob_name = $2,
           document_type = $3,
           measure_value = $4,
           measure_date = $5,
           classification = $6,
           confidence_score = $7,
           processing_status = $8,
           error_message = $9,
           date_processed = NOW()
       WHERE id = $1`,
      [
        id,
        blobName,
        outcome.documentType,
        outcome.measureValue,
        outcome.measureDate,
        outcome.classification,
        outcome.confidenceScore,
        outcome.status,
        errorMessage,
      ]
    );
  } finally {
    client.release();
  }
}

export async function markFailed(
  databaseUrl: string,
  id: number,
  blobName: string | null,
  message: string
): Promise<void> {
  const client = await getPool(databaseUrl).connect();
  try {
    await client.query(
      `UPDATE documents
       SET blob_name = COALESCE($2, blob_name),
           processing_status = 'FAILED',
           error_message = $3,
           date_processed = NOW()
       WHERE id = $1`,
      [id, blobName, message]
    );
  } finally {
    client.release();
  }
}

export interface ProcessOverrides {
  downloadBlob?: (blobName: string) => Promise<Buffer>;
  extractText?: (pdf: Buffer) => Promise<string>;
  extractAi?: (input: DocumentInput) => Promise<AiCandidates>;
}

export function toSafeReason(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/not found/i.test(message)) return "Document not found";
  if (/AI request failed|AI response|AI_API_KEY/i.test(message)) return "AI request failed";
  if (/download|Blob/i.test(message)) return "Blob download failed";
  return "Processing failed";
}

export async function resolveDocumentInput(
  pdf: Buffer,
  extractText: (pdf: Buffer) => Promise<string>
): Promise<DocumentInput> {
  let text = "";
  try {
    text = await extractText(pdf);
  } catch {
    text = "";
  }
  if (!needsOcr(text)) return { kind: "text", text };
  return { kind: "pdf", pdfBase64: pdf.toString("base64") };
}

export async function runProcessing(
  documentId: number,
  correlationId: string,
  overrides: ProcessOverrides = {}
): Promise<Outcome & { documentId: number }> {
  const env = getEnv();
  const logger: Logger = createLogger(correlationId);
  const databaseUrl = env.DATABASE_URL;
  const containerName = env.BLOB_CONTAINER_NAME ?? "documents";

  const client = await getPool(databaseUrl).connect();
  let ref: DocumentRef | null = null;
  try {
    const result = await client.query<DocumentRef>(
      `SELECT id, file_name AS "fileName", blob_name AS "blobName" FROM documents WHERE id = $1`,
      [documentId]
    );
    ref = result.rows[0] ?? null;
  } finally {
    client.release();
  }
  if (!ref) throw new Error(`Document ${documentId} not found`);

  const blobName = ref.blobName ?? blobNameForDocument(ref.id, ref.fileName);

  try {
    const aiConfig = resolveAiConfig({
      AI_API_KEY: env.AI_API_KEY,
      AI_MODEL: env.AI_MODEL,
      AI_API_URL: env.AI_API_URL,
    });
    const downloadBlob =
      overrides.downloadBlob ??
      ((name: string) => downloadDocumentBlob(name, env.BLOB_CONNECTION_STRING, containerName));
    const pdf = await downloadBlob(blobName);
    logger.info("blob.downloaded", { blobName });
    const extractText = overrides.extractText ?? extractPdfText;
    const input = await resolveDocumentInput(pdf, extractText);
    logger.info("documentInput.resolved", { kind: input.kind });

    const extractAi =
      overrides.extractAi ?? ((document: DocumentInput) => extractCandidates(document, aiConfig));
    const candidates = await extractAi(input);
    const outcome = decideOutcome(candidates, input.kind === "pdf");
    await saveOutcome(databaseUrl, ref.id, outcome, blobName);
    logger.info("process.completed", { documentId: String(ref.id), status: outcome.status });
    return { ...outcome, documentId: ref.id };
  } catch (error) {
    const reason = toSafeReason(error);
    const message = error instanceof Error ? error.message : "Processing failed";
    try {
      if (ref && blobName) {
        await markFailed(databaseUrl, ref.id, blobName, reason);
      }
    } catch {
      logger.error("process.markFailed.failed", { documentId: String(ref?.id ?? documentId) });
    }
    logger.error("process.failed", {
      documentId: String(documentId),
      error: message,
      stack: (error as Error).stack,
    });
    throw error;
  }
}
