import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import pg from "pg";
import { triggerLogicApp } from "@/lib/processing";

function getCorrelation(req: NextRequest): string {
  const existing = req.headers.get("x-correlation-id") ?? req.headers.get("x-request-id") ?? "";
  if (existing.trim().length > 0) return existing;
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

const paramsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

let pool: pg.Pool | null = null;

function getPool(connectionString: string): pg.Pool {
  if (pool) return pool;
  pool = new pg.Pool({ connectionString });
  return pool;
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const correlationId = getCorrelation(req);
  const logger = createLogger(correlationId);
  const parsed = paramsSchema.safeParse({ id: (await context.params).id });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid document id", correlationId },
      { status: 400, headers: { "x-correlation-id": correlationId } }
    );
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "Service unavailable (missing: DATABASE_URL)", correlationId },
      { status: 503, headers: { "x-correlation-id": correlationId } }
    );
  }

  let client: pg.PoolClient | null = null;
  try {
    const p = getPool(process.env.DATABASE_URL);
    client = await p.connect();
    const result = await client.query(
      `UPDATE documents
       SET processing_status = 'PROCESSING', error_message = NULL, date_processed = NULL
       WHERE id = $1
       RETURNING id`,
      [parsed.data.id]
    );
    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Document not found", correlationId },
        { status: 404, headers: { "x-correlation-id": correlationId } }
      );
    }
    logger.info("documents.retry.queued", { documentId: String(parsed.data.id) });
  } catch (err) {
    logger.error("documents.retry.failed", {
      error: err instanceof Error ? err.message : String(err),
      documentId: String(parsed.data.id),
    });
    return NextResponse.json(
      { error: "Failed to retry document", correlationId },
      { status: 500, headers: { "x-correlation-id": correlationId } }
    );
  } finally {
    if (client) client.release();
  }

  try {
    await triggerLogicApp(parsed.data.id, correlationId);
  } catch (triggerErr) {
    logger.warn("documents.retry.triggerPending", {
      documentId: String(parsed.data.id),
      error: triggerErr instanceof Error ? triggerErr.message : String(triggerErr),
    });
  }

  return NextResponse.json(
    { id: String(parsed.data.id), status: "PROCESSING", correlationId },
    { headers: { "x-correlation-id": correlationId } }
  );
}
