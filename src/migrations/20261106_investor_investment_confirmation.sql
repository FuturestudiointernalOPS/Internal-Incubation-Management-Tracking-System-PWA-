-- Phase 5 — investment confirmation columns on the UUID records table.
-- Additive only. Existing rows stay confirmation_status = 'confirmed'.
BEGIN;

ALTER TABLE investor_investment_records
  ADD COLUMN IF NOT EXISTS confirmed_by TEXT,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reject_reason TEXT,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_by TEXT;

CREATE INDEX IF NOT EXISTS idx_investor_investment_records_status
  ON investor_investment_records (confirmation_status, created_at DESC);

COMMIT;
