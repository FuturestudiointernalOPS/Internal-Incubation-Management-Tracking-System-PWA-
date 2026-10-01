-- =============================================================================
-- IMPACTOS VENTURES — DATA BANK DOCUMENT VERSIONS
-- (supabase/migrations/20260928_venture_verification_document_versions.sql)
-- -----------------------------------------------------------------------------
-- One row per uploaded version of a Data bank (verification) document. The
-- document row in venture_verification_documents stays the LIVE pointer (it
-- always holds the newest file); every upload — the first one included — is
-- also recorded here, so the history runs from version 1 to the newest.
--
-- Deleting the document cascades to its versions.
--
-- The same definition ships inside ensureVentureSchema() (src/lib/ventures.js),
-- which runs on Venture intake, and the read/write path self-heals the table on
-- first use — so this file is for environments upgraded in place, and its
-- backfill makes an existing document's history complete immediately instead of
-- filling in on the next upload.
--
-- Idempotent: IF NOT EXISTS everywhere, and the backfill skips documents that
-- already have a version — safe to re-run.
-- -----------------------------------------------------------------------------
-- Apply via the Supabase SQL editor (production: main branch; staging: dev).
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS venture_verification_document_versions (
  id SERIAL PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES venture_verification_documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  file_url TEXT NOT NULL,
  version_notes TEXT,
  uploaded_by TEXT,
  uploaded_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (document_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_venture_verification_document_versions_doc
  ON venture_verification_document_versions(document_id);

-- Backfill: a document filed before versioning existed becomes version 1, so no
-- history is ever empty.
INSERT INTO venture_verification_document_versions
  (document_id, version_number, file_name, file_size, file_type, file_url, uploaded_by, uploaded_at)
SELECT d.id, 1, d.file_name, d.file_size, d.file_type, d.file_url, d.uploaded_by, d.uploaded_at
FROM venture_verification_documents d
WHERE NOT EXISTS (
  SELECT 1 FROM venture_verification_document_versions v WHERE v.document_id = d.id
);

COMMIT;
