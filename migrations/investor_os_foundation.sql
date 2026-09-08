-- =============================================================================
-- Investor OS — Step 0: Foundational Contracts
-- Sprint 4 — Tables shared across all 5 tracks
-- =============================================================================

-- 1. INVESTOR PROFILES
-- Every investor has exactly one profile. Profile controls access to Investor OS.
CREATE TABLE IF NOT EXISTS investor_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES contacts(cid) ON DELETE CASCADE,
    approval_status TEXT NOT NULL DEFAULT 'pending_review'
        CHECK (approval_status IN ('pending_review', 'approved', 'rejected', 'suspended')),
    organization_name TEXT,
    biography TEXT,
    website TEXT,
    linkedin TEXT,
    photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investor_profiles_user ON investor_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_investor_profiles_status ON investor_profiles(approval_status);

-- 2. INVESTMENT PREFERENCES
-- Stores investor's industry/stage/geo/ticket-size interests for venture matching.
CREATE TABLE IF NOT EXISTS investor_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investor_id UUID NOT NULL REFERENCES investor_profiles(id) ON DELETE CASCADE,
    industries TEXT[] DEFAULT '{}',          -- e.g. {'FinTech', 'HealthTech', 'AgriTech'}
    countries TEXT[] DEFAULT '{}',            -- e.g. {'CD', 'KE', 'NG'}
    startup_stages TEXT[] DEFAULT '{}',       -- e.g. {'Pre-Seed', 'Seed', 'Series A'}
    ticket_size_min DECIMAL(15,2),
    ticket_size_max DECIMAL(15,2),
    investment_philosophy TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(investor_id)
);

CREATE INDEX IF NOT EXISTS idx_investor_prefs_investor ON investor_preferences(investor_id);

-- 3. INVESTMENT PIPELINE
-- Tracks every investor↔venture relationship across its lifecycle stages.
CREATE TABLE IF NOT EXISTS investment_pipeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investor_id UUID NOT NULL REFERENCES investor_profiles(id) ON DELETE CASCADE,
    venture_id UUID NOT NULL,                 -- FK to v2_programs (venture)
    stage TEXT NOT NULL DEFAULT 'interested'
        CHECK (stage IN ('interested', 'watching', 'meeting_requested', 'due_diligence', 'negotiation', 'invested', 'declined')),
    notes TEXT,
    stage_changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(investor_id, venture_id)
);

CREATE INDEX IF NOT EXISTS idx_inv_pipeline_investor ON investment_pipeline(investor_id);
CREATE INDEX IF NOT EXISTS idx_inv_pipeline_venture ON investment_pipeline(venture_id);
CREATE INDEX IF NOT EXISTS idx_inv_pipeline_stage ON investment_pipeline(stage);

-- 4. INVESTMENT DECISIONS
-- Recorded when a final investment decision is made.
CREATE TABLE IF NOT EXISTS investment_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID NOT NULL REFERENCES investment_pipeline(id) ON DELETE CASCADE,
    decision_type TEXT NOT NULL
        CHECK (decision_type IN ('invest', 'decline', 'continue_discussions', 'revisit_later')),
    decision_date DATE NOT NULL DEFAULT CURRENT_DATE,
    investment_amount DECIMAL(15,2),
    decision_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(pipeline_id)   -- one decision per pipeline relationship
);

CREATE INDEX IF NOT EXISTS idx_inv_decisions_pipeline ON investment_decisions(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_inv_decisions_type ON investment_decisions(decision_type);

-- 5. INVESTOR WATCHLIST
-- Ventures an investor has bookmarked for later.
CREATE TABLE IF NOT EXISTS investor_watchlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investor_id UUID NOT NULL REFERENCES investor_profiles(id) ON DELETE CASCADE,
    venture_id UUID NOT NULL,
    personal_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(investor_id, venture_id)
);

CREATE INDEX IF NOT EXISTS idx_inv_watchlist_investor ON investor_watchlist(investor_id);

-- 6. INVESTOR ORGANIZATIONS
-- For institutional investors (VC firms, family offices, etc.)
CREATE TABLE IF NOT EXISTS investor_organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    website TEXT,
    logo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. INVESTOR ORGANIZATION MEMBERS (many-to-many: org ↔ investor profiles)
CREATE TABLE IF NOT EXISTS investor_org_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES investor_organizations(id) ON DELETE CASCADE,
    investor_id UUID NOT NULL REFERENCES investor_profiles(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member',   -- 'admin', 'member'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, investor_id)
);

CREATE INDEX IF NOT EXISTS idx_inv_org_members_org ON investor_org_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_inv_org_members_investor ON investor_org_members(investor_id);

-- 8. DUE DILIGENCE WORKSPACES
-- One workspace per investor↔venture relationship in due diligence.
CREATE TABLE IF NOT EXISTS due_diligence_workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID NOT NULL REFERENCES investment_pipeline(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(pipeline_id)
);

-- 9. DUE DILIGENCE INFORMATION REQUESTS
-- Structured requests from investors to founders for additional info.
CREATE TABLE IF NOT EXISTS dd_information_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES due_diligence_workspaces(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'general'
        CHECK (category IN ('general', 'financial', 'legal', 'product', 'team', 'market')),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'responded', 'closed')),
    response_text TEXT,
    response_file_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dd_requests_workspace ON dd_information_requests(workspace_id);

-- 10. INVESTOR NOTES (portfolio & due diligence)
CREATE TABLE IF NOT EXISTS investor_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investor_id UUID NOT NULL REFERENCES investor_profiles(id) ON DELETE CASCADE,
    venture_id UUID,
    pipeline_id UUID REFERENCES investment_pipeline(id) ON DELETE SET NULL,
    note_type TEXT NOT NULL DEFAULT 'private'
        CHECK (note_type IN ('private', 'shared', 'advisor', 'decision')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_notes_investor ON investor_notes(investor_id);
CREATE INDEX IF NOT EXISTS idx_inv_notes_venture ON investor_notes(venture_id);
