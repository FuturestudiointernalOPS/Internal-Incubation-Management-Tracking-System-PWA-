-- =============================================================================
-- IMPACTOS — VENTURE OS MENTORING SESSIONS & SCHEDULING
-- Enhancement 3.2 — Mentoring Sessions & Scheduling
-- =============================================================================

-- Mentoring sessions
CREATE TABLE IF NOT EXISTS venture_sessions (
    id SERIAL PRIMARY KEY,
    venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    session_type TEXT NOT NULL DEFAULT 'coaching',
    coach_id INTEGER REFERENCES venture_coaches(id) ON DELETE SET NULL,
    coach_name TEXT,
    founder_cid TEXT,
    founder_name TEXT,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    timezone TEXT DEFAULT 'UTC',
    location TEXT,
    meeting_link TEXT,
    status TEXT DEFAULT 'scheduled',
    agenda TEXT,
    recording_url TEXT,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_venture ON venture_sessions(venture_id);
CREATE INDEX IF NOT EXISTS idx_sessions_coach ON venture_sessions(coach_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON venture_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_start ON venture_sessions(start_time);

-- Session notes
CREATE TABLE IF NOT EXISTS venture_session_notes (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES venture_sessions(id) ON DELETE CASCADE,
    note_type TEXT DEFAULT 'shared', -- shared | private
    content TEXT NOT NULL,
    author_cid TEXT,
    author_name TEXT,
    attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_notes_session ON venture_session_notes(session_id);

-- Session attendance
CREATE TABLE IF NOT EXISTS venture_session_attendance (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES venture_sessions(id) ON DELETE CASCADE,
    participant_cid TEXT NOT NULL,
    participant_name TEXT,
    participant_type TEXT, -- founder | coach | advisor
    status TEXT DEFAULT 'pending', -- attended | absent | late | excused | pending
    timestamp TIMESTAMP DEFAULT NOW(),
    UNIQUE(session_id, participant_cid)
);

CREATE INDEX IF NOT EXISTS idx_session_attendance_session ON venture_session_attendance(session_id);

-- Session action items
CREATE TABLE IF NOT EXISTS venture_session_action_items (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES venture_sessions(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    owner_cid TEXT,
    owner_name TEXT,
    priority TEXT DEFAULT 'medium',
    due_date TIMESTAMP,
    status TEXT DEFAULT 'pending', -- pending | in_progress | completed | cancelled
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_action_items_session ON venture_session_action_items(session_id);

-- Session activity log
CREATE TABLE IF NOT EXISTS venture_session_activity (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES venture_sessions(id) ON DELETE CASCADE,
    venture_id TEXT REFERENCES ventures(venture_id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    actor_cid TEXT,
    actor_name TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_activity_session ON venture_session_activity(session_id);
CREATE INDEX IF NOT EXISTS idx_session_activity_venture ON venture_session_activity(venture_id);

-- =============================================================================
-- LATER COLUMN ADDITIONS
--
-- Columns added after this file was written are applied idempotently by
-- ensureVentureSchema() in src/lib/ventures.js (journey_stage_id, milestone_ref,
-- task_id, preparation_notes, venture_facing, deliverable_id, coach_contact_id,
-- materials, …). They are repeated here so a database provisioned only from the
-- SQL files still ends up with the same shape.
-- =============================================================================

-- Documents the participants need for a session (a deck, a brief), attached
-- while booking. Stored as [{path,name,size}]; the files live in the PRIVATE
-- evidence bucket under a `sessions/` prefix and are signed on read, so only
-- people with Venture access can open them.
ALTER TABLE venture_sessions ADD COLUMN IF NOT EXISTS materials JSONB;
