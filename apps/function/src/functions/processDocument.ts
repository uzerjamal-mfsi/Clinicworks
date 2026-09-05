import type { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { z } from "zod";
import { createLogger } from "@clinicworks/shared";
import { runProcessing } from "../lib/process.js";

const bodySchema = z.object({
  documentId: z.coerce.number().int().positive(),
});

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

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      status: 400,
      jsonBody: { error: "documentId is required", correlationId },
    };
  }

  try {
    const result = await runProcessing(parsed.data.documentId, correlationId);
    return {
      status: 200,
      jsonBody: { id: String(result.documentId), status: result.status, correlationId },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Processing failed";
    if (message.includes("not found")) {
      logger.warn("processDocument.notFound", { documentId: String(parsed.data.documentId) });
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
    logger.error("processDocument.failed");
    return {
      status: 500,
      jsonBody: { error: "Processing failed", correlationId },
    };
  }
}
