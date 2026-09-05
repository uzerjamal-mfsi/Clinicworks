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
