-- =============================================================================
-- IMPACTOS LMS — RESOURCES ATTACH TO LESSONS
-- (supabase/migrations/20261105_lms_lesson_resources.sql)
-- -----------------------------------------------------------------------------
-- Material (documents + videos) is now added per LESSON, not per chapter.
--
--   * lms_section_resources.lesson_id — nullable UUID FK → lms_lessons,
--     ON DELETE CASCADE: a lesson's material dies with the lesson.
--   * section_id stays NOT NULL (a lesson's row still names its chapter), so
--     existing chapter-level rows keep working untouched (lesson_id stays NULL).
--
-- Additive and idempotent — no data is changed or dropped.
-- Apply via the Supabase SQL editor (staging first, then production).
-- =============================================================================

BEGIN;

ALTER TABLE lms_section_resources
    ADD COLUMN IF NOT EXISTS lesson_id UUID REFERENCES lms_lessons(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_lms_section_resources_lesson
    ON lms_section_resources(lesson_id);

COMMIT;
