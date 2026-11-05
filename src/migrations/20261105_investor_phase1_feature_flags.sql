-- Investor Platform v2, Phase 1. Additive preparation only.
-- Reuse feature_flags from 028_admin_config.sql; run that prerequisite first.
-- Explicit FALSE overrides the table's TRUE default. Re-running never changes
-- an existing operator choice. No automatic execution from request handlers.
BEGIN;
INSERT INTO feature_flags (flag_key, flag_name, description, category, is_enabled)
VALUES
  ('investor_profile_privacy_v1', 'Investor profile privacy', 'Allowlisted self-service profile responses', 'investment', FALSE),
  ('investor_visibility_v1', 'Investor visibility modes', 'Reserved: requires complete endpoint visibility enforcement', 'investment', FALSE),
  ('investor_activity_v1', 'Investor activity log', 'Reserved: requires compatible immutable server event storage', 'investment', FALSE),
  ('investor_dashboard_v2', 'Investor dashboard v2', 'Reserved: approved investor layout and behaviour', 'investment', FALSE),
  ('investor_introductions_v1', 'Investor introductions', 'Reserved: studio-reviewed introductions', 'investment', FALSE),
  ('investor_messaging_v1', 'Investor conversations', 'Reserved: introduction-gated messaging and unread reminders', 'investment', FALSE),
  ('investor_meetings_v1', 'Investor scheduling', 'Reserved: timezone-aware meeting scheduling', 'investment', FALSE),
  ('investor_investment_confirmation_v1', 'Investor investment confirmation', 'Reserved: studio confirmation before investment cascades', 'investment', FALSE),
  ('investor_onboarding_v1', 'Investor onboarding', 'Reserved: invitations and first-run guide', 'investment', FALSE),
  ('investor_nda_v1', 'Investor NDA', 'Reserved: keep off until approved bilingual legal text is available', 'investment', FALSE)
ON CONFLICT (flag_key) DO NOTHING;
COMMIT;
