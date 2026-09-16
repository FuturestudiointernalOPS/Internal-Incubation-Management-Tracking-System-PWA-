-- =============================================================================
-- IMPACTOS LMS — SESSION RESOURCE FILE UPLOADS
-- (supabase/migrations/20260917_lms_session_resource_uploads.sql)
-- -----------------------------------------------------------------------------
-- Extends lms_session_resources so a resource can be EITHER an external link
-- (source = 'link', stored in `url`) OR a file uploaded through ImpactOS
-- (source = 'upload', the public storage URL in `url` + the metadata below).
--
-- Why the extra columns instead of a new table: the readable surface for both
-- cases is identical (a title + something to open). Keeping one table means the
-- participant payload, the recommendation flag and the ordering logic stay
-- unchanged — only the origin is recorded.
--
-- Rules honoured:
--   * Additive only: ALTER TABLE ADD COLUMN IF NOT EXISTS + guarded constraint.
--   * Idempotent: safe to re-run, and a no-op on a database where the columns
--     were already created inline by 20260916_lms_session_resources_and_coaching.
--   * File date is deliberately AFTER 20260916: applied in filename order, the
--     table must exist before these ALTERs run.
-- Apply via the Supabase SQL editor (production: main branch; staging: dev).
-- =============================================================================

BEGIN;

ALTER TABLE lms_session_resources
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'link';
ALTER TABLE lms_session_resources
    ADD COLUMN IF NOT EXISTS storage_path TEXT;      -- object path inside the bucket (deletion handle)
ALTER TABLE lms_session_resources
    ADD COLUMN IF NOT EXISTS file_name TEXT;         -- original filename, shown to learners
ALTER TABLE lms_session_resources
    ADD COLUMN IF NOT EXISTS file_size BIGINT;       -- bytes
ALTER TABLE lms_session_resources
    ADD COLUMN IF NOT EXISTS mime_type TEXT;

-- The CHECK is added in a guarded block so re-running never errors: on a fresh
-- install the inline constraint from the Phase 8 CREATE already carries the same
-- auto-generated name, which raises duplicate_object — swallowed here.
DO $$
BEGIN
    ALTER TABLE lms_session_resources
        ADD CONSTRAINT lms_session_resources_source_check
        CHECK (source IN ('link', 'upload'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
