-- =============================================================================
-- IMPACTOS — VENTURE OS RESOURCE RECOMMENDATIONS & LEARNING PROGRESS
-- Enhancement 3.4 — Learning Progress
-- =============================================================================

-- Learning paths
CREATE TABLE IF NOT EXISTS learning_paths (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    level TEXT NOT NULL DEFAULT 'beginner', -- beginner | intermediate | advanced
    category_id INTEGER REFERENCES knowledge_categories(id) ON DELETE SET NULL,
    resource_ids JSONB DEFAULT '[]'::jsonb,
    estimated_hours DECIMAL(8,2),
    is_active BOOLEAN DEFAULT TRUE,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Learning path assignments (venture-level)
CREATE TABLE IF NOT EXISTS learning_path_assignments (
    id SERIAL PRIMARY KEY,
    venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
    path_id INTEGER NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
    assigned_by TEXT,
    assigned_at TIMESTAMP DEFAULT NOW(),
    status TEXT DEFAULT 'active', -- active | completed | paused
    UNIQUE(venture_id, path_id)
);

-- Recommendation log (to avoid duplicate recommendations)
CREATE TABLE IF NOT EXISTS learning_recommendation_log (
    id SERIAL PRIMARY KEY,
    venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
    resource_id INTEGER REFERENCES knowledge_resources(id) ON DELETE CASCADE,
    reason TEXT, -- stage_based | industry_based | completion_based | coach_recommended | popular
    score DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(venture_id, resource_id)
);
