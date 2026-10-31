-- ============================================================================
-- PHASE 8 — CRM: next action on a lead and on an opportunity
--
-- Additive and idempotent. One statement per line (the house runner contract).
--
-- The next action is a first-class attribute of the record: a label and a due
-- date, set by the record OWNER (never by an automation rule). When the field
-- is empty, the screens fall back to the earliest open task or meeting, so a
-- record is never silently without a next step.
-- ============================================================================

ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS next_action TEXT;
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS next_action_due TIMESTAMPTZ;
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS next_action_set_by TEXT REFERENCES contacts(cid) ON DELETE SET NULL;
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS next_action_set_at TIMESTAMPTZ;

ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS next_action TEXT;
ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS next_action_due TIMESTAMPTZ;
ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS next_action_set_by TEXT REFERENCES contacts(cid) ON DELETE SET NULL;
ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS next_action_set_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_crm_leads_next_due ON crm_leads(next_action_due) WHERE next_action_due IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_next_due ON crm_opportunities(next_action_due) WHERE next_action_due IS NOT NULL AND deleted_at IS NULL;
