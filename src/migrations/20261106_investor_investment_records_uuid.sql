-- Additive UUID investment confirmation table.
-- Staging still has legacy investor_investments with bigint investor_id/pipeline_id
-- incompatible with investor_profiles.id / investment_pipeline.id (UUID).
-- New table is what Phase 5 confirmation writes; legacy table is left untouched.
BEGIN;

CREATE TABLE IF NOT EXISTS investor_investment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_profile_id UUID NOT NULL REFERENCES investor_profiles(id) ON DELETE CASCADE,
  pipeline_id UUID NOT NULL UNIQUE,
  venture_id TEXT,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  instrument TEXT,
  invested_on DATE,
  confirmation_status TEXT NOT NULL DEFAULT 'confirmed'
    CHECK (confirmation_status IN ('pending', 'confirmed', 'rejected')),
  recorded_by TEXT,
  financing_event_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investor_investment_records_profile
  ON investor_investment_records (investor_profile_id);

COMMIT;
