-- ============================================================================
-- MIGRATION: Fix tasks.project_id type from INTEGER to TEXT
--
-- The v2_projects table uses UUID primary keys, but tasks.project_id
-- was INTEGER, causing project links to break silently (parseInt(UUID) = NaN).
-- ============================================================================

-- Step 1: Add a new TEXT column
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS project_id_text TEXT;

-- Step 2: Copy existing integer values as text (if any valid IDs exist)
UPDATE tasks SET project_id_text = CAST(project_id AS TEXT) WHERE project_id IS NOT NULL;

-- Step 3: Drop the old integer column and rename the new one
ALTER TABLE tasks DROP COLUMN project_id;
ALTER TABLE tasks RENAME COLUMN project_id_text TO project_id;

-- Step 4: Rebuild the index
DROP INDEX IF EXISTS idx_tasks_project_id;
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
