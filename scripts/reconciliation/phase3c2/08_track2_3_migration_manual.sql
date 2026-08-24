-- =============================================================================
-- PHASE 3C — TRACK 2/3 SCHEMA MIGRATION (SAFE, IDEMPOTENT)
-- -----------------------------------------------------------------------------
-- Run manually via Supabase SQL Editor (or psql) against STAGING.
-- Production: ALREADY APPLIED (57/57) — re-running here is harmless.
--
-- SAFETY: every statement is idempotent:
--   ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS / DROP CONSTRAINT IF EXISTS
-- Re-running this file is safe.
--
-- DO NOT RUN THESE (deliberately excluded — destructive or one-shot data fixes):
--   migrations/fix_staff_role_defaults.sql       (demotes Staff -> participant)
--   src/migrations/cleanup/step2_cleanup.sql     (deletes contacts + all programs)
--   src/migrations/fix_tasks_project_id_type.sql (drops tasks.project_id)
--   repair_unknown_names.sql / hash_*.sql / phase3_program_identity.sql
--   pre_deploy_schema.sql / complete_setup.sql   (one-shot data migrations)
-- =============================================================================

-- ── 0. ENVIRONMENT CHECK — run first, confirm the right database ─────────────
SELECT current_database() AS db_name,
       current_user       AS db_user,
       NOW()              AS checked_at;

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. TRACK 2 — v2_sessions
-- ═════════════════════════════════════════════════════════════════════════════
ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'not started';
ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS weight INTEGER DEFAULT 1;
ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS scheduled_date DATE;
ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS end_time TIME;
ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS assignment_type TEXT;
ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS task_type TEXT;
ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS handler_id TEXT;
ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS handler_name TEXT;
ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS kpi_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS extra_materials JSONB DEFAULT '[]'::jsonb;

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. TRACK 2 — v2_document_requirements
-- ═════════════════════════════════════════════════════════════════════════════
ALTER TABLE v2_document_requirements ADD COLUMN IF NOT EXISTS session_id INTEGER;
ALTER TABLE v2_document_requirements ADD COLUMN IF NOT EXISTS allowed_format TEXT DEFAULT 'pdf';
ALTER TABLE v2_document_requirements ADD COLUMN IF NOT EXISTS weight INTEGER DEFAULT 1;
ALTER TABLE v2_document_requirements ADD COLUMN IF NOT EXISTS kpi_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE v2_document_requirements ADD COLUMN IF NOT EXISTS week_number INTEGER;

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. TRACK 2 — v2_programs
-- ═════════════════════════════════════════════════════════════════════════════
ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS concept_note TEXT;
ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS vision TEXT;
ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS objectives TEXT;
ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS program_type TEXT DEFAULT 'incubation';
ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'private';
ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS participant_limit INTEGER DEFAULT 0;
ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS registration_window TEXT;
ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';
ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS note_id TEXT;
ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS assigned_assistant_id TEXT;
ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS is_archived INTEGER DEFAULT 0;
ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS materials JSONB DEFAULT '[]'::jsonb;

-- ═════════════════════════════════════════════════════════════════════════════
-- 4. TRACK 3 — v2_submissions
-- ═════════════════════════════════════════════════════════════════════════════
ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS version_number INTEGER NOT NULL DEFAULT 1;
ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS supporting_url TEXT;
ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS review_action TEXT;
ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS document_id INTEGER;
ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS team_id TEXT;
ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT NULL;
ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS evaluation_score INTEGER DEFAULT NULL;
ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;

-- ═════════════════════════════════════════════════════════════════════════════
-- 5. TRACK 3 — constraints (drop-if-exists then add, so re-runs are clean)
-- ═════════════════════════════════════════════════════════════════════════════
ALTER TABLE v2_submissions DROP CONSTRAINT IF EXISTS v2_submissions_status_check;
ALTER TABLE v2_submissions ADD CONSTRAINT v2_submissions_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'revision_requested', 'pending_followup'));

ALTER TABLE v2_programs DROP CONSTRAINT IF EXISTS v2_programs_grading_mode_check;
ALTER TABLE v2_programs ADD CONSTRAINT v2_programs_grading_mode_check CHECK (grading_mode IN ('graded', 'review', 'followup', 'academic', 'incubation'));
ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS evaluation_config JSONB DEFAULT '{}'::jsonb;

-- ═════════════════════════════════════════════════════════════════════════════
-- 6. TRACK 3 — v2_followups
-- ═════════════════════════════════════════════════════════════════════════════
ALTER TABLE v2_followups ADD COLUMN IF NOT EXISTS participant_id TEXT;
ALTER TABLE v2_followups ADD COLUMN IF NOT EXISTS submission_id UUID REFERENCES v2_submissions(id) ON DELETE CASCADE;
ALTER TABLE v2_followups ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE v2_followups ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 30;
ALTER TABLE v2_followups ADD COLUMN IF NOT EXISTS meeting_link TEXT;
ALTER TABLE v2_followups ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'scheduled';
ALTER TABLE v2_followups ADD COLUMN IF NOT EXISTS notes TEXT;

-- ═════════════════════════════════════════════════════════════════════════════
-- 7. TRACK 3 — v2_attendance + indexes
-- ═════════════════════════════════════════════════════════════════════════════
ALTER TABLE v2_attendance ADD COLUMN IF NOT EXISTS kpi_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_v2_submissions_participant_deliverable ON v2_submissions(participant_id, deliverable_id);
CREATE INDEX IF NOT EXISTS idx_v2_submissions_version ON v2_submissions(participant_id, deliverable_id, version_number);
CREATE INDEX IF NOT EXISTS idx_v2_followups_participant ON v2_followups(participant_id);
CREATE INDEX IF NOT EXISTS idx_v2_followups_submission ON v2_followups(submission_id);

-- ═════════════════════════════════════════════════════════════════════════════
-- 8. VERIFICATION — run after the statements above; all rows must show present = 1
-- ═════════════════════════════════════════════════════════════════════════════
SELECT table_name, column_name
FROM information_schema.columns
WHERE (table_name, column_name) IN (
  ('v2_submissions','version_number'), ('v2_submissions','updated_at'),
  ('v2_submissions','supporting_url'), ('v2_submissions','review_action'),
  ('v2_submissions','rejection_reason'), ('v2_followups','participant_id'),
  ('v2_followups','scheduled_at'), ('v2_followups','duration_minutes'),
  ('v2_followups','meeting_link'), ('v2_followups','status'),
  ('v2_followups','notes'), ('v2_attendance','kpi_id'),
  ('v2_programs','evaluation_config'), ('v2_sessions','handler_id')
)
ORDER BY table_name, column_name;

SELECT 'v2_submissions_status_check' AS obj,
       EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'v2_submissions_status_check')::int AS present
UNION ALL
SELECT 'v2_programs_grading_mode_check',
       EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'v2_programs_grading_mode_check')::int
UNION ALL
SELECT 'idx_v2_submissions_participant_deliverable',
       EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_v2_submissions_participant_deliverable')::int
UNION ALL
SELECT 'idx_v2_submissions_version',
       EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_v2_submissions_version')::int
UNION ALL
SELECT 'idx_v2_followups_participant',
       EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_v2_followups_participant')::int
UNION ALL
SELECT 'idx_v2_followups_submission',
       EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_v2_followups_submission')::int;
