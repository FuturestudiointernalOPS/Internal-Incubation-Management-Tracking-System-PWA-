-- =============================================================================
-- IMPACTOS — VENTURE OS PROMOTION
-- Enhancement 1.1 — Workflow A: Program-to-Venture Promotion
-- =============================================================================

-- Add venture_id column to v2_programs to track promotion
ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS venture_id TEXT;
CREATE INDEX IF NOT EXISTS idx_v2_programs_venture_id ON v2_programs(venture_id);
