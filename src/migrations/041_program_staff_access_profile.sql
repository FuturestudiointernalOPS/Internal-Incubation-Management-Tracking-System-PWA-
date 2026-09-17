-- =============================================================================
-- 041 — ACCESS PROFILE OVERRIDE ON A PROGRAM ASSIGNMENT
-- -----------------------------------------------------------------------------
-- Additive, idempotent migration. Safe to re-run.
--
-- Adds:
--   v2_program_staff.access_profile_id — an optional Access Profile carried by
--   ONE program assignment, so a person's effective capabilities can differ per
--   programme without changing the profile on their person record.
--
-- WHY THIS EXISTS
--   The assignment-derived program access reads this column in two places: to
--   derive a facilitator's per-program capability levels, and to backfill the
--   facilitator tick lists at boot. 040 added `permissions` (the tick list
--   itself) but never this column, so any database that did not receive it by
--   hand failed the read.
--
--   That failure was not confined to the new feature: the tick-list backfill
--   runs inside the one-time migration batch that EVERY authorization decision
--   awaits. One missing column therefore returned 500 from every gated endpoint,
--   and — because a failed migration is deliberately not recorded — it retried
--   on every single request, which is what produced the slow-query storm and the
--   exhausted connection pool in the logs.
--
--   The batch is now resilient to a failing migration (see
--   src/models/authorization/backfill.js), so this column is no longer able to
--   take the application down. It is still REQUIRED for the assignment-derived
--   access to resolve: without it, the derivation degrades to "no assignments"
--   (logged, fail-safe) and the tick-list backfill never runs.
--
-- DEFINITION
--   Mirrors contacts.access_profile_id (the per-person override): optional, and
--   cleaned up if the profile is deleted. NULL means "no override" — the
--   person's own profile, then the role's default profile, are used exactly as
--   before, so applying this changes nobody's access on its own.
-- =============================================================================

BEGIN;

ALTER TABLE v2_program_staff
  ADD COLUMN IF NOT EXISTS access_profile_id INTEGER
  REFERENCES access_profiles(id) ON DELETE SET NULL;

COMMIT;
