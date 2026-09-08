-- ============================================================================
-- SUBTASKS SUPPORT
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Add parent_task_id to tasks for subtask support
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE;

-- Index for subtask queries
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);
