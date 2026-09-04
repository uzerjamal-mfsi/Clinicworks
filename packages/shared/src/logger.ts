type LogLevel = "info" | "warn" | "error";

const SENSITIVE_KEYS = new Set([
  "password",
  "apikey",
  "api_key",
  "secret",
  "token",
  "authorization",
  "document",
  "content",
  "extracted",
]);

function redactValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEYS.has(key.toLowerCase())) {
    return "[REDACTED]";
  }
  return value;
}

function sanitize(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = redactValue(k, v);
  }
  return out;
}

export interface Logger {
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
}

export function createLogger(correlationId: string): Logger {
  function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
    const payload = {
      level,
      message,
      correlationId,
      timestamp: new Date().toISOString(),
      ...(meta ? sanitize(meta) : {}),
    };
    const line = JSON.stringify(payload);
    if (level === "error") {
      console.error(line);
    } else if (level === "warn") {
      console.warn(line);
    } else {
      console.log(line);
    }
  }

  return {
    info: (message, meta) => log("info", message, meta),
    warn: (message, meta) => log("warn", message, meta),
    error: (message, meta) => log("error", message, meta),
  };
}

export function getCorrelationId(headers: Record<string, string | undefined>): string {
  const existing = headers["x-correlation-id"] ?? headers["x-request-id"];
  if (existing && existing.trim().length > 0) {
    return existing;
  }
  return crypto.randomUUID();
}
