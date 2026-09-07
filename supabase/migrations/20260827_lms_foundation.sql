-- =============================================================================
-- IMPACTOS LMS — PHASE 1 FOUNDATION (supabase/migrations/20260827_lms_foundation.sql)
-- -----------------------------------------------------------------------------
-- Creates the Learning Management System domain:
--   courses -> sections -> lessons (V1 content: YouTube video)
--   enrollments (admin / program / self / purchase) + lesson progress
--   assessments -> questions -> attempts (multiple_choice, true_false)
--   program learning requirements (Program -> Course link)
--
-- Rules honoured:
--   * Additive only: creates NEW tables, touches NO existing tables.
--   * Idempotent: every statement is CREATE ... IF NOT EXISTS — safe to re-run.
--   * No data is dropped, no existing behaviour is altered.
--   * Identity = existing contacts.cid; no lms_users table.
--   * Certificates are intentionally deferred (Phase 1 decision) — no
--     certificate table is created here.
-- Apply via the Supabase SQL editor (production: main branch; staging: dev).
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. lms_courses — reusable course catalogue (NOT owned by any program)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lms_courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE,                          -- human-readable id for future public URLs
    title TEXT NOT NULL,
    description TEXT,
    thumbnail_url TEXT,                        -- image reference (Vercel Blob / CDN), not a blob
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'archived')),
    visibility TEXT NOT NULL DEFAULT 'public'
        CHECK (visibility IN ('public', 'private')),
    is_free BOOLEAN NOT NULL DEFAULT TRUE,
    price DECIMAL(10, 2),                      -- only meaningful when is_free = FALSE; payment is a future phase
    created_by TEXT,                           -- contacts.cid or 'system' (no FK: matches learning_paths.created_by convention)
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_lms_courses_status ON lms_courses(status);
CREATE INDEX IF NOT EXISTS idx_lms_courses_visibility ON lms_courses(visibility);
CREATE INDEX IF NOT EXISTS idx_lms_courses_created_by ON lms_courses(created_by);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. lms_course_sections — ordered sections inside a course
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lms_course_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES lms_courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE (course_id, position)               -- predictable ordering; also serves course_id lookups
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. lms_lessons — ordered lessons inside a section (V1 content: YouTube video)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lms_lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES lms_course_sections(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    is_required BOOLEAN NOT NULL DEFAULT TRUE,
    content_type TEXT NOT NULL DEFAULT 'video'
        CHECK (content_type IN ('video')),     -- V1: video only; extend via ALTER in later phases
    youtube_video_id TEXT,                     -- YouTube identifier only — no video storage/transcoding
    duration_minutes INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE (section_id, position)              -- predictable ordering; also serves section_id lookups
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. lms_enrollments — learner access to a course (multi-source, one per user+course)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lms_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES lms_courses(id) ON DELETE CASCADE,
    user_cid TEXT NOT NULL REFERENCES contacts(cid) ON DELETE CASCADE,  -- existing ImpactOS identity
    source TEXT NOT NULL DEFAULT 'admin'
        CHECK (source IN ('admin', 'program', 'self', 'purchase')),
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'completed', 'suspended')),
    program_id TEXT,                           -- informational: program that triggered a 'program' enrollment
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    completed_at TIMESTAMPTZ,
    UNIQUE (course_id, user_cid)               -- one enrollment per learner+course
);

CREATE INDEX IF NOT EXISTS idx_lms_enrollments_user ON lms_enrollments(user_cid);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. lms_lesson_progress — learner progress keyed by enrollment + lesson
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lms_lesson_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id UUID NOT NULL REFERENCES lms_enrollments(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES lms_lessons(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'not_started'
        CHECK (status IN ('not_started', 'in_progress', 'completed')),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE (enrollment_id, lesson_id)          -- one progress row per enrollment+lesson
);

CREATE INDEX IF NOT EXISTS idx_lms_lesson_progress_lesson ON lms_lesson_progress(lesson_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. lms_assessments — assessment attached to a course (optional section anchor)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lms_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES lms_courses(id) ON DELETE CASCADE,
    section_id UUID REFERENCES lms_course_sections(id) ON DELETE CASCADE,  -- NULL = course-level assessment
    title TEXT NOT NULL,
    description TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    is_required BOOLEAN NOT NULL DEFAULT TRUE,
    pass_mark INTEGER,                         -- NULL = use course/global default (later phase)
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_lms_assessments_course ON lms_assessments(course_id);
CREATE INDEX IF NOT EXISTS idx_lms_assessments_section ON lms_assessments(section_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. lms_assessment_questions — questions inside an assessment
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lms_assessment_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES lms_assessments(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    question_type TEXT NOT NULL DEFAULT 'multiple_choice'
        CHECK (question_type IN ('multiple_choice', 'true_false')),
    options JSONB NOT NULL DEFAULT '[]'::jsonb,        -- [{key,text}] for MC; [] for true_false
    correct_answer JSONB NOT NULL DEFAULT '[]'::jsonb, -- ['A'] or ['true'] / ['false']
    points INTEGER NOT NULL DEFAULT 1,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE (assessment_id, position)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. lms_assessment_attempts — learner attempts (multiple attempts supported)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lms_assessment_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_cid TEXT NOT NULL REFERENCES contacts(cid) ON DELETE CASCADE,
    assessment_id UUID NOT NULL REFERENCES lms_assessments(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL DEFAULT 1,
    score INTEGER NOT NULL DEFAULT 0,
    total_points INTEGER NOT NULL DEFAULT 0,
    passed BOOLEAN NOT NULL DEFAULT FALSE,
    answers JSONB NOT NULL DEFAULT '[]'::jsonb,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE (user_cid, assessment_id, attempt_number)  -- NOT unique per user+assessment alone: retries allowed
);

CREATE INDEX IF NOT EXISTS idx_lms_attempts_assessment ON lms_assessment_attempts(assessment_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. lms_program_requirements — Program -> Course learning requirements
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lms_program_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id TEXT NOT NULL,                  -- v2_programs.id; TEXT (not FK) — see docs/LMS_ARCHITECTURE.md §Decisions
    course_id UUID NOT NULL REFERENCES lms_courses(id) ON DELETE CASCADE,
    title TEXT,
    description TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    is_required BOOLEAN NOT NULL DEFAULT TRUE,
    week_number INTEGER,                       -- optional program context (week gate)
    session_id TEXT,                           -- optional program context (session anchor)
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE (program_id, course_id)             -- a course is required at most once per program
);

CREATE INDEX IF NOT EXISTS idx_lms_program_requirements_course ON lms_program_requirements(course_id);

COMMIT;
