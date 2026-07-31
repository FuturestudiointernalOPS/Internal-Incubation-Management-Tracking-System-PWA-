-- =============================================================================
-- Investor OS — Relationship Workspaces & Meeting Management (Enhancement 2.6)
-- =============================================================================

-- 11. RELATIONSHIP WORKSPACES
-- One workspace per investor↔venture relationship after introduction approval.
CREATE TABLE IF NOT EXISTS relationship_workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID NOT NULL REFERENCES investment_pipeline(id) ON DELETE CASCADE,
    investor_id UUID NOT NULL REFERENCES investor_profiles(id) ON DELETE CASCADE,
    venture_id UUID NOT NULL,
    relationship_manager_id TEXT,     -- contacts.cid
    investment_manager_id TEXT,       -- contacts.cid
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'closed')),
    current_stage TEXT,
    next_action TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(pipeline_id)
);

CREATE INDEX IF NOT EXISTS idx_rw_pipeline ON relationship_workspaces(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_rw_investor ON relationship_workspaces(investor_id);
CREATE INDEX IF NOT EXISTS idx_rw_venture ON relationship_workspaces(venture_id);

-- 12. RELATIONSHIP MEETINGS
-- Meetings within a relationship workspace.
CREATE TABLE IF NOT EXISTS relationship_meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES relationship_workspaces(id) ON DELETE CASCADE,
    meeting_type TEXT NOT NULL DEFAULT 'introductory'
        CHECK (meeting_type IN ('introductory', 'follow_up', 'product_demo', 'financial_review', 'dd_session', 'committee', 'closing')),
    scheduled_date DATE,
    scheduled_time TEXT,              -- HH:MM format
    duration_minutes INTEGER DEFAULT 60,
    status TEXT NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'completed', 'cancelled')),
    location TEXT,
    notes TEXT,
    outcome TEXT,
    action_items TEXT,                -- JSON array of action items
    documents_shared TEXT[] DEFAULT '{}',
    next_meeting_id UUID,            -- self-referencing FK added below if needed
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rm_workspace ON relationship_meetings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_rm_status ON relationship_meetings(status);

-- 13. RELATIONSHIP TIMELINE
-- Immutable audit log of every interaction in a relationship workspace.
CREATE TABLE IF NOT EXISTS relationship_timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES relationship_workspaces(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    description TEXT NOT NULL,
    actor_id TEXT,                    -- contacts.cid of who performed the action
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
    -- No UPDATE, no DELETE by design — immutable
);

CREATE INDEX IF NOT EXISTS idx_rt_workspace ON relationship_timeline(workspace_id);
CREATE INDEX IF NOT EXISTS idx_rt_created ON relationship_timeline(created_at);
