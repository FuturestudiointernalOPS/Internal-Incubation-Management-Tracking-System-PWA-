-- =============================================================================
-- IMPACTOS — VENTURE OS FUNDRAISING PIPELINE
-- Enhancement 4.4 — Fundraising Pipeline
-- =============================================================================

-- Fundraising opportunities
CREATE TABLE IF NOT EXISTS fundraising_opportunities (
    id SERIAL PRIMARY KEY,
    venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
    investor_id INTEGER REFERENCES venture_investors(id) ON DELETE SET NULL,
    investor_name TEXT,
    investor_email TEXT,
    stage TEXT NOT NULL DEFAULT 'prospect',
    expected_amount DECIMAL(14,2),
    currency TEXT DEFAULT 'USD',
    probability INTEGER DEFAULT 10,
    expected_close_date DATE,
    owner_cid TEXT,
    owner_name TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    next_action TEXT,
    next_action_date TIMESTAMP,
    notes_summary TEXT,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fundraising_venture ON fundraising_opportunities(venture_id);
CREATE INDEX IF NOT EXISTS idx_fundraising_stage ON fundraising_opportunities(stage);

-- Stage history (append-only)
CREATE TABLE IF NOT EXISTS fundraising_stage_history (
    id SERIAL PRIMARY KEY,
    opportunity_id INTEGER NOT NULL REFERENCES fundraising_opportunities(id) ON DELETE CASCADE,
    previous_stage TEXT,
    new_stage TEXT NOT NULL,
    probability INTEGER,
    changed_by TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stage_history_opp ON fundraising_stage_history(opportunity_id);

-- Activities
CREATE TABLE IF NOT EXISTS fundraising_activities (
    id SERIAL PRIMARY KEY,
    opportunity_id INTEGER NOT NULL REFERENCES fundraising_opportunities(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    activity_date TIMESTAMP DEFAULT NOW(),
    completed BOOLEAN DEFAULT FALSE,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fundraising_activities_opp ON fundraising_activities(opportunity_id);

-- Notes
CREATE TABLE IF NOT EXISTS fundraising_notes (
    id SERIAL PRIMARY KEY,
    opportunity_id INTEGER NOT NULL REFERENCES fundraising_opportunities(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    author_cid TEXT,
    author_name TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fundraising_notes_opp ON fundraising_notes(opportunity_id);
