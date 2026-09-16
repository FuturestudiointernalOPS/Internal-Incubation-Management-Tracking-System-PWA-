-- =============================================================================
-- IMPACTOS LMS — SESSION RESOURCES, RECOMMENDATIONS & COACHING REQUESTS
-- (supabase/migrations/20260916_lms_session_resources_and_coaching.sql)
-- -----------------------------------------------------------------------------
-- Phase 8 — adds two NEW tables to the LMS domain:
--
--   1. lms_session_resources
--      Curated per-session material (videos + documents) with an explicit
--      "recommended" flag and note, so the material attached to a Program
--      session becomes actionable for learners instead of a bare file list.
--
--   2. lms_coaching_requests
--      A learner asks for coaching BEFORE / DURING / AFTER a course. The
--      request is a lightweight workflow row (no scheduling engine): it lands
--      as 'pending', program staff are notified, and the decision is recorded
--      on the same row (status + response_note + handled_by).
--
-- Rules honoured:
--   * Additive only: creates NEW tables, touches NO existing table.
--   * Idempotent: every statement is CREATE ... IF NOT EXISTS — safe to re-run.
--   * No FK on program_id / session_id (TEXT without FK) — same deliberate
--     decision as lms_program_requirements (see docs/LMS_ARCHITECTURE.md §8:
--     the v2_programs / v2_sessions id-space is TEXT while the schema declares
--     UUID, so a live FK is unsafe). Service code validates existence instead.
--   * Learner identity stays contacts.cid; lesson/course FKs are safe UUIDs.
-- Apply via the Supabase SQL editor (production: main branch; staging: dev).
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. lms_session_resources — videos / documents attached to a program session
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lms_session_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id TEXT NOT NULL,                  -- v2_programs.id (TEXT, no FK — see header)
    session_id TEXT,                           -- v2_sessions.id (TEXT, no FK); NULL = program-wide
    week_number INTEGER,                       -- denormalised program week (read convenience)
    kind TEXT NOT NULL DEFAULT 'document'
        CHECK (kind IN ('video', 'document')),
    title TEXT NOT NULL,
    description TEXT,                          -- what the resource is / how to use it
    url TEXT,                                  -- external link (video URL, Drive/Docs link, …) OR the uploaded file's public URL
    source TEXT NOT NULL DEFAULT 'link'
        CHECK (source IN ('link', 'upload')),  -- where `url` comes from (Phase 8.1)
    storage_path TEXT,                         -- object path in the bucket; NULL for links
    file_name TEXT,                            -- original filename of an upload
    file_size BIGINT,                          -- bytes (uploads only)
    mime_type TEXT,                            -- uploads only
    is_recommended BOOLEAN NOT NULL DEFAULT FALSE,
    recommendation_note TEXT,                  -- why it is recommended (coach/PM guidance)
    position INTEGER NOT NULL DEFAULT 0,
    created_by TEXT,                           -- contacts.cid or 'system'
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_lms_session_resources_session
    ON lms_session_resources(program_id, session_id);
CREATE INDEX IF NOT EXISTS idx_lms_session_resources_recommended
    ON lms_session_resources(program_id, is_recommended);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. lms_coaching_requests — learner request for coaching around a course
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lms_coaching_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_cid TEXT NOT NULL REFERENCES contacts(cid) ON DELETE CASCADE,  -- existing ImpactOS identity
    program_id TEXT,                           -- v2_programs.id (TEXT, no FK); NULL for standalone courses
    course_id UUID REFERENCES lms_courses(id) ON DELETE CASCADE,
    lesson_id UUID REFERENCES lms_lessons(id) ON DELETE SET NULL,        -- optional: "right here" context
    timing TEXT NOT NULL DEFAULT 'during'
        CHECK (timing IN ('before', 'during', 'after')),
    topic TEXT,                                -- subject the learner wants to work on
    message TEXT,                              -- free-form learner note
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'declined', 'completed', 'cancelled')),
    handled_by TEXT,                           -- contacts.cid of the staff member who acted
    handled_at TIMESTAMPTZ,
    response_note TEXT,                        -- staff answer / proposed slot
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_lms_coaching_requests_user
    ON lms_coaching_requests(user_cid);
CREATE INDEX IF NOT EXISTS idx_lms_coaching_requests_program
    ON lms_coaching_requests(program_id, status);
CREATE INDEX IF NOT EXISTS idx_lms_coaching_requests_course
    ON lms_coaching_requests(course_id);

COMMIT;
