import { pgTable, pgEnum, serial, text, date, timestamp } from "drizzle-orm/pg-core";

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
  documentType: documentTypeEnum("document_type"),
  measureValue: text("measure_value"),
  measureDate: date("measure_date"),
  status: processingStatusEnum("processing_status").notNull().default("PROCESSING"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  dateProcessed: timestamp("date_processed", { withTimezone: true }),
});

export type DocumentRow = typeof documents.$inferSelect;
export type NewDocumentRow = typeof documents.$inferInsert;
