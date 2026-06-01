-- ============================================================================
-- PHASE 1: PROJECTS FOUNDATION & STRUCTURED WORK ORGANIZATION
-- Run this in Supabase SQL Editor before deploying the new code.
-- ============================================================================

-- 1. Project Members table
CREATE TABLE IF NOT EXISTS project_members (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES v2_projects(id) ON DELETE CASCADE,
  user_cid TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  assigned_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, user_cid)
);

-- 2. Add category column to tasks (if not already present)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS category TEXT;

-- 3. Work Categories reference table
CREATE TABLE IF NOT EXISTS work_categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

-- 4. Insert default categories
INSERT INTO work_categories (name, label, sort_order) VALUES
  ('project_work', 'Project Work', 1),
  ('internal_operations', 'Internal Operations', 2),
  ('administration', 'Administration', 3),
  ('training', 'Training', 4),
  ('business_development', 'Business Development', 5),
  ('other', 'Other', 6)
ON CONFLICT (name) DO NOTHING;

-- 5. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_members_user_cid ON project_members(user_cid);
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category);
