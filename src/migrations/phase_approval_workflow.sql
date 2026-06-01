-- ============================================================================
-- PHASE 1-3: PROJECT ASSIGNMENT VALIDATION & APPROVAL WORKFLOW
-- Run this in Supabase SQL Editor
-- ============================================================================

-- 1. Add approval tracking columns to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;

-- 2. Create project_approval_requests table for audit trail
CREATE TABLE IF NOT EXISTS project_approval_requests (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  requester_id TEXT NOT NULL,
  requester_name TEXT DEFAULT '',
  project_id INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMP,
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_approval_status ON tasks(status) WHERE status = 'pending_project_approval';
CREATE INDEX IF NOT EXISTS idx_approval_requests_task ON project_approval_requests(task_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON project_approval_requests(status);
