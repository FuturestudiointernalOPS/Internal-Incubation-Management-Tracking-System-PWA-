-- =============================================================================
-- Venture stage engine — PHASE 5 (ADDITIVE ONLY)
-- The proposal queue and the permanent stage history (spec §4.2, §4.3).
-- `ventures.business_stage` stays the CURRENT value; it is written only when a
-- proposal is approved.
--
-- Contract of scripts/db-audit/apply-schema-file.mjs: one statement per line,
-- each terminated by ';', no ';' inside string literals.
-- =============================================================================

CREATE TABLE IF NOT EXISTS venture_stage_proposal (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), venture_uuid UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE, venture_code TEXT NOT NULL, from_stage TEXT NOT NULL, to_stage TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','superseded')), progress NUMERIC, snapshot JSONB, created_by TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), decided_at TIMESTAMPTZ, decided_by TEXT, rejection_reason TEXT);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vsp_one_pending ON venture_stage_proposal (venture_uuid) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_vsp_venture ON venture_stage_proposal (venture_uuid, created_at DESC);
CREATE TABLE IF NOT EXISTS venture_stage_history (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), venture_uuid UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE, venture_code TEXT NOT NULL, from_stage TEXT, to_stage TEXT NOT NULL, progress NUMERIC, snapshot JSONB, decided_by TEXT, decided_at TIMESTAMPTZ DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_vsh_venture ON venture_stage_history (venture_uuid, decided_at DESC);
