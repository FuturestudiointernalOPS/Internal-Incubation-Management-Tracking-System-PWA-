-- ============================================================================
-- 045_submission_role_lock.sql
-- Track which role made the final review decision on a submission so that a
-- facilitator and program management cannot override each other's decisions.
-- ============================================================================

ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS reviewed_by_role TEXT DEFAULT NULL;
