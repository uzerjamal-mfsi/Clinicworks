import { BlobServiceClient } from "@azure/storage-blob";

export function sanitizeFileName(name: string): string {
  const base = name.split("/").pop()?.split("\\").pop() ?? "document.pdf";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  const trimmed = cleaned.replace(/^-+|-+$/g, "").slice(0, 100);
  return trimmed.length > 0 ? trimmed : "document.pdf";
}

export function blobNameForDocument(id: number | string, fileName: string): string {
  return `${String(id)}/${sanitizeFileName(fileName)}`;
}

export async function downloadDocumentBlob(
  blobName: string,
  connectionString: string,
  containerName: string
): Promise<Buffer> {
  const service = BlobServiceClient.fromConnectionString(connectionString);
  const container = service.getContainerClient(containerName);
  const blob = container.getBlockBlobClient(blobName);
  const downloaded = await blob.downloadToBuffer();
  return Buffer.from(downloaded);
}
