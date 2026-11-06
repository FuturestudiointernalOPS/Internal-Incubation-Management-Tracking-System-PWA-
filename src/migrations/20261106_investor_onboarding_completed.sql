-- Phase 6 — first-run checklist completion marker.
BEGIN;

ALTER TABLE investor_profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Existing approved investors are not forced through the new checklist.
UPDATE investor_profiles
   SET onboarding_completed_at = COALESCE(onboarding_completed_at, NOW())
 WHERE approval_status = 'approved'
   AND onboarding_completed_at IS NULL;

COMMIT;
