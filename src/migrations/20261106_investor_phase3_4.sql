-- UUID-compatible scheduling for relationship_workspaces.
-- Preserve the legacy BIGINT meeting_slots table and all historical rows.
CREATE TABLE IF NOT EXISTS investor_meeting_slots (
  id BIGSERIAL PRIMARY KEY,
  workspace_id UUID NOT NULL,
  proposed_by TEXT NOT NULL,
  proposed_by_type TEXT NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  proposer_timezone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed',
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investor_meeting_slots_workspace
  ON investor_meeting_slots (workspace_id, start_at);

REVOKE ALL ON TABLE investor_meeting_slots FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS investor_message_reminder_claims (
  id BIGSERIAL PRIMARY KEY,
  workspace_id UUID NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  recipient_cid TEXT NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  UNIQUE (workspace_id, window_start)
);

CREATE INDEX IF NOT EXISTS idx_investor_message_reminder_claims_window
  ON investor_message_reminder_claims (window_start);

REVOKE ALL ON TABLE investor_message_reminder_claims FROM PUBLIC, anon, authenticated;

ALTER TABLE relationship_meetings
  DROP CONSTRAINT IF EXISTS relationship_meetings_status_check;
ALTER TABLE relationship_meetings
  ADD CONSTRAINT relationship_meetings_status_check
  CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'held', 'no_show'));

CREATE TABLE IF NOT EXISTS investor_meeting_feedback (
  id BIGSERIAL PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES relationship_meetings(id) ON DELETE CASCADE,
  investor_profile_id UUID NOT NULL REFERENCES investor_profiles(id) ON DELETE CASCADE,
  interest TEXT NOT NULL CHECK (interest IN ('interested', 'not_interested', 'need_more_information')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (meeting_id, investor_profile_id)
);

REVOKE ALL ON TABLE investor_meeting_feedback FROM PUBLIC, anon, authenticated;
