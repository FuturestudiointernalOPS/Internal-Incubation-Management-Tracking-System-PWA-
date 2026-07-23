-- =============================================================================
-- IMPACTOS — VENTURE OS TABLES
-- Enhancement 1.1 — Workflow B: Direct Startup Registration
-- =============================================================================

-- Ventures table (core entity)
CREATE TABLE IF NOT EXISTS ventures (
    id SERIAL PRIMARY KEY,
    venture_id TEXT NOT NULL UNIQUE,
    company_name TEXT NOT NULL,
    registration_number TEXT,
    industry TEXT NOT NULL,
    business_stage TEXT NOT NULL,
    description TEXT,
    website TEXT,
    logo_url TEXT,
    status TEXT DEFAULT 'active',
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ventures_venture_id ON ventures(venture_id);
CREATE INDEX IF NOT EXISTS idx_ventures_company_name ON ventures(company_name);
CREATE INDEX IF NOT EXISTS idx_ventures_status ON ventures(status);

-- Venture founders
CREATE TABLE IF NOT EXISTS venture_founders (
    id SERIAL PRIMARY KEY,
    venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    title TEXT,
    invitation_token TEXT,
    invitation_sent_at TIMESTAMP,
    invitation_accepted_at TIMESTAMP,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(venture_id, email)
);

CREATE INDEX IF NOT EXISTS idx_venture_founders_venture_id ON venture_founders(venture_id);
CREATE INDEX IF NOT EXISTS idx_venture_founders_email ON venture_founders(email);

-- Venture members
CREATE TABLE IF NOT EXISTS venture_members (
    id SERIAL PRIMARY KEY,
    venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
    user_cid TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(venture_id, user_cid)
);

CREATE INDEX IF NOT EXISTS idx_venture_members_venture_id ON venture_members(venture_id);
CREATE INDEX IF NOT EXISTS idx_venture_members_user_cid ON venture_members(user_cid);

-- Venture history (startup profile wizard progress, milestones)
CREATE TABLE IF NOT EXISTS venture_history (
    id SERIAL PRIMARY KEY,
    venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venture_history_venture_id ON venture_history(venture_id);
CREATE INDEX IF NOT EXISTS idx_venture_history_event_type ON venture_history(event_type);

-- Venture activity log
CREATE TABLE IF NOT EXISTS venture_activity_log (
    id SERIAL PRIMARY KEY,
    venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    actor_cid TEXT NOT NULL,
    actor_name TEXT,
    details JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venture_activity_log_venture_id ON venture_activity_log(venture_id);
CREATE INDEX IF NOT EXISTS idx_venture_activity_log_action ON venture_activity_log(action);
