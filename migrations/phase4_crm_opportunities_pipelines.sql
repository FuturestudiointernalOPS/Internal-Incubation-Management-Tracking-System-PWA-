-- =============================================================================
-- ImpactOS CRM — Phase 3: Opportunities & Configurable Pipelines
--
-- Safety contract:
--   • Additive only. No DROP, RENAME, or ALTER on any existing table.
--   • Does NOT touch: investment_pipeline, investment_decisions,
--     fundraising_opportunities, venture_journey_stages, or any venture/
--     investor table. Those remain fully independent.
--   • Assumes Phase 1 (crm_organizations) and Phase 2 (crm_leads) are
--     applied first. The note file (phase3_crm_leads.sql) is the Phase 2
--     migration — naming follows file sequence, not product phase labels.
--
-- New tables introduced here:
--   crm_pipelines                — configurable pipeline definitions
--   crm_pipeline_stages          — ordered stages within a pipeline
--   crm_opportunities            — the opportunity entity
--   crm_opportunity_stage_history — append-only stage transition log
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. CRM PIPELINES
--    Each pipeline is an independent, named workflow. Multiple pipelines
--    can coexist (Partnerships, Sponsorships, Client Engagements, etc.).
--    Soft-deactivation via is_active prevents deletion of pipelines that
--    have historical opportunities.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_pipelines (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL,
    description TEXT,
    -- Classification hint for UI grouping — free text, no enum lock-in
    type        TEXT,       -- 'partnership', 'sponsorship', 'client', 'program', 'other'
    is_active   BOOLEAN     NOT NULL DEFAULT true,

    -- Audit / ownership
    created_by  TEXT        REFERENCES contacts(cid) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_crm_pipeline_name UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS idx_crm_pipelines_active
    ON crm_pipelines(is_active, name);

-- ---------------------------------------------------------------------------
-- 2. CRM PIPELINE STAGES
--    Stages are stored as data with deterministic position ordering.
--    Soft-deactivation (is_active = false) preserves history when a stage
--    is retired without removing existing opportunity references.
--    Won/lost are represented as regular stages flagged with is_terminal
--    plus the outcome column, allowing flexible pipeline design.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_pipeline_stages (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID        NOT NULL REFERENCES crm_pipelines(id) ON DELETE RESTRICT,
    name        TEXT        NOT NULL,
    description TEXT,
    position    INTEGER     NOT NULL,       -- Explicit ordering; never rely on id sort
    probability INTEGER     NOT NULL DEFAULT 0
        CHECK (probability >= 0 AND probability <= 100),
    is_active   BOOLEAN     NOT NULL DEFAULT true,
    -- When true, opportunity is closed (won or lost)
    is_terminal BOOLEAN     NOT NULL DEFAULT false,
    -- NULL for non-terminal; 'won' or 'lost' for terminal stages
    outcome     TEXT        CHECK (outcome IN ('won', 'lost', NULL)),

    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_crm_stage_pipeline_position UNIQUE (pipeline_id, position),
    CONSTRAINT uq_crm_stage_pipeline_name UNIQUE (pipeline_id, name)
);

CREATE INDEX IF NOT EXISTS idx_crm_stages_pipeline
    ON crm_pipeline_stages(pipeline_id, position);

-- ---------------------------------------------------------------------------
-- 3. CRM OPPORTUNITIES
--    The commercial/relationship opportunity entity.
--    Deliberately distinct from investment_pipeline (investor-scoped) and
--    from crm_leads (relationship-lifecycle state).
--    lead_id is nullable — opportunities may be created directly.
--    value and probability are nullable — not every opportunity is monetary.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_opportunities (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name                 TEXT        NOT NULL,
    description          TEXT,

    -- Provenance: where this opportunity came from
    lead_id              UUID        REFERENCES crm_leads(id) ON DELETE SET NULL,
    contact_cid          TEXT        REFERENCES contacts(cid) ON DELETE SET NULL,
    organization_id      UUID        REFERENCES crm_organizations(id) ON DELETE SET NULL,

    -- Pipeline placement
    pipeline_id          UUID        NOT NULL REFERENCES crm_pipelines(id) ON DELETE RESTRICT,
    stage_id             UUID        NOT NULL REFERENCES crm_pipeline_stages(id) ON DELETE RESTRICT,

    -- Ownership
    owner_cid            TEXT        REFERENCES contacts(cid) ON DELETE SET NULL,

    -- Commercial fields (all nullable)
    value                NUMERIC(18, 2),
    currency             TEXT,              -- ISO 4217, e.g. 'XOF', 'USD', 'EUR'
    probability          INTEGER
        CHECK (probability IS NULL OR (probability >= 0 AND probability <= 100)),
    expected_close_date  DATE,

    -- Lifecycle status — distinct from stage name
    status               TEXT        NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'won', 'lost', 'on_hold')),

    -- Closure fields
    lost_reason          TEXT,              -- only populated when status = 'lost'

    -- Soft delete
    deleted_at           TIMESTAMPTZ,
    deleted_by           TEXT        REFERENCES contacts(cid) ON DELETE SET NULL,

    -- Audit
    created_by           TEXT        REFERENCES contacts(cid) ON DELETE SET NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Stage must belong to the declared pipeline (enforced in app layer too)
    -- FK alone cannot enforce cross-table constraint; app layer validates this
    CONSTRAINT chk_opp_has_target
        CHECK (contact_cid IS NOT NULL OR organization_id IS NOT NULL OR lead_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_crm_opp_pipeline ON crm_opportunities(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_crm_opp_stage    ON crm_opportunities(stage_id);
CREATE INDEX IF NOT EXISTS idx_crm_opp_owner    ON crm_opportunities(owner_cid);
CREATE INDEX IF NOT EXISTS idx_crm_opp_contact  ON crm_opportunities(contact_cid);
CREATE INDEX IF NOT EXISTS idx_crm_opp_org      ON crm_opportunities(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_opp_lead     ON crm_opportunities(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_opp_status   ON crm_opportunities(status);

-- Active-only partial index for list queries
CREATE INDEX IF NOT EXISTS idx_crm_opp_active
    ON crm_opportunities(pipeline_id, stage_id, created_at DESC)
    WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 4. CRM OPPORTUNITY STAGE HISTORY
--    Append-only log of every stage transition.
--    Never overwritten. Enables time-in-stage, conversion-rate, and
--    pipeline-velocity analysis in future phases.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_opportunity_stage_history (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id  UUID        NOT NULL REFERENCES crm_opportunities(id) ON DELETE CASCADE,
    from_stage_id   UUID        REFERENCES crm_pipeline_stages(id) ON DELETE SET NULL,
    to_stage_id     UUID        NOT NULL REFERENCES crm_pipeline_stages(id) ON DELETE RESTRICT,
    changed_by      TEXT        REFERENCES contacts(cid) ON DELETE SET NULL,
    changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Optional context: reason, notes for the transition
    metadata        JSONB
);

CREATE INDEX IF NOT EXISTS idx_crm_stage_history_opp
    ON crm_opportunity_stage_history(opportunity_id, changed_at DESC);

-- ---------------------------------------------------------------------------
-- 5. SEED — Default Pipelines & Stages
--    Three starter pipelines. All idempotent via ON CONFLICT DO NOTHING.
--    Pipelines may be edited/deactivated by admins post-deploy.
-- ---------------------------------------------------------------------------

-- Partnership Pipeline
INSERT INTO crm_pipelines (id, name, type, description) VALUES
    ('a1000000-0000-0000-0000-000000000001', 'Partnerships',   'partnership', 'Strategic partner engagement pipeline'),
    ('a1000000-0000-0000-0000-000000000002', 'Sponsorships',   'sponsorship', 'Sponsor relationship pipeline'),
    ('a1000000-0000-0000-0000-000000000003', 'Client Pipeline','client',      'Client and service opportunity pipeline')
ON CONFLICT (name) DO NOTHING;

-- Partnership stages
INSERT INTO crm_pipeline_stages (pipeline_id, name, position, probability) VALUES
    ('a1000000-0000-0000-0000-000000000001', 'Identified',   1, 10),
    ('a1000000-0000-0000-0000-000000000001', 'Contacted',    2, 20),
    ('a1000000-0000-0000-0000-000000000001', 'Discussion',   3, 40),
    ('a1000000-0000-0000-0000-000000000001', 'Proposal',     4, 60),
    ('a1000000-0000-0000-0000-000000000001', 'Negotiation',  5, 80),
    ('a1000000-0000-0000-0000-000000000001', 'Won',          6, 100),
    ('a1000000-0000-0000-0000-000000000001', 'Lost',         7, 0)
ON CONFLICT (pipeline_id, position) DO NOTHING;

UPDATE crm_pipeline_stages SET is_terminal = true, outcome = 'won'
    WHERE pipeline_id = 'a1000000-0000-0000-0000-000000000001' AND name = 'Won';
UPDATE crm_pipeline_stages SET is_terminal = true, outcome = 'lost'
    WHERE pipeline_id = 'a1000000-0000-0000-0000-000000000001' AND name = 'Lost';

-- Sponsorship stages
INSERT INTO crm_pipeline_stages (pipeline_id, name, position, probability) VALUES
    ('a1000000-0000-0000-0000-000000000002', 'Identified',  1, 10),
    ('a1000000-0000-0000-0000-000000000002', 'Qualified',   2, 25),
    ('a1000000-0000-0000-0000-000000000002', 'Proposal',    3, 50),
    ('a1000000-0000-0000-0000-000000000002', 'Negotiation', 4, 75),
    ('a1000000-0000-0000-0000-000000000002', 'Committed',   5, 90),
    ('a1000000-0000-0000-0000-000000000002', 'Won',         6, 100),
    ('a1000000-0000-0000-0000-000000000002', 'Lost',        7, 0)
ON CONFLICT (pipeline_id, position) DO NOTHING;

UPDATE crm_pipeline_stages SET is_terminal = true, outcome = 'won'
    WHERE pipeline_id = 'a1000000-0000-0000-0000-000000000002' AND name = 'Won';
UPDATE crm_pipeline_stages SET is_terminal = true, outcome = 'lost'
    WHERE pipeline_id = 'a1000000-0000-0000-0000-000000000002' AND name = 'Lost';

-- Client stages
INSERT INTO crm_pipeline_stages (pipeline_id, name, position, probability) VALUES
    ('a1000000-0000-0000-0000-000000000003', 'Lead',        1, 10),
    ('a1000000-0000-0000-0000-000000000003', 'Discovery',   2, 25),
    ('a1000000-0000-0000-0000-000000000003', 'Proposal',    3, 50),
    ('a1000000-0000-0000-0000-000000000003', 'Negotiation', 4, 75),
    ('a1000000-0000-0000-0000-000000000003', 'Contract',    5, 90),
    ('a1000000-0000-0000-0000-000000000003', 'Won',         6, 100),
    ('a1000000-0000-0000-0000-000000000003', 'Lost',        7, 0)
ON CONFLICT (pipeline_id, position) DO NOTHING;

UPDATE crm_pipeline_stages SET is_terminal = true, outcome = 'won'
    WHERE pipeline_id = 'a1000000-0000-0000-0000-000000000003' AND name = 'Won';
UPDATE crm_pipeline_stages SET is_terminal = true, outcome = 'lost'
    WHERE pipeline_id = 'a1000000-0000-0000-0000-000000000003' AND name = 'Lost';

-- Register capability
INSERT INTO crm_module_capabilities (capability, notes) VALUES
    ('opportunities', 'Phase 3 — Opportunities & Configurable Pipelines'),
    ('pipelines',     'Phase 3 — Configurable Pipeline Engine')
ON CONFLICT (capability) DO NOTHING;

-- =============================================================================
-- END OF MIGRATION
-- Apply after: phase2_crm_organization_foundation.sql AND phase3_crm_leads.sql
-- Fundraising protection: investment_pipeline and all investor_os_* tables
-- are NOT touched by this migration.
-- =============================================================================
