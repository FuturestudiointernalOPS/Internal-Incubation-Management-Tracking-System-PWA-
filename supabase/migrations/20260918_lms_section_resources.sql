-- =============================================================================
-- IMPACTOS LMS — SECTION RESOURCES (course sections)
-- (supabase/migrations/20260918_lms_section_resources.sql)
-- -----------------------------------------------------------------------------
-- The "session resources" feature (Phase 8) was attached to PROGRAM sessions.
-- That was the wrong home: material belongs to the course the learner is
-- taking, so a course SECTION (an "LMS session") now carries its own resources.
--
--   1. CREATE lms_section_resources — videos/documents attached to a course
--      section, with the "recommended" flag + note carried over from Phase 8.
--   2. DROP   lms_session_resources — the program-session table is retired: the
--      program workspace no longer manages material.
--
-- Rules honoured:
--   * section_id is a real UUID FK → lms_course_sections, ON DELETE CASCADE:
--     a section's material dies with the section (no orphan rows).
--   * Idempotent: CREATE ... IF NOT EXISTS + DROP ... IF EXISTS — safe to re-run.
--   * DESTRUCTIVE, ON PURPOSE: dropping lms_session_resources deletes the rows
--     it held. Objects uploaded by the retired feature stay in the
--     "lms-session-resources" storage bucket (under sessions/…) and are no
--     longer reachable from the application.
--   * The storage bucket is REUSED (its historical name is kept so no object is
--     orphaned): section uploads live under sections/<course>/<section>/.
-- -----------------------------------------------------------------------------
-- Apply via the Supabase SQL editor (production: main branch; staging: dev).
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS lms_section_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES lms_course_sections(id) ON DELETE CASCADE,
    kind TEXT NOT NULL DEFAULT 'document'
        CHECK (kind IN ('video', 'document')),
    title TEXT NOT NULL,
    description TEXT,                          -- what the resource is / how to use it
    url TEXT,                                  -- external link OR the uploaded file's public URL
    source TEXT NOT NULL DEFAULT 'link'
        CHECK (source IN ('link', 'upload')),
    storage_path TEXT,                         -- object path in the bucket; NULL for links
    file_name TEXT,
    file_size BIGINT,
    mime_type TEXT,
    is_recommended BOOLEAN NOT NULL DEFAULT FALSE,
    recommendation_note TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_lms_section_resources_section
    ON lms_section_resources(section_id);
CREATE INDEX IF NOT EXISTS idx_lms_section_resources_recommended
    ON lms_section_resources(section_id, is_recommended);

-- Retire the program-session table (Phase 8). Irreversible.
DROP TABLE IF EXISTS lms_session_resources;

COMMIT;
