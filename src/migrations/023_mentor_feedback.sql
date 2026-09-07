-- =============================================================================
-- IMPACTOS — VENTURE OS MENTOR PERFORMANCE, FEEDBACK & ANALYTICS
-- Enhancement 3.5 — Feedback & Analytics
-- =============================================================================

-- Mentor feedback (per session)
CREATE TABLE IF NOT EXISTS venture_mentor_feedback (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES venture_sessions(id) ON DELETE CASCADE,
    venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
    coach_id INTEGER REFERENCES venture_coaches(id) ON DELETE SET NULL,
    founder_cid TEXT,
    rating_overall INTEGER NOT NULL CHECK (rating_overall >= 1 AND rating_overall <= 5),
    rating_communication INTEGER CHECK (rating_communication >= 1 AND rating_communication <= 5),
    rating_expertise INTEGER CHECK (rating_expertise >= 1 AND rating_expertise <= 5),
    rating_availability INTEGER CHECK (rating_availability >= 1 AND rating_availability <= 5),
    rating_helpfulness INTEGER CHECK (rating_helpfulness >= 1 AND rating_helpfulness <= 5),
    comments TEXT,
    is_anonymous BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(session_id, coach_id)
);

CREATE INDEX IF NOT EXISTS idx_feedback_coach ON venture_mentor_feedback(coach_id);
CREATE INDEX IF NOT EXISTS idx_feedback_session ON venture_mentor_feedback(session_id);
CREATE INDEX IF NOT EXISTS idx_feedback_venture ON venture_mentor_feedback(venture_id);

-- Mentor analytics cache (updated on feedback submit)
CREATE TABLE IF NOT EXISTS venture_mentor_analytics (
    id SERIAL PRIMARY KEY,
    coach_id INTEGER NOT NULL UNIQUE REFERENCES venture_coaches(id) ON DELETE CASCADE,
    coach_type TEXT NOT NULL,
    average_rating DECIMAL(3,2) DEFAULT 0,
    sessions_completed INTEGER DEFAULT 0,
    attendance_rate DECIMAL(5,2) DEFAULT 0,
    cancellation_rate DECIMAL(5,2) DEFAULT 0,
    assigned_ventures INTEGER DEFAULT 0,
    completed_action_items INTEGER DEFAULT 0,
    mentoring_hours DECIMAL(8,2) DEFAULT 0,
    founder_satisfaction DECIMAL(3,2) DEFAULT 0,
    engagement_score DECIMAL(5,2) DEFAULT 0,
    last_calculated TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mentor_analytics_coach ON venture_mentor_analytics(coach_id);

-- Feedback activity log
CREATE TABLE IF NOT EXISTS venture_feedback_activity (
    id SERIAL PRIMARY KEY,
    feedback_id INTEGER REFERENCES venture_mentor_feedback(id) ON DELETE SET NULL,
    coach_id INTEGER REFERENCES venture_coaches(id) ON DELETE SET NULL,
    venture_id TEXT REFERENCES ventures(venture_id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    actor_cid TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
);
