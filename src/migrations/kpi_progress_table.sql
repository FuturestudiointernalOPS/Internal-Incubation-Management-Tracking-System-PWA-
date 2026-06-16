-- =============================================================================
-- KPI PROGRESS TABLE: Persistent KPI progress tracking
--
-- Instead of calculating KPI progress dynamically on every page load,
-- this table stores pre-computed progress that gets updated incrementally
-- whenever a session is completed or a document requirement is toggled.
-- =============================================================================

CREATE TABLE IF NOT EXISTS kpi_progress (
    id SERIAL PRIMARY KEY,
    kpi_id INTEGER NOT NULL REFERENCES v2_kpis(id) ON DELETE CASCADE,
    program_id TEXT NOT NULL,
    linked_sessions INTEGER DEFAULT 0,
    completed_sessions INTEGER DEFAULT 0,
    linked_docs INTEGER DEFAULT 0,
    completed_docs INTEGER DEFAULT 0,
    total_items INTEGER DEFAULT 0,
    completed_items INTEGER DEFAULT 0,
    progress DECIMAL(5,2) DEFAULT 0,
    weight DECIMAL(5,2) DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(kpi_id, program_id)
);

-- Index for fast lookups by program
CREATE INDEX IF NOT EXISTS idx_kpi_progress_program_id ON kpi_progress(program_id);
CREATE INDEX IF NOT EXISTS idx_kpi_progress_kpi_id ON kpi_progress(kpi_id);
