-- ============================================================================
-- PHASE 9 — CRM: a target duration per pipeline stage
--
-- Additive and idempotent. One statement per line (the house runner contract).
--
-- Every stage carries the time a deal is EXPECTED to spend in it. It is set when
-- the stage is created and defaults to one week. The target is what decides that
-- a deal is stuck: an opportunity whose current stage entry is older than the
-- stage's target is surfaced on the action dashboard.
--
-- Existing stages receive the default; nothing is rewritten elsewhere.
-- ============================================================================

ALTER TABLE crm_pipeline_stages ADD COLUMN IF NOT EXISTS target_days INTEGER NOT NULL DEFAULT 7;
