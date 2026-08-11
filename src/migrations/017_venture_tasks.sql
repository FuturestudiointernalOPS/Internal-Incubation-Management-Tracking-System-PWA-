-- =============================================================================
-- IMPACTOS — VENTURE OS TASK MANAGEMENT & KANBAN
-- Enhancement 2.3 — Task Management & Kanban
-- =============================================================================

-- Tasks table
CREATE TABLE IF NOT EXISTS venture_tasks (
    id SERIAL PRIMARY KEY,
    venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
    milestone_id INTEGER REFERENCES venture_milestones(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'backlog',
    priority TEXT NOT NULL DEFAULT 'medium',
    due_date TIMESTAMP,
    estimated_hours DECIMAL(8,2),
    actual_hours DECIMAL(8,2),
    assigned_cid TEXT,
    assigned_name TEXT,
    reporter_cid TEXT,
    reporter_name TEXT,
    labels JSONB DEFAULT '[]'::jsonb,
    checklist JSONB DEFAULT '[]'::jsonb,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venture_tasks_venture_id ON venture_tasks(venture_id);
CREATE INDEX IF NOT EXISTS idx_venture_tasks_milestone_id ON venture_tasks(milestone_id);
CREATE INDEX IF NOT EXISTS idx_venture_tasks_status ON venture_tasks(status);
CREATE INDEX IF NOT EXISTS idx_venture_tasks_assigned_cid ON venture_tasks(assigned_cid);

-- Task comments (threaded)
CREATE TABLE IF NOT EXISTS venture_task_comments (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES venture_tasks(id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES venture_task_comments(id) ON DELETE CASCADE,
    author_cid TEXT NOT NULL,
    author_name TEXT,
    body TEXT NOT NULL,
    is_edited BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON venture_task_comments(task_id);

-- Task attachments
CREATE TABLE IF NOT EXISTS venture_task_attachments (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES venture_tasks(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_size BIGINT,
    file_type TEXT,
    file_url TEXT NOT NULL,
    uploaded_by TEXT,
    uploaded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON venture_task_attachments(task_id);

-- Task activity log
CREATE TABLE IF NOT EXISTS venture_task_activity (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES venture_tasks(id) ON DELETE CASCADE,
    venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    actor_cid TEXT,
    actor_name TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_activity_task_id ON venture_task_activity(task_id);
CREATE INDEX IF NOT EXISTS idx_task_activity_venture_id ON venture_task_activity(venture_id);
