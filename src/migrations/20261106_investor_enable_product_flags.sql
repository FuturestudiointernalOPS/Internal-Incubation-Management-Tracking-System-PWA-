-- Investor Platform — enable product-facing flags for Phases 2–5.
-- NDA stays OFF until approved bilingual legal text exists (Guide §5 decision 8).
-- Additive only: inserts missing keys, then enables product switches.
BEGIN;

INSERT INTO feature_flags (flag_key, flag_name, description, category, is_enabled)
VALUES
  ('investor_profile_privacy_v1', 'Investor profile privacy', 'Allowlisted self-service profile responses', 'investment', TRUE),
  ('investor_visibility_v1', 'Investor visibility modes', 'Studio visibility modes on investor reads', 'investment', TRUE),
  ('investor_activity_v1', 'Investor activity log', 'Server-written immutable activity events', 'investment', TRUE),
  ('investor_dashboard_v2', 'Investor dashboard v2', 'Approved investor layout and behaviour', 'investment', TRUE),
  ('investor_introductions_v1', 'Investor introductions', 'Studio-reviewed introductions', 'investment', TRUE),
  ('investor_messaging_v1', 'Investor conversations', 'Introduction-gated messaging and unread reminders', 'investment', TRUE),
  ('investor_meetings_v1', 'Investor scheduling', 'Timezone-aware meeting scheduling', 'investment', TRUE),
  ('investor_investment_confirmation_v1', 'Investor investment confirmation', 'Studio confirmation before investment cascades', 'investment', TRUE),
  ('investor_onboarding_v1', 'Investor onboarding', 'Invitations and first-run guide', 'investment', TRUE),
  ('investor_nda_v1', 'Investor NDA', 'Keep off until approved bilingual legal text is available', 'investment', FALSE)
ON CONFLICT (flag_key) DO NOTHING;

UPDATE feature_flags
SET is_enabled = TRUE,
    updated_at = NOW()
WHERE flag_key IN (
  'investor_profile_privacy_v1',
  'investor_visibility_v1',
  'investor_activity_v1',
  'investor_dashboard_v2',
  'investor_introductions_v1',
  'investor_messaging_v1',
  'investor_meetings_v1',
  'investor_investment_confirmation_v1',
  'investor_onboarding_v1'
)
AND is_enabled IS DISTINCT FROM TRUE;

-- NDA remains disabled until legal text is approved (Guide decision #8).
UPDATE feature_flags
SET is_enabled = FALSE,
    updated_at = NOW()
WHERE flag_key = 'investor_nda_v1'
  AND is_enabled IS DISTINCT FROM FALSE;

COMMIT;
