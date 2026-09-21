-- =============================================================================
-- RUN REPORT FILE — the document a Run hands to the report writer
--
-- A Run can now carry BOTH:
--   • an Output Instruction (`platform_form_runs.settings ->> 'output_instruction'`),
--   • and one uploaded document (this table), which the report writer reads as
--     source material — a rubric, a house style, or the instructions themselves.
--
-- A document alone is enough to switch the report to the composed one: the
-- document may already carry every instruction the report needs.
--
-- ONE file per Run. A replacement OVERWRITES the row (unique index on run_id)
-- rather than accumulating, so "which document shaped this run?" has exactly one
-- answer.
--
-- The extracted text is stored next to the file because:
--   • the report writer needs TEXT — the model receives no file, only what was
--     read out of it, and a scanned PDF legitimately yields nothing;
--   • the administrator must be able to read exactly what the writer was given.
-- The object itself lives in a PRIVATE storage bucket and is reached through a
-- short-lived signed link, never a public URL.
--
-- Purely additive — no existing table is altered except for the audit column
-- below, which is nullable.
--
-- The application also provisions this itself on first use (the same statements,
-- all no-ops when repeated), so a Run can attach a document on a database where
-- this file has not been applied yet. Apply it anyway before any deployment that
-- runs with SKIP_RUNTIME_SCHEMA_MAINTENANCE=true — those send no runtime DDL at
-- all, and the report INSERT names the new column.
--
-- Apply via the Supabase SQL editor (production: main branch; staging: dev).
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS platform_run_report_files (
  id SERIAL PRIMARY KEY,
  run_id INTEGER NOT NULL REFERENCES platform_form_runs(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  file_size INTEGER,
  storage_path TEXT NOT NULL,
  extracted_text TEXT,
  extraction_status TEXT NOT NULL DEFAULT 'failed',
  extraction_error TEXT,
  uploaded_by TEXT,
  uploaded_at TIMESTAMP DEFAULT NOW()
);

-- One document per Run: the row is replaced, never duplicated.
CREATE UNIQUE INDEX IF NOT EXISTS idx_run_report_files_run
  ON platform_run_report_files (run_id);

-- The composed report already snapshots the instruction that produced it, so a
-- report that was sent stays explainable after the instruction is edited. The
-- document takes part in composition too, so it must be snapshotted as well —
-- otherwise replacing or removing the file would leave the earlier report
-- explainable only by a file that no longer exists.
ALTER TABLE platform_submission_reports
  ADD COLUMN IF NOT EXISTS reference_snapshot TEXT;

COMMIT;
