-- Multi-Program Participant Support
-- Enables many-to-many relationship between participants and programs

CREATE TABLE IF NOT EXISTS participant_programs (
  id SERIAL PRIMARY KEY,
  participant_id TEXT NOT NULL,
  program_id TEXT NOT NULL,
  assigned_by TEXT,
  assigned_at TIMESTAMP DEFAULT NOW(),
  source TEXT DEFAULT 'manual',
  UNIQUE(participant_id, program_id)
);

-- Allow NULL program_id in contacts (for participants in multiple programs)
-- Already nullable, just ensure it stays that way

-- Audit log table
CREATE TABLE IF NOT EXISTS participant_program_audit (
  id SERIAL PRIMARY KEY,
  participant_id TEXT NOT NULL,
  program_id TEXT,
  action TEXT NOT NULL,
  performed_by TEXT,
  source TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
