-- =============================================================================
-- TRACK 2+3 — Curriculum & Participants, Deliverables & Coaching (Sprint 2)
-- =============================================================================
-- Adds missing Track 2 columns (curriculum management) + Track 3 features
-- (submission versioning, evaluation models, follow-up meetings).
-- =============================================================================

-- =============================================================================
-- PART 1: TRACK 2 — CURRICULUM MANAGEMENT (missing columns)
-- =============================================================================

-- 1. Extend v2_sessions with Track 2 curriculum fields
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

-- 2. Extend v2_document_requirements with Track 2 fields
ALTER TABLE v2_document_requirements ADD COLUMN IF NOT EXISTS session_id INTEGER;
ALTER TABLE v2_document_requirements ADD COLUMN IF NOT EXISTS allowed_format TEXT DEFAULT 'pdf';
ALTER TABLE v2_document_requirements ADD COLUMN IF NOT EXISTS weight INTEGER DEFAULT 1;
ALTER TABLE v2_document_requirements ADD COLUMN IF NOT EXISTS kpi_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE v2_document_requirements ADD COLUMN IF NOT EXISTS week_number INTEGER;

-- 3. Extend v2_programs with Track 2 fields (if not already present)
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

-- =============================================================================
-- PART 2: TRACK 3 — SUBMISSION VERSIONING
-- =============================================================================

-- 1. SUBMISSION VERSIONING
-- Add version tracking to v2_submissions so previous submissions are preserved.
ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS version_number INTEGER NOT NULL DEFAULT 1;
ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS supporting_url TEXT;
ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS review_action TEXT; -- 'approved', 'revision_requested', 'rejected', 'followup_scheduled'
ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;

-- Add new statuses: revision_requested, pending_followup
-- (existing: pending, approved, rejected)

-- 2. DROP & RECREATE the CHECK constraint to include new statuses
ALTER TABLE v2_submissions DROP CONSTRAINT IF EXISTS v2_submissions_status_check;
ALTER TABLE v2_submissions ADD CONSTRAINT v2_submissions_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'revision_requested', 'pending_followup'));

-- 3. EVALUATION MODELS
-- Extend v2_programs grading_mode to support academic and incubation modes
ALTER TABLE v2_programs DROP CONSTRAINT IF EXISTS v2_programs_grading_mode_check;
ALTER TABLE v2_programs ADD CONSTRAINT v2_programs_grading_mode_check
  CHECK (grading_mode IN ('graded', 'review', 'followup', 'academic', 'incubation'));

-- Add evaluation configuration JSON field for program-level evaluation settings
ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS evaluation_config JSONB DEFAULT '{}'::jsonb;
-- evaluation_config examples:
-- Academic: { "type": "academic", "max_score": 100, "passing_score": 60, "scale": "numeric" }
-- Incubation: { "type": "incubation", "dimensions": ["idea", "execution", "market", "team", "traction"], "scale": "1-5" }

-- 4. FOLLOW-UP MEETINGS
-- Extend v2_followups to support full meeting scheduling
ALTER TABLE v2_followups ADD COLUMN IF NOT EXISTS participant_id UUID REFERENCES v2_participants(id) ON DELETE CASCADE;
ALTER TABLE v2_followups ADD COLUMN IF NOT EXISTS submission_id UUID REFERENCES v2_submissions(id) ON DELETE CASCADE;
ALTER TABLE v2_followups ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE v2_followups ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 30;
ALTER TABLE v2_followups ADD COLUMN IF NOT EXISTS meeting_link TEXT;
ALTER TABLE v2_followups ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'scheduled'; -- scheduled, completed, cancelled
ALTER TABLE v2_followups ADD COLUMN IF NOT EXISTS notes TEXT;

-- 5. ATTENDANCE KPI LINKAGE
-- Add kpi_id to attendance table for KPI integration
ALTER TABLE v2_attendance ADD COLUMN IF NOT EXISTS kpi_id INTEGER REFERENCES v2_kpis(id) ON DELETE SET NULL;

-- 6. ADD document_id to v2_submissions for Track 2 compatibility
-- Track 2 creates deliverables in v2_document_requirements (INTEGER ids)
-- Track 3 submissions need to reference these properly
ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS document_id INTEGER REFERENCES v2_document_requirements(id) ON DELETE CASCADE;

-- 7. INDEXES
CREATE INDEX IF NOT EXISTS idx_v2_submissions_participant_deliverable
  ON v2_submissions(participant_id, deliverable_id);
CREATE INDEX IF NOT EXISTS idx_v2_submissions_version
  ON v2_submissions(participant_id, deliverable_id, version_number);
CREATE INDEX IF NOT EXISTS idx_v2_followups_participant
  ON v2_followups(participant_id);
CREATE INDEX IF NOT EXISTS idx_v2_followups_submission
  ON v2_followups(submission_id);
