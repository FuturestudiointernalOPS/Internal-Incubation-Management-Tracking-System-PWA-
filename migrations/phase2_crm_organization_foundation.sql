-- =============================================================================
-- ImpactOS CRM — Phase 1 Additive: Organization & Relationship Foundation
--
-- Safety contract:
--   • No DROP, no RENAME, no ALTER on any existing table
--   • No change to: contacts, contact_roles, contact_timeline,
--     investment_pipeline, investor_organizations, or any v2_* table
--   • All statements use CREATE TABLE IF NOT EXISTS and INSERT … ON CONFLICT DO NOTHING
--   • Safe to apply to a database that has already run phase1_crm_foundation.sql
--
-- Requires (must already exist):
--   • contacts (cid TEXT PRIMARY KEY)
--   • contact_roles  (from phase1_crm_foundation.sql)
--   • contact_timeline (from phase1_crm_foundation.sql)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. CRM ORGANIZATIONS
--    First-class company / organisation model for the CRM module.
--
--    Deliberately named crm_organizations (not plain `organizations`) to:
--      - avoid any name collision with investor_organizations (investor-scoped)
--      - signal clearly that this belongs to the CRM capability boundary
--      - allow a future rename/merge if a global org model is warranted
--
--    owner_cid follows the ImpactOS ownership pattern: FK into contacts.cid.
--    Soft-delete pattern matches contacts (deleted_at / deleted_by).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_organizations (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL,
    -- Broad classification; free-text to avoid premature enum lock-in
    type        TEXT,       -- 'company', 'ngo', 'school', 'fund', 'government', 'other'
    website     TEXT,
    industry    TEXT,
    description TEXT,

    -- CRM record ownership (follows existing ImpactOS pattern)
    owner_cid   TEXT        REFERENCES contacts(cid) ON DELETE SET NULL,

    -- Soft delete
    deleted_at  TIMESTAMPTZ,
    deleted_by  TEXT        REFERENCES contacts(cid) ON DELETE SET NULL,

    -- Audit timestamps
    created_by  TEXT        REFERENCES contacts(cid) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_orgs_name
    ON crm_organizations(name);

CREATE INDEX IF NOT EXISTS idx_crm_orgs_owner
    ON crm_organizations(owner_cid)
    WHERE owner_cid IS NOT NULL;

-- Partial index: queries almost always filter out deleted rows
CREATE INDEX IF NOT EXISTS idx_crm_orgs_active
    ON crm_organizations(name, created_at DESC)
    WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 2. CRM CONTACT-ORGANIZATION RELATIONSHIPS
--    Links an existing ImpactOS contact (contacts.cid) to a CRM organization.
--    This is the "John works_for ABC Corp" model.
--
--    Deliberately separate from contact_roles:
--      • contact_roles expresses a PLATFORM ROLE (participant, investor, staff…)
--      • crm_contact_organizations expresses a REAL-WORLD relationship
--        (employment, founding, advisory, representation…)
--
--    relationship_type is free-text with a default so callers don't need to
--    know the vocabulary upfront. Canonical values:
--      works_for | founded | advises | represents | invested_in | partners_with | other
--
--    is_primary marks the contact's main organisation (at most one per contact).
--    The UNIQUE constraint prevents accidental duplicate links for the same
--    (person, org, relationship_type) triple — two rows CAN exist for the same
--    person+org if the relationship_type differs (e.g. founded + advises).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_contact_organizations (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_cid       TEXT        NOT NULL REFERENCES contacts(cid) ON DELETE CASCADE,
    organization_id   UUID        NOT NULL REFERENCES crm_organizations(id) ON DELETE CASCADE,

    -- Nature of the link
    relationship_type TEXT        NOT NULL DEFAULT 'works_for',
    title             TEXT,           -- Job title / role at the organisation
    is_primary        BOOLEAN     NOT NULL DEFAULT false,

    -- Temporal range (open-ended when ended_at IS NULL)
    started_at        TIMESTAMPTZ,
    ended_at          TIMESTAMPTZ,
    is_current        BOOLEAN     NOT NULL DEFAULT true,

    notes             TEXT,

    -- Audit
    created_by        TEXT        REFERENCES contacts(cid) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One row per (person, org, relationship type) — prevents silent duplicates
    CONSTRAINT uq_crm_contact_org_type
        UNIQUE (contact_cid, organization_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_crm_co_contact
    ON crm_contact_organizations(contact_cid);

CREATE INDEX IF NOT EXISTS idx_crm_co_org
    ON crm_contact_organizations(organization_id);

-- Hot path: "current relationships for this person"
CREATE INDEX IF NOT EXISTS idx_crm_co_current
    ON crm_contact_organizations(contact_cid, is_current)
    WHERE is_current = true;

-- ---------------------------------------------------------------------------
-- 3. CRM MODULE CAPABILITY REGISTRATION
--    Lightweight feature-flag table: records which CRM capabilities are live
--    in this tenant. Phase 1 seeds the two foundation capabilities.
--    Later phases INSERT rows here (leads, opportunities, pipelines) without
--    code changes — the CRM hub reads this table to determine available cards.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_module_capabilities (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    capability   TEXT        NOT NULL UNIQUE,   -- 'organizations', 'relationships', 'leads', …
    is_active    BOOLEAN     NOT NULL DEFAULT true,
    activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes        TEXT
);

-- Seed Phase 1 capabilities (idempotent — safe to re-run)
INSERT INTO crm_module_capabilities (capability, notes) VALUES
    ('organizations', 'Phase 1 — CRM organization / company model'),
    ('relationships', 'Phase 1 — Person ↔ Organization relationship model')
ON CONFLICT (capability) DO NOTHING;

-- =============================================================================
-- END OF MIGRATION
-- Regression contract: run the full regression suite after applying this file.
-- Expected result: all existing ImpactOS functionality unchanged.
-- =============================================================================
