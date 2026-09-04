import { describe, it, expect } from "vitest";
import { documents, documentTypeEnum, processingStatusEnum } from "./schema.js";

describe("documents schema", () => {
  it("defines required columns", () => {
    expect(documents.id).toBeDefined();
    expect(documents.fileName).toBeDefined();
    expect(documents.documentType).toBeDefined();
    expect(documents.measureValue).toBeDefined();
    expect(documents.measureDate).toBeDefined();
    expect(documents.status).toBeDefined();
    expect(documents.errorMessage).toBeDefined();
    expect(documents.createdAt).toBeDefined();
    expect(documents.dateProcessed).toBeDefined();
  });

  it("has correct status enum values", () => {
    expect(processingStatusEnum.enumValues).toEqual(
      expect.arrayContaining(["PROCESSING", "SUCCESS", "NEEDS_REVIEW", "FAILED"])
    );
  });

  it("has correct document type values", () => {
    expect(documentTypeEnum.enumValues).toEqual(expect.arrayContaining(["BP", "HBA1C", "UNKNOWN"]));
  });

  it("uses numeric auto-increment id as primary key", () => {
    expect(documents.id.primary).toBe(true);
  });

  it("keeps table simple with single file column", () => {
    expect((documents as unknown as Record<string, unknown>).blobName).toBeUndefined();
  });
});
