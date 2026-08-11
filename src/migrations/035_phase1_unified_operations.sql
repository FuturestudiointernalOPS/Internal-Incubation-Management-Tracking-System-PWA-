-- Phase 1: Unified Operations — Schema Extension
-- Adds context_type, context_id, supervisor_id, intent_id to operational tables.
-- Creates the intents table.
-- Non-destructive: only ADD COLUMN and CREATE TABLE.

--------------------------------------------------------------------------------
-- 1. Extend tasks table
--------------------------------------------------------------------------------
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS context_type TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS context_id TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS supervisor_id TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS intent_id UUID;

-- Constraint after columns exist (skip if already exists)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_tasks_context_type'
  ) THEN
    ALTER TABLE tasks ADD CONSTRAINT chk_tasks_context_type
      CHECK (context_type IS NULL OR context_type IN ('staff','venture','participant'));
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_context ON tasks(context_type, context_id);
CREATE INDEX IF NOT EXISTS idx_tasks_intent ON tasks(intent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_supervisor ON tasks(supervisor_id);

--------------------------------------------------------------------------------
-- 2. Extend v2_op_reports table
--------------------------------------------------------------------------------
ALTER TABLE v2_op_reports ADD COLUMN IF NOT EXISTS context_type TEXT;
ALTER TABLE v2_op_reports ADD COLUMN IF NOT EXISTS context_id TEXT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_op_reports_context_type'
  ) THEN
    ALTER TABLE v2_op_reports ADD CONSTRAINT chk_op_reports_context_type
      CHECK (context_type IS NULL OR context_type IN ('staff','venture','participant'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_op_reports_context ON v2_op_reports(context_type, context_id);

--------------------------------------------------------------------------------
-- 3. Extend blockers table
--------------------------------------------------------------------------------
ALTER TABLE blockers ADD COLUMN IF NOT EXISTS context_type TEXT;
ALTER TABLE blockers ADD COLUMN IF NOT EXISTS context_id TEXT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_blockers_context_type'
  ) THEN
    ALTER TABLE blockers ADD CONSTRAINT chk_blockers_context_type
      CHECK (context_type IS NULL OR context_type IN ('staff','venture','participant'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_blockers_context ON blockers(context_type, context_id);

--------------------------------------------------------------------------------
-- 4. Create intents table
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    responsible_id TEXT NOT NULL,
    context_type TEXT NOT NULL DEFAULT 'staff'
        CHECK (context_type IN ('staff','venture','participant')),
    context_id TEXT,
    contact_group_id INTEGER,
    project_id TEXT,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active','completed','paused','cancelled')),
    start_date DATE,
    target_date DATE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intents_responsible ON intents(responsible_id);
CREATE INDEX IF NOT EXISTS idx_intents_context ON intents(context_type, context_id);
CREATE INDEX IF NOT EXISTS idx_intents_project ON intents(project_id);
CREATE INDEX IF NOT EXISTS idx_intents_status ON intents(status);

--------------------------------------------------------------------------------
-- 5. Backfill existing data
--    All existing tasks, op_reports, and blockers are staff-internal.
--------------------------------------------------------------------------------
UPDATE tasks SET context_type = 'staff' WHERE context_type IS NULL;
UPDATE v2_op_reports SET context_type = 'staff' WHERE context_type IS NULL;
UPDATE blockers SET context_type = 'staff' WHERE context_type IS NULL;

-- For tasks that have a venture_id, set context to venture
UPDATE tasks SET
  context_type = 'venture',
  context_id = venture_id::text
WHERE venture_id IS NOT NULL AND context_type = 'staff';

-- For blockers with venture_id, backfill context
UPDATE blockers SET
  context_type = 'venture',
  context_id = venture_id::text
WHERE venture_id IS NOT NULL AND context_type = 'staff';
