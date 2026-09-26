-- =============================================================================
-- INVESTOR PROFILE COLUMNS — the columns the investor intake reads and writes
-- =============================================================================
-- Six columns on investor_profiles are referenced by the application (the
-- Add-Investor intake, its approval provisioning, and the qualification review)
-- but no versioned migration ever created them: they exist in the production
-- database only. On an environment without them, approving an Investor
-- Application fails its profile write, and saving review notes fails too.
--
-- This file is the TARGETED, reviewable unit for those six columns. The same
-- statements are recorded in the investor section of
-- migrations/align_schema_with_code.sql, which stays the aggregate drift record.
--
-- The app also self-heals these columns at runtime (ensureInvestorProfileSchema,
-- called from the investor provisioning path), so a database nobody migrates
-- still works. Applying this file simply makes them exist up front.
--
-- Contract (scripts/db-audit/apply-schema-file.mjs relies on it):
--   * ONE STATEMENT PER LINE, each terminated by ';'
--   * every statement is idempotent — safe to re-run
--
-- Apply with:
--   node scripts/db-audit/apply-schema-file.mjs migrations/investor_profile_columns.sql            -> dry run
--   node scripts/db-audit/apply-schema-file.mjs migrations/investor_profile_columns.sql --apply <env>  -> execute
--
-- NOTE: check the env file you point at. On this repository .env.local and
-- .env.prod-verify target PRODUCTION; .env.staging / .env.audit-staging target
-- staging (see docs/PRODUCTION_TEST.md section 2).
-- =============================================================================

ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS qualification_status TEXT DEFAULT 'pending_review';
ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS investment_experience TEXT;
ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS profile_completion INTEGER DEFAULT 0;
ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS review_notes TEXT;
ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS reviewed_by TEXT;
