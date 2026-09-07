import { NextRequest, NextResponse } from "next/server";
import pg from "pg";

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

let pool: pg.Pool | null = null;

function getPool(connectionString: string): pg.Pool {
  if (pool) return pool;
  pool = new pg.Pool({ connectionString });
  return pool;
}

type CheckState = "ok" | "not_configured" | "error";

async function checkDatabase(connectionString: string | undefined): Promise<CheckState> {
  if (!connectionString) return "not_configured";
  let client: pg.PoolClient | null = null;
  try {
    client = await getPool(connectionString).connect();
    await client.query("SELECT 1");
    return "ok";
  } catch {
    return "error";
  } finally {
    if (client) client.release();
  }
}

function checkConfigured(value: string | undefined): CheckState {
  return value && value.trim().length > 0 ? "ok" : "not_configured";
}

export async function GET(req: NextRequest) {
  const correlationId = getCorrelation(req);
  const logger = createLogger(correlationId);

  const database = await checkDatabase(process.env.DATABASE_URL);
  const blob = checkConfigured(process.env.BLOB_CONNECTION_STRING);
  const ai = checkConfigured(process.env.AI_API_KEY);

  const status =
    database === "error" ? "error" : database === "ok" && blob === "ok" ? "ok" : "degraded";

  if (status === "error") {
    logger.error("health.error", { database, blob, ai });
  } else if (status === "degraded") {
    logger.warn("health.degraded", { database, blob, ai });
  } else {
    logger.info("health.ok", { database, blob, ai });
  }

  return NextResponse.json(
    { status, checks: { database, blob, ai }, correlationId },
    {
      status: status === "error" ? 503 : 200,
      headers: { "x-correlation-id": correlationId },
    }
  );
}
