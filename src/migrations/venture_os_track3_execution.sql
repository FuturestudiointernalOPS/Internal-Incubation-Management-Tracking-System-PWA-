-- Sprint 3 Track 3: Venture Execution & Collaboration
-- Reuses existing Operations OS task engine (tasks table already has parent_task_id
-- for subtasks) instead of duplicating it. Adds venture_id so tasks/blockers can be
-- scoped to a Venture team as well as an individual/project.
-- v2_standups/v2_retros are per-user weekly check-ins (existing Operations OS
-- feature) — venture standups/retros are team-level (one per venture per week,
-- not one per user), so they get their own lightweight tables rather than
-- overloading the individual-scoped v2_standups/v2_retros shape.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS venture_id UUID REFERENCES ventures(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_venture ON tasks(venture_id);

ALTER TABLE blockers ADD COLUMN IF NOT EXISTS venture_id UUID REFERENCES ventures(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_blockers_venture ON blockers(venture_id);

CREATE TABLE IF NOT EXISTS venture_standups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  year INTEGER NOT NULL,
  top_priorities TEXT,
  expected_deliverables TEXT,
  weekly_priorities TEXT,
  created_by TEXT REFERENCES contacts(cid),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(venture_id, week_number, year)
);

CREATE TABLE IF NOT EXISTS venture_retros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  year INTEGER NOT NULL,
  completed_tasks TEXT,
  outstanding_tasks TEXT,
  carry_forward_notes TEXT,
  created_by TEXT REFERENCES contacts(cid),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(venture_id, week_number, year)
);

-- Rule 30: blockers may only be created from the Weekly Retro.
ALTER TABLE blockers ADD COLUMN IF NOT EXISTS venture_retro_id UUID REFERENCES venture_retros(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_blockers_venture_retro ON blockers(venture_retro_id);
