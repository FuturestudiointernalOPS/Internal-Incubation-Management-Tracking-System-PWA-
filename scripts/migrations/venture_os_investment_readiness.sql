-- =============================================================================
-- IMPACTOS — VENTURE OS INVESTMENT READINESS ASSESSMENT
-- Enhancement 4.1 — Investment Readiness
-- =============================================================================

CREATE TABLE IF NOT EXISTS investment_assessments (
    id SERIAL PRIMARY KEY,
    venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
    overall_score INTEGER NOT NULL DEFAULT 0,
    investment_level TEXT NOT NULL DEFAULT 'not_ready',
    calculated_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investment_assessments_venture ON investment_assessments(venture_id);

CREATE TABLE IF NOT EXISTS investment_scores (
    id SERIAL PRIMARY KEY,
    assessment_id INTEGER NOT NULL REFERENCES investment_assessments(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    weight DECIMAL(5,2) DEFAULT 1.0,
    details JSONB DEFAULT '{}'::jsonb,
    UNIQUE(assessment_id, category)
);

CREATE INDEX IF NOT EXISTS idx_investment_scores_assessment ON investment_scores(assessment_id);

CREATE TABLE IF NOT EXISTS investment_recommendations (
    id SERIAL PRIMARY KEY,
    venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
    assessment_id INTEGER REFERENCES investment_assessments(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium',
    title TEXT NOT NULL,
    description TEXT,
    estimated_effort TEXT,
    expected_impact TEXT,
    resource_id INTEGER REFERENCES knowledge_resources(id) ON DELETE SET NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investment_recommendations_venture ON investment_recommendations(venture_id);

CREATE TABLE IF NOT EXISTS investment_history (
    id SERIAL PRIMARY KEY,
    venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
    previous_score INTEGER,
    new_score INTEGER,
    previous_level TEXT,
    new_level TEXT,
    trigger_event TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investment_history_venture ON investment_history(venture_id);
