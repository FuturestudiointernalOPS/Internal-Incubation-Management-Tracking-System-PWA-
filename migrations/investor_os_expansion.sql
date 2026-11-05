-- =============================================================================
-- Investor OS expansion — Phases 1–3 (additive only)
-- =============================================================================
-- Mirrors src/models/investor/expansionSchema.js (the runtime self-heal). Every
-- statement is IF NOT EXISTS: nothing is dropped or renamed. Safe to re-run.
-- =============================================================================

-- ── investor_profiles: visibility + provenance + metric exclusion ────────────
ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS visibility_mode TEXT DEFAULT 'deal_flow_only';
ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS investor_type TEXT;
ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS investor_type_other TEXT;
ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS invitation_id BIGINT;
ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS terms_version TEXT;
ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT false;

-- ── investor_activity_log: append-only, enriched event store ─────────────────
CREATE TABLE IF NOT EXISTS investor_activity_log (
  event_id TEXT PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_type TEXT NOT NULL,
  investor_id BIGINT,
  venture_id TEXT,
  related_id BIGINT,
  actor_type TEXT NOT NULL DEFAULT 'system',
  actor_id TEXT,
  visibility_mode TEXT,
  currency TEXT,
  amount NUMERIC,
  fx_rate NUMERIC,
  fx_rate_date DATE,
  timezone TEXT,
  metadata JSONB,
  dedupe_key TEXT,
  session_id TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_investor_activity_dedupe ON investor_activity_log (dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_investor_activity_investor ON investor_activity_log (investor_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_investor_activity_venture ON investor_activity_log (venture_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_investor_activity_type ON investor_activity_log (event_type, occurred_at DESC);

-- ── investor_outbox: cross-module writes (Phase 7 financing) ─────────────────
CREATE TABLE IF NOT EXISTS investor_outbox (
  id BIGSERIAL PRIMARY KEY,
  event_id TEXT,
  kind TEXT NOT NULL,
  payload JSONB NOT NULL,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_investor_outbox_idem ON investor_outbox (idempotency_key);

-- ── deal flow entries ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deal_flow_entries (
  id BIGSERIAL PRIMARY KEY,
  venture_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  target_amount NUMERIC,
  currency TEXT,
  instrument TEXT,
  use_of_funds TEXT,
  opened_at TIMESTAMPTZ,
  opened_by TEXT,
  closed_at TIMESTAMPTZ,
  close_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_deal_flow_status ON deal_flow_entries (status);
CREATE INDEX IF NOT EXISTS idx_deal_flow_venture ON deal_flow_entries (venture_id);

-- ── deal flow decks ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deal_flow_decks (
  id BIGSERIAL PRIMARY KEY,
  deal_flow_entry_id BIGINT NOT NULL,
  file_ref TEXT,
  file_name TEXT,
  mime_type TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',
  download_allowed BOOLEAN NOT NULL DEFAULT false,
  uploaded_by TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_deal_flow_decks_entry ON deal_flow_decks (deal_flow_entry_id);

-- ── Phase 4 — invitations ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS investor_invitations (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  token_hash TEXT NOT NULL,
  sent_by TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  form_submission_id BIGINT,
  status TEXT NOT NULL DEFAULT 'sent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_investor_invitations_token ON investor_invitations (token_hash);
CREATE INDEX IF NOT EXISTS idx_investor_invitations_email ON investor_invitations (email);
CREATE INDEX IF NOT EXISTS idx_investor_invitations_status ON investor_invitations (status);

-- ── Phase 5 — introduction requests ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS introduction_requests (
  id BIGSERIAL PRIMARY KEY,
  investor_id BIGINT NOT NULL,
  venture_id TEXT,
  deal_flow_entry_id BIGINT,
  pipeline_id BIGINT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'submitted',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_by TEXT,
  decided_at TIMESTAMPTZ,
  decline_reason TEXT,
  workspace_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_intro_requests_status ON introduction_requests (status);
CREATE INDEX IF NOT EXISTS idx_intro_requests_investor ON introduction_requests (investor_id);
CREATE INDEX IF NOT EXISTS idx_intro_requests_venture ON introduction_requests (venture_id);

-- ── Phase 6 — meeting slots + confirmed-meeting columns ─────────────────────
CREATE TABLE IF NOT EXISTS meeting_slots (
  id BIGSERIAL PRIMARY KEY,
  workspace_id BIGINT NOT NULL,
  proposed_by TEXT NOT NULL,
  proposed_by_type TEXT NOT NULL DEFAULT 'investor',
  start_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  proposer_timezone TEXT,
  status TEXT NOT NULL DEFAULT 'proposed',
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_meeting_slots_workspace ON meeting_slots (workspace_id);

ALTER TABLE relationship_meetings ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ;
ALTER TABLE relationship_meetings ADD COLUMN IF NOT EXISTS timezone TEXT;
ALTER TABLE relationship_meetings ADD COLUMN IF NOT EXISTS video_link TEXT;
ALTER TABLE relationship_meetings ADD COLUMN IF NOT EXISTS outcome_code TEXT;
ALTER TABLE relationship_meetings ADD COLUMN IF NOT EXISTS confirmation_email_sent_at TIMESTAMPTZ;
ALTER TABLE relationship_meetings ADD COLUMN IF NOT EXISTS reminder_24h_sent_at TIMESTAMPTZ;
ALTER TABLE relationship_meetings ADD COLUMN IF NOT EXISTS reminder_1h_sent_at TIMESTAMPTZ;

-- ── Phase 7 — investment confirmation ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS investor_investments (
  id BIGSERIAL PRIMARY KEY,
  investor_id BIGINT,
  pipeline_id BIGINT,
  venture_id TEXT,
  amount NUMERIC,
  currency TEXT,
  instrument TEXT,
  invested_on DATE,
  recorded_by TEXT,
  financing_event_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_investor_investments_pipeline ON investor_investments (pipeline_id);

-- ── Studio capital inputs (valuation / ownership / exits) ────────────────────
CREATE TABLE IF NOT EXISTS studio_venture_capital (
  id BIGSERIAL PRIMARY KEY,
  venture_id TEXT NOT NULL UNIQUE,
  studio_capital_invested NUMERIC,
  valuation NUMERIC,
  valuation_currency TEXT,
  ownership_pct NUMERIC,
  realized_proceeds NUMERIC,
  cash_distributed NUMERIC,
  exited BOOLEAN NOT NULL DEFAULT false,
  as_of DATE,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
