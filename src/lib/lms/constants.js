/**
 * LMS DOMAIN CONSTANTS
 *
 * Single source of truth for the LMS vocabulary. Mirrors the CHECK-constraint
 * values in supabase/migrations/20260827_lms_foundation.sql — keep the two in
 * sync (src/__tests__/lms-foundation.test.js asserts the match).
 *
 * Values are lowercase strings because they are stored as-is in the database.
 */

export const LMS_COURSE_STATUSES = ["draft", "published", "archived"];

export const LMS_COURSE_VISIBILITY = ["public", "private"];

export const LMS_ENROLLMENT_SOURCES = ["admin", "program", "self", "purchase"];

export const LMS_ENROLLMENT_STATUSES = ["active", "completed", "suspended"];

export const LMS_PROGRESS_STATUSES = ["not_started", "in_progress", "completed"];

export const LMS_LESSON_CONTENT_TYPES = ["video"];

export const LMS_QUESTION_TYPES = ["multiple_choice", "true_false"];
