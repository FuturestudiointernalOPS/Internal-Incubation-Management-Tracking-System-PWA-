-- =============================================================================
-- 20260818 — GENERALIZE contact_roles AS THE PLATFORM ASSIGNMENT SOURCE OF TRUTH
-- -----------------------------------------------------------------------------
-- Phase 1 (additive, non-destructive). No existing data is deleted or modified
-- except the additive backfill below.
--
-- Adds the assignment dimensions to `contact_roles` and mirrors existing
-- v2_program_staff assignments into it idempotently. This prepares the data
-- for the later assignment model WITHOUT changing current behavior.
--
-- Does NOT:
--   - drop, rename, or delete any table/column/row
--   - change v2_program_staff
--   - retire contacts.role / the global "facilitator" role
--   - change login, navigation, guards, or dashboards
-- =============================================================================

BEGIN;

-- 1. Additive assignment columns -------------------------------------------
ALTER TABLE contact_roles ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE contact_roles ADD COLUMN IF NOT EXISTS scope JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE contact_roles ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE contact_roles ADD COLUMN IF NOT EXISTS access_profile_id INTEGER REFERENCES access_profiles(id) ON DELETE SET NULL;
ALTER TABLE contact_roles ADD COLUMN IF NOT EXISTS capability_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2. Backfill the title on any existing assignment rows --------------------
-- For now the assignment title equals the legacy role value; this is a safe
-- one-time derivation and will be refined when the real titles are introduced.
UPDATE contact_roles
SET title = role
WHERE title IS NULL OR TRIM(title) = '';

-- 3. Mirror existing program assignments into contact_roles (idempotent) ---
-- Resolve staff_id to a real contact cid because some legacy rows store email.
-- scope defaults to the whole program for now; fine-grained group/individual
-- scope is enriched in a later phase.
INSERT INTO contact_roles
  (contact_cid, role, context_type, context_id, is_current, title, scope, status, capability_overrides, assigned_by)
SELECT
  c.cid,
  ps.role,
  'program',
  CAST(ps.program_id AS TEXT),
  true,
  ps.role,
  '{"type":"program"}'::jsonb,
  'active',
  COALESCE(ps.permissions, '{}'::jsonb),
  'system'
FROM v2_program_staff ps
JOIN contacts c
  ON (c.cid = ps.staff_id OR LOWER(c.email) = LOWER(ps.staff_id))
WHERE c.deleted = 0
  AND NOT EXISTS (
    SELECT 1
    FROM contact_roles cr
    WHERE cr.contact_cid = c.cid
      AND cr.context_type = 'program'
      AND cr.context_id = CAST(ps.program_id AS TEXT)
      AND cr.role = ps.role
      AND cr.is_current = true
  );

-- 4. Lookup index (non-unique on purpose; a unique partial index is a later
--    phase after any pre-existing duplicates are reviewed). -----------------
CREATE INDEX IF NOT EXISTS idx_contact_roles_assignment
  ON contact_roles (contact_cid, context_type, context_id)
  WHERE is_current = true;

COMMIT;
