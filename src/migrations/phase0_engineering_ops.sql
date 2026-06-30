-- =============================================================================
-- PHASE 0: ENGINEERING OPERATIONS FOUNDATION
-- =============================================================================
-- This migration adds:
--   1. priority column to tasks table
--   2. task_id, resolved_at, page, action_attempted columns to error_logs
--   3. Indexes for priority-based sorting
-- =============================================================================

BEGIN;

-- 1. Add priority column to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium'
  CHECK (priority IN ('critical', 'high', 'medium', 'low'));

CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_priority ON tasks(assigned_to, priority);

-- 2. Enhance error_logs table
ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS page TEXT;
ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS action_attempted TEXT;
ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS task_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_error_logs_task_id ON error_logs(task_id);

-- 3. Update the existing severity check constraint to include 'fatal'
-- (PostgreSQL doesn't allow ALTER CHECK, so we need to recreate)
-- Only do this if constraint exists with old values
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'error_logs_severity_check'
  ) THEN
    ALTER TABLE error_logs DROP CONSTRAINT error_logs_severity_check;
    ALTER TABLE error_logs ADD CONSTRAINT error_logs_severity_check
      CHECK (severity IN ('info', 'warning', 'error', 'critical', 'fatal'));
  END IF;
END $$;

COMMIT;
