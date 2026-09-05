import { BlobServiceClient, type ContainerClient } from "@azure/storage-blob";

export function sanitizeFileName(name: string): string {
  const base = name.split("/").pop()?.split("\\").pop() ?? "document.pdf";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  const trimmed = cleaned.replace(/^-+|-+$/g, "").slice(0, 100);
  return trimmed.length > 0 ? trimmed : "document.pdf";
}

export function blobNameForDocument(id: number | string, fileName: string): string {
  return `${String(id)}/${sanitizeFileName(fileName)}`;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function getContainerClient(): ContainerClient {
  const service = BlobServiceClient.fromConnectionString(requiredEnv("BLOB_CONNECTION_STRING"));
  return service.getContainerClient(
    process.env.BLOB_CONTAINER_NAME?.trim() ? process.env.BLOB_CONTAINER_NAME : "documents"
  );
}

export async function uploadDocumentBlob(
  blobName: string,
  data: Buffer,
  contentType: string
): Promise<void> {
  const container = getContainerClient();
  await container.createIfNotExists();
  const blockBlob = container.getBlockBlobClient(blobName);
  await blockBlob.uploadData(data, {
    blobHTTPHeaders: { blobContentType: contentType },
  });
}
