-- =============================================================================
-- Venture reporting — Phase 3a (ADDITIVE ONLY)
-- The event log (spec §7) + evidence on the existing interview table.
-- Nothing here touches an existing table's data.
--
-- Contract of scripts/db-audit/apply-schema-file.mjs: one statement per line,
-- each terminated by ';', no ';' inside string literals.
-- =============================================================================

CREATE TABLE IF NOT EXISTS venture_event_log (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), venture_uuid UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE, venture_code TEXT NOT NULL, event_type TEXT NOT NULL CHECK (event_type IN ('pilot_signed','mvp_launched','pilot_converted','financing_received','new_market','status_change','stage_change')), event_date DATE NOT NULL, title TEXT, description TEXT, customer_name TEXT, amount_mode TEXT CHECK (amount_mode IN ('exact','band')), amount_value NUMERIC, amount_band TEXT, financing_type TEXT CHECK (financing_type IN ('grant','equity','debt')), source TEXT, market_description TEXT, status_from TEXT, status_to TEXT, evidence TEXT, evidence_name TEXT, created_by TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), deleted_at TIMESTAMPTZ);
CREATE INDEX IF NOT EXISTS idx_vel_venture ON venture_event_log (venture_uuid, event_date DESC);
ALTER TABLE IF EXISTS venture_customer_interviews ADD COLUMN IF NOT EXISTS evidence TEXT;
ALTER TABLE IF EXISTS venture_customer_interviews ADD COLUMN IF NOT EXISTS evidence_name TEXT;
