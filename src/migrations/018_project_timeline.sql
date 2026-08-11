-- =============================================================================
-- IMPACTOS — VENTURE OS PROJECT TIMELINE & PROGRESS TRACKING
-- Enhancement 2.4 — Timeline & Progress
-- =============================================================================

-- Task/Milestone dependencies
CREATE TABLE IF NOT EXISTS venture_dependencies (
    id SERIAL PRIMARY KEY,
    venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
    source_type TEXT NOT NULL, -- 'task' or 'milestone'
    source_id INTEGER NOT NULL,
    target_type TEXT NOT NULL, -- 'task' or 'milestone'
    target_id INTEGER NOT NULL,
    dependency_type TEXT DEFAULT 'finish_to_start',
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(venture_id, source_type, source_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_dependencies_source ON venture_dependencies(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_dependencies_target ON venture_dependencies(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_dependencies_venture ON venture_dependencies(venture_id);

-- Timeline events (for Gantt rendering)
CREATE TABLE IF NOT EXISTS venture_timeline_events (
    id SERIAL PRIMARY KEY,
    venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'milestone', 'task', 'deliverable', 'dependency'
    reference_type TEXT,      -- 'milestone', 'task', 'deliverable'
    reference_id INTEGER,
    title TEXT NOT NULL,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    progress INTEGER DEFAULT 0,
    status TEXT,
    parent_id INTEGER,        -- points to a milestone for tasks/deliverables
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_timeline_events_venture ON venture_timeline_events(venture_id);
