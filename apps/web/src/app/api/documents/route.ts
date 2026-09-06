import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import pg from "pg";
import { blobNameForDocument, uploadDocumentBlob } from "@/lib/blob";
import { triggerProcessing } from "@/lib/processing";

function getCorrelationId(headers: Record<string, string | undefined>): string {
  const existing = headers["x-correlation-id"] ?? headers["x-request-id"];
  if (existing && existing.trim().length > 0) return existing;
  return crypto.randomUUID();
}

function createLogger(correlationId: string) {
  function log(level: "info" | "warn" | "error", message: string, meta?: Record<string, unknown>) {
    const payload = JSON.stringify({
      level,
      message,
      correlationId,
      timestamp: new Date().toISOString(),
      ...(meta ?? {}),
    });
    if (level === "error") console.error(payload);
    else if (level === "warn") console.warn(payload);
    else console.log(payload);
  }
  return {
    info: (message: string, meta?: Record<string, unknown>) => log("info", message, meta),
    warn: (message: string, meta?: Record<string, unknown>) => log("warn", message, meta),
    error: (message: string, meta?: Record<string, unknown>) => log("error", message, meta),
  };
}

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

function getCorrelation(req: NextRequest): string {
  const headers: Record<string, string | undefined> = {};
  req.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  return getCorrelationId(headers);
}

type DocumentRow = {
  id: number;
  file_name: string;
  document_type: string | null;
  measure_value: string | null;
  measure_date: string | null;
  classification: string | null;
  confidence_score: number | null;
  processing_status: string;
  error_message: string | null;
  created_at: Date;
  date_processed: Date | null;
};

let pool: pg.Pool | null = null;

function getPool(connectionString: string): pg.Pool {
  if (pool) return pool;
  pool = new pg.Pool({ connectionString });
  return pool;
}

export async function GET(req: NextRequest) {
  const correlationId = getCorrelation(req);
  const logger = createLogger(correlationId);

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten(), correlationId },
      { status: 400, headers: { "x-correlation-id": correlationId } }
    );
  }

  const { limit, offset } = parsed.data;

  if (!process.env.DATABASE_URL) {
    logger.info("documents.list.fallback_no_db", { reason: "DATABASE_URL missing" });
    return NextResponse.json(
      { documents: [], total: 0, limit, offset, correlationId },
      { headers: { "x-correlation-id": correlationId } }
    );
  }

  let client: pg.PoolClient | null = null;
  try {
    const p = getPool(process.env.DATABASE_URL);
    client = await p.connect();
    const result = await client.query<DocumentRow>(
      `SELECT id, file_name, document_type, measure_value, measure_date, classification, confidence_score, processing_status, error_message, created_at, date_processed
       FROM documents
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const mapped = result.rows.map((r) => ({
      id: String(r.id),
      fileName: r.file_name,
      status: r.processing_status,
      documentType: r.document_type,
      measureValue: r.measure_value,
      measureDate: r.measure_date,
      classification: r.classification,
      confidenceScore: r.confidence_score,
      errorMessage: r.error_message,
      createdAt: r.created_at.toISOString(),
      dateProcessed: r.date_processed ? r.date_processed.toISOString() : null,
    }));

    return NextResponse.json(
      { documents: mapped, total: mapped.length, limit, offset, correlationId },
      { headers: { "x-correlation-id": correlationId } }
    );
  } catch (err) {
    logger.error("documents.list.failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { documents: [], total: 0, limit, offset, correlationId },
      { headers: { "x-correlation-id": correlationId } }
    );
  } finally {
    if (client) client.release();
  }
}

export async function POST(req: NextRequest) {
  const correlationId = getCorrelation(req);
  const logger = createLogger(correlationId);

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Expected multipart/form-data", correlationId },
      { status: 400, headers: { "x-correlation-id": correlationId } }
    );
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "File is required", correlationId },
      { status: 400, headers: { "x-correlation-id": correlationId } }
    );
  }

  const fileSchema = z
    .instanceof(File)
    .refine((f) => f.size > 0, "File is empty")
    .refine((f) => f.size <= 10 * 1024 * 1024, "File too large (max 10MB)")
    .refine((f) => f.name.length <= 255, "File name too long")
    .refine((f) => f.name.toLowerCase().endsWith(".pdf"), "Only PDF files are accepted")
    .refine((f) => !f.type || f.type === "application/pdf", "Only PDF files are accepted");

  const parsedFile = fileSchema.safeParse(file);
  if (!parsedFile.success) {
    return NextResponse.json(
      { error: parsedFile.error.issues[0]?.message ?? "Invalid file", correlationId },
      { status: 400, headers: { "x-correlation-id": correlationId } }
    );
  }

  const databaseUrl = process.env.DATABASE_URL;
  const blobConnectionString = process.env.BLOB_CONNECTION_STRING;
  if (!databaseUrl || !blobConnectionString) {
    const missing = [
      !databaseUrl ? "DATABASE_URL" : null,
      !blobConnectionString ? "BLOB_CONNECTION_STRING" : null,
    ].filter((v): v is string => v !== null);
    logger.error("documents.upload.misconfigured", { missing });
    return NextResponse.json(
      { error: `Service unavailable (missing: ${missing.join(", ")})`, correlationId },
      { status: 503, headers: { "x-correlation-id": correlationId } }
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  let client: pg.PoolClient | null = null;
  let documentId: number | null = null;
  try {
    const p = getPool(databaseUrl);
    client = await p.connect();
    const result = await client.query<DocumentRow>(
      `INSERT INTO documents (file_name, processing_status)
       VALUES ($1, 'PROCESSING')
       RETURNING id, file_name, document_type, measure_value, measure_date, classification, confidence_score, processing_status, error_message, created_at, date_processed`,
      [file.name]
    );
    const inserted = result.rows[0];
    if (!inserted) throw new Error("Insert returned no rows");
    documentId = inserted.id;

    try {
      await uploadDocumentBlob(
        blobNameForDocument(inserted.id, file.name),
        bytes,
        "application/pdf"
      );
    } catch (uploadErr) {
      await client.query(
        `UPDATE documents SET processing_status = 'FAILED', error_message = $2 WHERE id = $1`,
        [inserted.id, "Blob upload failed"]
      );
      throw uploadErr;
    }

    logger.info("documents.upload.created", { documentId: String(inserted.id) });

    try {
      const target = await triggerProcessing(inserted.id, correlationId);
      if (target === "none") {
        logger.warn("documents.upload.noProcessingTarget", {
          documentId: String(inserted.id),
        });
      } else {
        logger.info("documents.upload.triggered", {
          documentId: String(inserted.id),
          target,
        });
      }
    } catch (triggerErr) {
      logger.warn("documents.upload.triggerPending", {
        documentId: String(inserted.id),
        error: triggerErr instanceof Error ? triggerErr.message : String(triggerErr),
      });
    }

    return NextResponse.json(
      {
        id: String(inserted.id),
        status: inserted.processing_status,
        fileName: inserted.file_name,
        correlationId,
      },
      { status: 201, headers: { "x-correlation-id": correlationId } }
    );
  } catch (err) {
    logger.error("documents.upload.failed", {
      error: err instanceof Error ? err.message : String(err),
      ...(documentId ? { documentId: String(documentId) } : {}),
    });
    return NextResponse.json(
      { error: "Failed to create document record", correlationId },
      { status: 500, headers: { "x-correlation-id": correlationId } }
    );
  } finally {
    if (client) client.release();
  }
}
