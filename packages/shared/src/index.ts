export const DocumentStatus = {
  PROCESSING: "PROCESSING",
  SUCCESS: "SUCCESS",
  NEEDS_REVIEW: "NEEDS_REVIEW",
  FAILED: "FAILED",
} as const;

export type DocumentStatus =
  (typeof DocumentStatus)[keyof typeof DocumentStatus];

export const DocumentType = {
  BP: "BP",
  HBA1C: "HBA1C",
  UNKNOWN: "UNKNOWN",
} as const;

export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];

export interface DocumentRecord {
  id: string;
  fileName: string;
  blobName: string;
  status: DocumentStatus;
  documentType: DocumentType | null;
  measureValue: string | null;
  measureDate: string | null;
  classification: string | null;
  confidenceScore: number | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}
