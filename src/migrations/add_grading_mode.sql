-- Add grading_mode column to v2_programs
-- Controls how PMs review participant submissions
-- 'graded' = approve/reject with score (default)
-- 'review' = feedback only, no scoring
-- 'followup' = schedule a meeting/call instead of grading

ALTER TABLE v2_programs
ADD COLUMN IF NOT EXISTS grading_mode TEXT NOT NULL DEFAULT 'graded'
CHECK (grading_mode IN ('graded', 'review', 'followup'));
