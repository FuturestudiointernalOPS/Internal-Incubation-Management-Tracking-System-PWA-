-- =============================================================================
-- ImpactOS CRM — Phase 5: Intelligence (Qualification, Scoring, Segments, Automation)
--
-- Safety contract:
--   • Additive only. No DROP, RENAME, or ALTER on any existing core table.
--   • Extends crm_leads for qualification & scoring.
--   • Creates isolated crm_segments and crm_automation_rules.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. QUALIFICATION & SCORING EXTENSIONS
-- ---------------------------------------------------------------------------
ALTER TABLE crm_leads 
    ADD COLUMN IF NOT EXISTS qualification_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS qualification_reason TEXT,
    ADD COLUMN IF NOT EXISTS qualification_notes TEXT,
    ADD COLUMN IF NOT EXISTS score INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS crm_lead_score_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
    old_score INTEGER NOT NULL,
    new_score INTEGER NOT NULL,
    reason TEXT,
    trigger_event TEXT,
    created_by TEXT REFERENCES contacts(cid) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crm_lead_score_hist_lead ON crm_lead_score_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_lead_score_hist_date ON crm_lead_score_history(created_at DESC);

-- ---------------------------------------------------------------------------
-- 2. CRM SEGMENTS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('lead', 'opportunity', 'contact', 'organization')),
    conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_by TEXT REFERENCES contacts(cid) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crm_segments_type ON crm_segments(entity_type);

-- ---------------------------------------------------------------------------
-- 3. CRM AUTOMATION RULES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_automation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('lead', 'opportunity', 'activity')),
    trigger_event TEXT NOT NULL,
    conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
    actions JSONB NOT NULL DEFAULT '[]'::jsonb,
    active BOOLEAN NOT NULL DEFAULT true,
    created_by TEXT REFERENCES contacts(cid) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crm_autom_rules_event ON crm_automation_rules(trigger_event) WHERE active = true;

-- ---------------------------------------------------------------------------
-- 4. CRM AUTOMATION EXECUTIONS (LOGS)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_automation_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES crm_automation_rules(id) ON DELETE CASCADE,
    event_id TEXT NOT NULL, -- Logical event hash or timestamp ID
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
    error TEXT,
    result JSONB,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Idempotency constraint: A rule can only process the same event for the same entity once.
CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_autom_exec_idem ON crm_automation_executions(rule_id, event_id, entity_id);

-- ---------------------------------------------------------------------------
-- 5. SEED — Capabilities
-- ---------------------------------------------------------------------------
INSERT INTO crm_module_capabilities (capability, notes) VALUES
    ('automation', 'Phase 5 — CRM Automation & Scoring')
ON CONFLICT (capability) DO NOTHING;
