-- =============================================================================
-- ImpactOS CRM — Phase 2: Leads & Relationship Lifecycle
--
-- Safety contract:
--   • Additive only. No DROP, RENAME, or ALTER on existing tables.
--   • Does NOT duplicate contacts. References canonical contacts.cid.
--   • Assumes Phase 1 (crm_organizations) is already applied.
-- =============================================================================

CREATE TABLE IF NOT EXISTS crm_leads (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    title               TEXT        NOT NULL, -- E.g., "MTN Strategic Partnership"
    
    -- Identity references
    contact_cid         TEXT        REFERENCES contacts(cid) ON DELETE SET NULL,
    organization_id     UUID        REFERENCES crm_organizations(id) ON DELETE SET NULL,
    
    -- Ownership
    owner_cid           TEXT        REFERENCES contacts(cid) ON DELETE SET NULL,
    
    -- Categorization & Lifecycle
    lead_type           TEXT        NOT NULL DEFAULT 'other',
    status              TEXT        NOT NULL DEFAULT 'new',
    qualification_state TEXT        NOT NULL DEFAULT 'not_assessed',
    source              TEXT,
    
    -- Content
    description         TEXT,
    notes               TEXT,
    
    -- Conversion state (prepares for Phase 3)
    is_converted        BOOLEAN     NOT NULL DEFAULT false,
    converted_at        TIMESTAMPTZ,
    
    -- Soft Delete & Audit
    deleted_at          TIMESTAMPTZ,
    deleted_by          TEXT        REFERENCES contacts(cid) ON DELETE SET NULL,
    created_by          TEXT        REFERENCES contacts(cid) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Safety check: a lead should belong to either a person, an org, or both
    CONSTRAINT chk_lead_has_target 
        CHECK (contact_cid IS NOT NULL OR organization_id IS NOT NULL)
);

-- Indexes for common filters
CREATE INDEX IF NOT EXISTS idx_crm_leads_owner ON crm_leads(owner_cid);
CREATE INDEX IF NOT EXISTS idx_crm_leads_status ON crm_leads(status);
CREATE INDEX IF NOT EXISTS idx_crm_leads_type ON crm_leads(lead_type);
CREATE INDEX IF NOT EXISTS idx_crm_leads_contact ON crm_leads(contact_cid);
CREATE INDEX IF NOT EXISTS idx_crm_leads_org ON crm_leads(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_active 
    ON crm_leads(created_at DESC) 
    WHERE deleted_at IS NULL;

-- Register the capability in the DB feature flags
INSERT INTO crm_module_capabilities (capability, notes) VALUES
    ('leads', 'Phase 2 — Leads & Relationship Lifecycle')
ON CONFLICT (capability) DO NOTHING;
