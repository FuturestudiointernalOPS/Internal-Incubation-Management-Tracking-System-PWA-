-- =============================================================================
-- Investor OS — Fundraising Campaigns (Enhancement 2.4)
-- Sprint 4 — Campaign lifecycle management
-- =============================================================================

CREATE TABLE IF NOT EXISTS fundraising_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venture_id UUID NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'active', 'paused', 'closed')),
    target_raise DECIMAL(15,2),
    current_raised DECIMAL(15,2) DEFAULT 0,
    min_investment DECIMAL(15,2),
    max_investment DECIMAL(15,2),
    currency TEXT DEFAULT 'USD',
    visibility TEXT NOT NULL DEFAULT 'public'
        CHECK (visibility IN ('public', 'invite_only', 'private')),
    opening_date DATE,
    closing_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fc_venture ON fundraising_campaigns(venture_id);
CREATE INDEX IF NOT EXISTS idx_fc_status ON fundraising_campaigns(status);
