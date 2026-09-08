-- =============================================================================
-- Migration: Team Tasks & Venture Transition Support
-- Sprint 2 — Track 4
-- =============================================================================

-- 1. Team Tasks table (lightweight task board for teams)
CREATE TABLE IF NOT EXISTS team_tasks (
  id SERIAL PRIMARY KEY,
  team_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'medium',
  assigned_to TEXT,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_tasks_team_id ON team_tasks(team_id);
CREATE INDEX IF NOT EXISTS idx_team_tasks_status ON team_tasks(status);

-- 2. Add is_venture_ready to v2_teams
ALTER TABLE v2_teams ADD COLUMN IF NOT EXISTS is_venture_ready BOOLEAN DEFAULT FALSE;

-- 3. Add team_id to v2_followups for team coaching
ALTER TABLE v2_followups ADD COLUMN IF NOT EXISTS team_id TEXT;
ALTER TABLE v2_followups ADD COLUMN IF NOT EXISTS submission_id INTEGER;
ALTER TABLE v2_followups ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP;
ALTER TABLE v2_followups ADD COLUMN IF NOT EXISTS followup_type TEXT DEFAULT 'coaching';

CREATE INDEX IF NOT EXISTS idx_v2_followups_team_id ON v2_followups(team_id);
