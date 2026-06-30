-- =============================================================================
-- RESPONSIBILITIES — Operational ownership independent from roles & permissions
-- =============================================================================
-- Responsibilities determine what dashboards, navigation, and reports a user
-- sees. They are NOT permissions — they define ownership.
--
-- Examples:
--   - Engineering → Engineering Dashboard, Error Logs, Developer Tools
--   - Program Management → Programs, Participants, Submissions
--   - Project Ownership → Projects, Tasks, Project Reporting
--   - Communications → Messaging, Campaigns, Contacts
--   - Finance → Finance Module
-- =============================================================================

BEGIN;

-- 1. Responsibilities definition table
CREATE TABLE IF NOT EXISTS responsibilities (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    key TEXT NOT NULL UNIQUE,       -- machine-readable slug (e.g. 'engineering')
    description TEXT DEFAULT '',
    icon TEXT DEFAULT '',           -- optional icon identifier for UI
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. User → Responsibility assignments (many-to-many)
CREATE TABLE IF NOT EXISTS user_responsibilities (
    id SERIAL PRIMARY KEY,
    user_cid TEXT NOT NULL REFERENCES contacts(cid) ON DELETE CASCADE,
    responsibility_id INTEGER NOT NULL REFERENCES responsibilities(id) ON DELETE CASCADE,
    assigned_by TEXT,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_cid, responsibility_id)
);

CREATE INDEX IF NOT EXISTS idx_user_resp_cid ON user_responsibilities(user_cid);
CREATE INDEX IF NOT EXISTS idx_user_resp_id ON user_responsibilities(responsibility_id);

COMMIT;
