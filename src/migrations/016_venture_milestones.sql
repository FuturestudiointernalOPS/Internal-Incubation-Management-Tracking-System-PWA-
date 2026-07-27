-- =============================================================================
-- IMPACTOS — VENTURE OS MILESTONES & DELIVERABLES
-- Enhancement 2.2 — Milestones & Deliverables
-- =============================================================================

-- Milestones table
CREATE TABLE IF NOT EXISTS venture_milestones (
    id SERIAL PRIMARY KEY,
    venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
    project_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'not_started',
    priority TEXT DEFAULT 'medium',
    due_date TIMESTAMP,
    owner_cid TEXT,
    assigned_members JSONB DEFAULT '[]'::jsonb,
    completion_percentage INTEGER DEFAULT 0,
    display_order INTEGER DEFAULT 0,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venture_milestones_venture_id ON venture_milestones(venture_id);
CREATE INDEX IF NOT EXISTS idx_venture_milestones_status ON venture_milestones(status);
CREATE INDEX IF NOT EXISTS idx_venture_milestones_project_id ON venture_milestones(project_id);

-- Deliverables table
CREATE TABLE IF NOT EXISTS venture_deliverables (
    id SERIAL PRIMARY KEY,
    milestone_id INTEGER NOT NULL REFERENCES venture_milestones(id) ON DELETE CASCADE,
    venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    deliverable_type TEXT NOT NULL DEFAULT 'document',
    status TEXT NOT NULL DEFAULT 'pending',
    due_date TIMESTAMP,
    assigned_cid TEXT,
    attachment_url TEXT,
    attachment_name TEXT,
    approval_status TEXT DEFAULT 'pending',
    reviewer_cid TEXT,
    reviewer_name TEXT,
    reviewed_at TIMESTAMP,
    rejection_reason TEXT,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venture_deliverables_milestone_id ON venture_deliverables(milestone_id);
CREATE INDEX IF NOT EXISTS idx_venture_deliverables_status ON venture_deliverables(status);
CREATE INDEX IF NOT EXISTS idx_venture_deliverables_venture_id ON venture_deliverables(venture_id);

-- Deliverable reviews (approval history)
CREATE TABLE IF NOT EXISTS venture_deliverable_reviews (
    id SERIAL PRIMARY KEY,
    deliverable_id INTEGER NOT NULL REFERENCES venture_deliverables(id) ON DELETE CASCADE,
    reviewer_cid TEXT NOT NULL,
    reviewer_name TEXT,
    decision TEXT NOT NULL,
    comments TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deliverable_reviews_deliverable_id ON venture_deliverable_reviews(deliverable_id);

-- Milestone activity log
CREATE TABLE IF NOT EXISTS venture_milestone_activity (
    id SERIAL PRIMARY KEY,
    venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
    milestone_id INTEGER REFERENCES venture_milestones(id) ON DELETE SET NULL,
    deliverable_id INTEGER REFERENCES venture_deliverables(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    actor_cid TEXT,
    actor_name TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_milestone_activity_venture_id ON venture_milestone_activity(venture_id);
CREATE INDEX IF NOT EXISTS idx_milestone_activity_milestone_id ON venture_milestone_activity(milestone_id);
