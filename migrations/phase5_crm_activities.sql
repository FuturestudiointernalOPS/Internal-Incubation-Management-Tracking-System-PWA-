-- =============================================================================
-- ImpactOS CRM — Phase 4: Activities, Communication & Execution
--
-- Safety contract:
--   • Additive only, with ONE sanctioned exception (§3): the tasks
--     context_type CHECK is widened (DROP CONSTRAINT IF EXISTS + ADD
--     CONSTRAINT) so native tasks can carry the crm_* contexts. No data is
--     touched; no other table is altered.
--   • Does NOT create parallel task systems or email systems.
--   • Contextualizes activities to crm_leads, crm_opportunities,
--     crm_organizations, and contacts.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. CRM ACTIVITIES
--    The unified activity layer. Stores manual activities (notes, calls)
--    and acts as a bridge/context for non-polymorphic external records (emails).
--    Meetings are stored here and exposed to the unified calendar.
--    Tasks are NOT duplicated here; they use their native context_type='crm_*'.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_activities (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    type              TEXT        NOT NULL
        CHECK (type IN ('call', 'meeting', 'email', 'note', 'follow_up', 'other')),
    
    title             TEXT        NOT NULL,
    description       TEXT,
    outcome           TEXT,
    activity_date     TIMESTAMPTZ,
    
    -- Context (at least one must be present)
    lead_id           UUID        REFERENCES crm_leads(id) ON DELETE CASCADE,
    opportunity_id    UUID        REFERENCES crm_opportunities(id) ON DELETE CASCADE,
    contact_cid       TEXT        REFERENCES contacts(cid) ON DELETE CASCADE,
    organization_id   UUID        REFERENCES crm_organizations(id) ON DELETE CASCADE,
    
    -- Execution
    owner_cid         TEXT        REFERENCES contacts(cid) ON DELETE SET NULL,
    
    -- Link to authoritative system (e.g. platform_email_log.id)
    reference_id      TEXT,
    
    -- Audit
    created_by        TEXT        REFERENCES contacts(cid) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_crm_act_target 
        CHECK (lead_id IS NOT NULL OR opportunity_id IS NOT NULL OR contact_cid IS NOT NULL OR organization_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_crm_act_lead ON crm_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_act_opp  ON crm_activities(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_crm_act_contact ON crm_activities(contact_cid);
CREATE INDEX IF NOT EXISTS idx_crm_act_org  ON crm_activities(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_act_owner ON crm_activities(owner_cid);
CREATE INDEX IF NOT EXISTS idx_crm_act_date ON crm_activities(activity_date DESC);

-- ---------------------------------------------------------------------------
-- 2. SEED — Capabilities
-- ---------------------------------------------------------------------------
INSERT INTO crm_module_capabilities (capability, notes) VALUES
    ('activities', 'Phase 4 — Execution & Activities')
ON CONFLICT (capability) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. NATIVE TASK CONTEXT — widen chk_tasks_context_type for the CRM contexts
--    CRM tasks run through the native tasks table with context_type in
--    ('crm_lead', 'crm_opportunity', 'crm_contact', 'crm_organization').
--    The original constraint (src/migrations/035_phase1_unified_operations.sql)
--    allowed only ('staff', 'venture', 'participant'), so every CRM task INSERT
--    was rejected at the database level (23514). House constraint-evolution
--    pattern: drop-if-exists, then re-add. Re-running is a no-op.
-- ---------------------------------------------------------------------------
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS chk_tasks_context_type;
ALTER TABLE tasks ADD CONSTRAINT chk_tasks_context_type CHECK (
    context_type IS NULL OR context_type IN (
        'staff', 'venture', 'participant',
        'crm_lead', 'crm_opportunity', 'crm_contact', 'crm_organization'
    )
);
