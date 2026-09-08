import type { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { createLogger } from "@clinicworks/shared";
import { runProcessing } from "../lib/process.js";
import { toSafeReason } from "../lib/process.js";

// Simple validation without external schema library
function validateBody(body: unknown): { valid: boolean; documentId?: number; error?: string } {
  if (typeof body !== "object" || body === null) {
    return { valid: false, error: "Invalid JSON body" };
  }
  const bodyObj = body as { documentId?: unknown };
  const id = Number(bodyObj.documentId);
  if (!Number.isInteger(id) || id <= 0) {
    return { valid: false, error: "documentId is required and must be a positive integer" };
  }
  return { valid: true, documentId: id };
}

export async function processDocument(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const correlationId = request.headers.get("x-correlation-id") ?? crypto.randomUUID();
  const logger = createLogger(correlationId);
  logger.info("processDocument.start");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      status: 400,
      jsonBody: { error: "Invalid JSON body", correlationId },
    };
  }

  const validation = validateBody(body);
  if (!validation.valid) {
    return {
      status: 400,
      jsonBody: { error: validation.error, correlationId },
    };
  }
  const documentId = validation.documentId as number;

  try {
    const result = await runProcessing(documentId, correlationId);
    return {
      status: 200,
      jsonBody: { id: String(result.documentId), status: result.status, correlationId },
    };
  } catch (error) {
    const reason = toSafeReason(error);
    const message = error instanceof Error ? error.message : "Processing failed";
    if (message.includes("not found")) {
      logger.warn("processDocument.notFound", { documentId: String(documentId) });
      return {
        status: 404,
        jsonBody: { error: "Document not found", correlationId },
      };
    }
    if (message.includes("AI_API_KEY") || message.includes("DATABASE_URL")) {
      logger.error("processDocument.misconfigured");
      return {
        status: 500,
        jsonBody: { error: "Service misconfigured", correlationId },
      };
    }
    context.log(`processDocument failed correlationId=${correlationId}`);
    logger.error("processDocument.failed", {
      documentId: String(documentId),
      error: message,
      stack: (error as Error).stack,
      reason,
    });
    return {
      status: 500,
      jsonBody: { error: "Processing failed", reason, correlationId },
    };
  }
}
