-- =============================================================================
-- Monthly acquisition channels (ADDITIVE ONLY)
-- The Growth stage criterion requires "the same channel brought new customers
-- in each of the last N months". A quarterly list cannot prove that, so the
-- channel is captured per month.
--
-- Contract of scripts/db-audit/apply-schema-file.mjs: one statement per line.
-- =============================================================================

ALTER TABLE IF EXISTS venture_monthly_report ADD COLUMN IF NOT EXISTS channels TEXT[];
