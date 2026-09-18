-- =============================================================================
-- RUN OUTPUT INSTRUCTION — STORED COMPOSED REPORTS
--
-- A Run may carry an optional Output Instruction in
-- `platform_form_runs.settings ->> 'output_instruction'`. When it does, the
-- participant-facing report is composed by AI from the Run's own data plus that
-- instruction, instead of being laid out by the fixed renderer.
--
-- The composed document is STORED here so that:
--   • Preview and Send render the exact same bytes (the builder reads, it does
--     not re-run the model), which is the invariant the fixed renderer already
--     satisfied;
--   • a bulk send of N recipients does not become N model calls when the
--     documents were already previewed;
--   • the instruction actually used is snapshotted, so a report that was sent
--     can still be explained after the instruction is edited.
--
-- Purely additive — no existing table is modified. Runs without an instruction
-- never write a row here and keep the existing deterministic report.
-- =============================================================================

CREATE TABLE IF NOT EXISTS platform_submission_reports (
  id SERIAL PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES platform_form_submissions(id) ON DELETE CASCADE,
  evaluation_id INTEGER,
  decision TEXT,
  instruction_hash TEXT NOT NULL,
  instruction_snapshot TEXT,
  lang TEXT,
  document JSONB NOT NULL,
  model TEXT DEFAULT 'deepseek-chat',
  generated_at TIMESTAMP DEFAULT NOW()
);

-- One lookup per report build: the latest row matching the current key.
CREATE INDEX IF NOT EXISTS idx_submission_reports_lookup
  ON platform_submission_reports (submission_id, generated_at DESC);
