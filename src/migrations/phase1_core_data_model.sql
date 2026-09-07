-- ============================================================================
-- PHASE 1: CORE DATA MODEL FOUNDATION
-- Run this in Supabase SQL Editor after phase1_projects.sql
-- Adds audit fields to tasks and creates dedicated task_audit_logs table.
-- ============================================================================

-- 1. Add audit columns to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS first_scheduled_start_date TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS first_scheduled_end_date TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reschedule_count INTEGER DEFAULT 0;

-- 2. Task-specific audit log table (dedicated, notion-sync ready)
CREATE TABLE IF NOT EXISTS task_audit_logs (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT DEFAULT '',
  action TEXT NOT NULL,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  metadata TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_task_audit_logs_task_id ON task_audit_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_audit_logs_created_at ON task_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_reschedule ON tasks(reschedule_count);
