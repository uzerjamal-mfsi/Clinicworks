export type ProcessingStatus = "PROCESSING" | "SUCCESS" | "NEEDS_REVIEW" | "FAILED";

export const STALE_PROCESSING_MS = 10 * 60 * 1000;

export function isFinalStatus(status: string): boolean {
  return status === "SUCCESS" || status === "NEEDS_REVIEW" || status === "FAILED";
}

export function isStaleProcessing(
  status: string,
  createdAt: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (status !== "PROCESSING" || !createdAt) return false;
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return false;
  return now.getTime() - created > STALE_PROCESSING_MS;
}

export function canRetry(status: string, createdAt?: string | null, now?: Date): boolean {
  if (status === "FAILED" || status === "NEEDS_REVIEW") return true;
  return isStaleProcessing(status, createdAt ?? null, now);
}

export type ProcessingTarget = "logic-app" | "function" | "none";

export async function triggerLogicApp(documentId: number, correlationId: string): Promise<boolean> {
  const webhookUrl = process.env.LOGIC_APP_WEBHOOK_URL?.trim();
  if (!webhookUrl) return false;
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-correlation-id": correlationId },
    body: JSON.stringify({ documentId }),
  });
  if (!response.ok) throw new Error(`Logic App trigger failed with status ${response.status}`);
  return true;
}

export async function triggerFunction(documentId: number, correlationId: string): Promise<boolean> {
  const functionUrl = process.env.FUNCTION_PROCESS_DOCUMENT_URL?.trim();
  if (!functionUrl) return false;
  const response = await fetch(functionUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-correlation-id": correlationId },
    body: JSON.stringify({ documentId }),
  });
  if (!response.ok) throw new Error(`Function trigger failed with status ${response.status}`);
  return true;
}

export async function triggerProcessing(
  documentId: number,
  correlationId: string
): Promise<ProcessingTarget> {
  if (process.env.LOGIC_APP_WEBHOOK_URL?.trim()) {
    await triggerLogicApp(documentId, correlationId);
    return "logic-app";
  }
  if (await triggerFunction(documentId, correlationId)) return "function";
  return "none";
}

export async function retryDocument(documentId: string): Promise<{ id: string; status: string }> {
  const parsed = Number(documentId);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error("Invalid document id");
  const response = await fetch(`/api/documents/${parsed}/retry`, { method: "POST" });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error ?? `Retry failed (${response.status})`);
  return { id: String(json.id ?? parsed), status: String(json.status ?? "PROCESSING") };
}
