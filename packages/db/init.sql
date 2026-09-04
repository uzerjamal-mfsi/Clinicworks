DO $$ BEGIN
  CREATE TYPE document_type AS ENUM ('BP', 'HBA1C', 'UNKNOWN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE processing_status AS ENUM ('PROCESSING', 'SUCCESS', 'NEEDS_REVIEW', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  file_name TEXT NOT NULL,
  document_type document_type,
  measure_value TEXT,
  measure_date DATE,
  processing_status processing_status NOT NULL DEFAULT 'PROCESSING',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date_processed TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_documents_status ON documents (processing_status);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents (created_at DESC);
