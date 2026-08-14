-- =============================================================================
-- 040 — FACILITATOR MANAGEMENT
-- -----------------------------------------------------------------------------
-- Additive, idempotent migration. External facilitators remain separate from
-- internal Future Studio staff (staff = contacts.group_name 'FUTURE STUDIO').
--
-- Adds:
--   1. v2_programs.facilitator_default_permissions JSONB  — program-level defaults
--   2. v2_programs.facilitator_scope TEXT                 — 'assigned_groups' | 'all'
--   3. v2_program_staff.permissions JSONB                 — per-facilitator overrides
--   4. v2_program_staff.updated_at                        — change tracking
--   5. families.lead_facilitator_id TEXT                  — group lead facilitator
--   6. program_facilitator_reviews                        — reviews + PM decisions
-- =============================================================================

BEGIN;

-- 1. Program-level facilitator configuration
ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS facilitator_default_permissions JSONB DEFAULT '{}'::jsonb;
ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS facilitator_scope TEXT DEFAULT 'assigned_groups';

-- 2. Per-facilitator overrides on the program assignment
ALTER TABLE v2_program_staff ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb;
ALTER TABLE v2_program_staff ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 3. Lead facilitator per participant group
ALTER TABLE families ADD COLUMN IF NOT EXISTS lead_facilitator_id TEXT;
CREATE INDEX IF NOT EXISTS idx_families_lead_facilitator ON families(lead_facilitator_id);

-- 4. Facilitator reviews + PM decisions (single row, distinct fields for audit)
CREATE TABLE IF NOT EXISTS program_facilitator_reviews (
    id SERIAL PRIMARY KEY,
    program_id UUID NOT NULL REFERENCES v2_programs(id) ON DELETE CASCADE,
    facilitator_id TEXT NOT NULL,
    facilitator_name TEXT,
    week_number INTEGER,
    participant_progress TEXT,
    attendance_concerns TEXT,
    assignment_performance TEXT,
    challenges TEXT,
    participants_needing_intervention TEXT,
    completed_work TEXT,
    needs_attention TEXT,
    recommendations TEXT,
    status TEXT NOT NULL DEFAULT 'submitted',
    pm_decision TEXT,
    pm_decision_note TEXT,
    pm_decision_by TEXT,
    pm_decision_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fac_reviews_program ON program_facilitator_reviews(program_id);
CREATE INDEX IF NOT EXISTS idx_fac_reviews_facilitator ON program_facilitator_reviews(facilitator_id);

COMMIT;
