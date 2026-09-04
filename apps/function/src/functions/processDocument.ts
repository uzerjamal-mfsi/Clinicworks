import type { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

export async function processDocument(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const correlationId = request.headers.get("x-correlation-id") ?? crypto.randomUUID();
  context.log(`processDocument start correlationId=${correlationId}`);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      status: 400,
      jsonBody: { error: "Invalid JSON body", correlationId },
    };
  }

  const documentId =
    body && typeof body === "object" && "documentId" in body
      ? String((body as Record<string, unknown>).documentId)
      : null;

  if (!documentId) {
    return {
      status: 400,
      jsonBody: { error: "documentId is required", correlationId },
    };
  }

  return {
    status: 202,
    jsonBody: { status: "PROCESSING", documentId, correlationId },
  };
}
