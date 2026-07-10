-- =============================================================================
-- SPRINT 2, TRACK 5 — Completion Architecture
-- Ticket 6.2 (Historical Records), 6.4 (Venture Recommendation), 6.5 (Alumni)
-- =============================================================================

-- ─── 6.2 Historical Records ───
-- Preserve participant completion records when a program is marked as completed.
-- Each row is one participant's completion snapshot for one program.

CREATE TABLE IF NOT EXISTS program_completion_records (
  id SERIAL PRIMARY KEY,
  program_id TEXT NOT NULL,
  participant_id TEXT NOT NULL,
  participant_name TEXT,
  completion_status TEXT NOT NULL DEFAULT 'completed'
    CHECK (completion_status IN ('completed', 'incomplete', 'withdrawn', 'graduated')),
  deliverables_completed INTEGER DEFAULT 0,
  deliverables_total INTEGER DEFAULT 0,
  attendance_rate DECIMAL(5,2) DEFAULT 0,
  final_feedback TEXT,
  coach_notes TEXT,
  completed_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(program_id, participant_id)
);

CREATE INDEX IF NOT EXISTS idx_completion_records_program ON program_completion_records(program_id);
CREATE INDEX IF NOT EXISTS idx_completion_records_participant ON program_completion_records(participant_id);

-- ─── 6.4 Venture Recommendation ───
-- Manual recommendation workflow — no automatic transition.
-- PM recommends a team → admin reviews → approved/rejected.

CREATE TABLE IF NOT EXISTS venture_recommendations (
  id SERIAL PRIMARY KEY,
  program_id TEXT NOT NULL,
  team_id INTEGER NOT NULL,
  team_name TEXT,
  recommended_by TEXT NOT NULL,
  recommended_by_name TEXT,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'under_review', 'approved', 'rejected')),
  reviewed_by TEXT,
  reviewed_by_name TEXT,
  review_notes TEXT,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venture_recs_program ON venture_recommendations(program_id);
CREATE INDEX IF NOT EXISTS idx_venture_recs_team ON venture_recommendations(team_id);
CREATE INDEX IF NOT EXISTS idx_venture_recs_status ON venture_recommendations(status);

-- ─── 6.5 Alumni Engagement ───
-- Tracks alumni status per participant.
-- Alumni remain in the ecosystem and can join future programs.

CREATE TABLE IF NOT EXISTS alumni_records (
  id SERIAL PRIMARY KEY,
  participant_id TEXT NOT NULL UNIQUE,
  participant_name TEXT,
  participant_email TEXT,
  graduated_program_id TEXT,
  graduated_program_name TEXT,
  alumni_since TIMESTAMP DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'engaged')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alumni_participant ON alumni_records(participant_id);
CREATE INDEX IF NOT EXISTS idx_alumni_status ON alumni_records(status);
