-- =============================================================================
-- IMPACTOS — VENTURE OS INVESTOR MATCHING
-- Enhancement 4.2 — Investor Matching
-- =============================================================================

-- Investors
CREATE TABLE IF NOT EXISTS venture_investors (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    photo_url TEXT,
    organization TEXT,
    investment_thesis TEXT,
    industries JSONB DEFAULT '[]'::jsonb,
    preferred_countries JSONB DEFAULT '[]'::jsonb,
    preferred_stage TEXT, -- idea | validation | early_traction | growth | scaling
    min_ticket DECIMAL(12,2),
    max_ticket DECIMAL(12,2),
    portfolio JSONB DEFAULT '[]'::jsonb,
    website_url TEXT,
    linkedin_url TEXT,
    status TEXT DEFAULT 'active',
    created_by TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venture_investors_status ON venture_investors(status);
CREATE INDEX IF NOT EXISTS idx_venture_investors_industries ON venture_investors USING gin(industries);

-- Investor preferences (detailed matching criteria)
CREATE TABLE IF NOT EXISTS venture_investor_preferences (
    id SERIAL PRIMARY KEY,
    investor_id INTEGER NOT NULL UNIQUE REFERENCES venture_investors(id) ON DELETE CASCADE,
    min_team_size INTEGER DEFAULT 1,
    min_traction_score INTEGER DEFAULT 0,
    min_readiness_score INTEGER DEFAULT 0,
    esg_focus BOOLEAN DEFAULT FALSE,
    technology_focus JSONB DEFAULT '[]'::jsonb,
    business_model_focus JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Investor-Venture matches
CREATE TABLE IF NOT EXISTS venture_investor_matches (
    id SERIAL PRIMARY KEY,
    venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
    investor_id INTEGER NOT NULL REFERENCES venture_investors(id) ON DELETE CASCADE,
    match_score INTEGER NOT NULL DEFAULT 0,
    match_reasons JSONB DEFAULT '[]'::jsonb,
    strengths JSONB DEFAULT '[]'::jsonb,
    weaknesses JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'pending', -- pending | viewed | contacted | accepted | rejected
    viewed_by_founder BOOLEAN DEFAULT FALSE,
    contacted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(venture_id, investor_id)
);

CREATE INDEX IF NOT EXISTS idx_investor_matches_venture ON venture_investor_matches(venture_id);
CREATE INDEX IF NOT EXISTS idx_investor_matches_investor ON venture_investor_matches(investor_id);
CREATE INDEX IF NOT EXISTS idx_investor_matches_score ON venture_investor_matches(match_score DESC);

-- Match history / activity
CREATE TABLE IF NOT EXISTS venture_match_history (
    id SERIAL PRIMARY KEY,
    match_id INTEGER REFERENCES venture_investor_matches(id) ON DELETE CASCADE,
    venture_id TEXT REFERENCES ventures(venture_id) ON DELETE CASCADE,
    investor_id INTEGER REFERENCES venture_investors(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
);
