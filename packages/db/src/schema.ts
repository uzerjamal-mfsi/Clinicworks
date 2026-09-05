import { pgTable, pgEnum, serial, text, date, timestamp, real } from "drizzle-orm/pg-core";

export const documentTypeEnum = pgEnum("document_type", ["BP", "HBA1C", "UNKNOWN"]);

export const processingStatusEnum = pgEnum("processing_status", [
  "PROCESSING",
  "SUCCESS",
  "NEEDS_REVIEW",
  "FAILED",
]);

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  fileName: text("file_name").notNull(),
  blobName: text("blob_name"),
  documentType: documentTypeEnum("document_type"),
  measureValue: text("measure_value"),
  measureDate: date("measure_date"),
  classification: text("classification"),
  confidenceScore: real("confidence_score"),
  status: processingStatusEnum("processing_status").notNull().default("PROCESSING"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  dateProcessed: timestamp("date_processed", { withTimezone: true }),
});

export type DocumentRow = typeof documents.$inferSelect;
export type NewDocumentRow = typeof documents.$inferInsert;
