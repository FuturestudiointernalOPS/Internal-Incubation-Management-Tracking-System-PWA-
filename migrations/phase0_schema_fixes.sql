-- Phase 0: Schema Drift Resolution — Additive migrations only
-- Safe: uses IF NOT EXISTS — no-ops if columns already exist

-- =============================================================================
-- v2_attendance — ensure all columns needed by attendance/route.js exist
-- =============================================================================
ALTER TABLE v2_attendance ADD COLUMN IF NOT EXISTS program_id TEXT;
ALTER TABLE v2_attendance ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE;
ALTER TABLE v2_attendance ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- =============================================================================
-- contacts — add columns referenced by multiple routes
-- =============================================================================
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS archived_by TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS deleted_by TEXT;

-- =============================================================================
-- families — add columns referenced by families/route.js
-- =============================================================================
ALTER TABLE families ADD COLUMN IF NOT EXISTS is_archived INTEGER DEFAULT 0;

-- =============================================================================
-- Indexes for new/verified columns
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_contacts_archived_at ON contacts(archived_at) WHERE archived_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_deleted_at ON contacts(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attendance_session ON v2_attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_participant ON v2_attendance(participant_id);
CREATE INDEX IF NOT EXISTS idx_attendance_program ON v2_attendance(program_id) WHERE program_id IS NOT NULL;
