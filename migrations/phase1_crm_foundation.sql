-- =============================================================================
-- ImpactOS Phase 1 — CRM Foundation
-- contact_roles: many-to-many role assignments with date ranges and context
-- contact_timeline: immutable event log for every business event per person
-- participant_programs: enriched with lifecycle columns
-- =============================================================================

-- 1. CONTACT ROLES — role history preserved forever
CREATE TABLE IF NOT EXISTS contact_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_cid TEXT NOT NULL REFERENCES contacts(cid) ON DELETE CASCADE,
    role TEXT NOT NULL,
    context_type TEXT,       -- 'program', 'venture', 'form', 'global', etc.
    context_id TEXT,          -- program_id, venture_id, or null for global roles
    is_current BOOLEAN DEFAULT true,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    assigned_by TEXT,         -- contacts.cid of who assigned this role
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_roles_cid ON contact_roles(contact_cid);
CREATE INDEX IF NOT EXISTS idx_contact_roles_current ON contact_roles(contact_cid, is_current) WHERE is_current = true;

-- 2. CONTACT TIMELINE — immutable event log (modeled on relationship_timeline)
CREATE TABLE IF NOT EXISTS contact_timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_cid TEXT NOT NULL REFERENCES contacts(cid) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    description TEXT NOT NULL,
    context_module TEXT,      -- 'forms', 'programs', 'ventures', 'investors', 'communications', 'automation', 'crm'
    context_id TEXT,          -- entity ID within that module for drill-down
    actor_id TEXT,            -- contacts.cid of who performed the action
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
    -- Immutable by design — no UPDATE, no DELETE
);

CREATE INDEX IF NOT EXISTS idx_contact_timeline_cid ON contact_timeline(contact_cid, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_timeline_module ON contact_timeline(context_module);

-- 3. PARTICIPANT PROGRAMS — enriched with lifecycle tracking
ALTER TABLE participant_programs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE participant_programs ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ;
ALTER TABLE participant_programs ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
ALTER TABLE participant_programs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE participant_programs ADD COLUMN IF NOT EXISTS outcome TEXT;
ALTER TABLE participant_programs ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE participant_programs ADD COLUMN IF NOT EXISTS certificate_issued BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_pp_status ON participant_programs(status);
