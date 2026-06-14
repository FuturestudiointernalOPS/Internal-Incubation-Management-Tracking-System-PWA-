-- ============================================================================
-- PHASE: PARTICIPANT RITUALS
-- Tables for standups, check-ins, retrospectives, and reflections.
-- Run this in Supabase SQL Editor before deploying Module 3 code.
-- ============================================================================

-- 1. Standups — daily/weekly standup submissions
CREATE TABLE IF NOT EXISTS v2_standups (
  id SERIAL PRIMARY KEY,
  participant_id TEXT NOT NULL,
  program_id TEXT NOT NULL,
  week_number INTEGER DEFAULT 1,
  what_done TEXT DEFAULT '',
  what_today TEXT DEFAULT '',
  blockers TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Check-ins — session/participation check-ins
CREATE TABLE IF NOT EXISTS v2_checkins (
  id SERIAL PRIMARY KEY,
  participant_id TEXT NOT NULL,
  program_id TEXT NOT NULL,
  session_id INTEGER,
  week_number INTEGER DEFAULT 1,
  status TEXT DEFAULT 'checked_in' CHECK (status IN ('checked_in', 'absent', 'excused')),
  notes TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Retrospectives — end-of-week reviews
CREATE TABLE IF NOT EXISTS v2_retros (
  id SERIAL PRIMARY KEY,
  participant_id TEXT NOT NULL,
  program_id TEXT NOT NULL,
  week_number INTEGER DEFAULT 1,
  went_well TEXT DEFAULT '',
  improve TEXT DEFAULT '',
  action_items TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Reflections — learning reflections
CREATE TABLE IF NOT EXISTS v2_reflections (
  id SERIAL PRIMARY KEY,
  participant_id TEXT NOT NULL,
  program_id TEXT NOT NULL,
  week_number INTEGER DEFAULT 1,
  learnings TEXT DEFAULT '',
  challenges TEXT DEFAULT '',
  suggestions TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_standups_participant ON v2_standups(participant_id);
CREATE INDEX IF NOT EXISTS idx_standups_program ON v2_standups(program_id);
CREATE INDEX IF NOT EXISTS idx_checkins_participant ON v2_checkins(participant_id);
CREATE INDEX IF NOT EXISTS idx_checkins_program ON v2_checkins(program_id);
CREATE INDEX IF NOT EXISTS idx_retros_participant ON v2_retros(participant_id);
CREATE INDEX IF NOT EXISTS idx_retros_program ON v2_retros(program_id);
CREATE INDEX IF NOT EXISTS idx_reflections_participant ON v2_reflections(participant_id);
CREATE INDEX IF NOT EXISTS idx_reflections_program ON v2_reflections(program_id);
