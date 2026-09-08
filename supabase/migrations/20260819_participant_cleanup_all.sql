-- =============================================================================
-- PARTICIPANT ARCHITECTURE CLEANUP — COMBINED MIGRATION (run once)
-- -----------------------------------------------------------------------------
-- Combines, in the correct order:
--   1. contact_roles assignment columns + backfill (Phase 1)
--   2. v2_attendance participant_id -> contacts.cid (Phase 4a)
--   3. v2_submissions participant_id UUID -> TEXT + backfill (Phase 4b)
--   4. v2_feedback participant_id UUID -> TEXT + backfill (Phase 4c)
--   5. participant_programs.screening_status (Fix Phase 2)
--
-- Wrapped in a single transaction: if any step fails, everything rolls back.
-- Idempotent and guarded (safe to re-run).
--
-- ⚠️ TAKE A DB SNAPSHOT BEFORE RUNNING — sections 3 and 4 change a column
-- type and drop a foreign key, which is intentionally less reversible.
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. GENERALIZE contact_roles AS THE PLATFORM ASSIGNMENT SOURCE OF TRUTH
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE contact_roles ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE contact_roles ADD COLUMN IF NOT EXISTS scope JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE contact_roles ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE contact_roles ADD COLUMN IF NOT EXISTS access_profile_id INTEGER REFERENCES access_profiles(id) ON DELETE SET NULL;
ALTER TABLE contact_roles ADD COLUMN IF NOT EXISTS capability_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE contact_roles
SET title = role
WHERE title IS NULL OR TRIM(title) = '';

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

CREATE INDEX IF NOT EXISTS idx_contact_roles_assignment
  ON contact_roles (contact_cid, context_type, context_id)
  WHERE is_current = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. NORMALIZE ATTENDANCE PARTICIPANT IDS (Phase 4a)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.v2_attendance') IS NOT NULL THEN
    UPDATE v2_attendance a
    SET participant_id = c.cid
    FROM v2_participants vp
    JOIN contacts c
      ON (c.cid = vp.user_id OR LOWER(c.email) = LOWER(vp.email))
    WHERE (a.participant_id = vp.id::text OR a.participant_id = vp.user_id)
      AND a.participant_id <> c.cid
      AND c.deleted = 0;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. NORMALIZE SUBMISSIONS PARTICIPANT IDS (Phase 4b)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  fk_name text;
BEGIN
  IF to_regclass('public.v2_submissions') IS NOT NULL THEN
    SELECT conname INTO fk_name
    FROM pg_constraint
    WHERE conrelid = 'v2_submissions'::regclass
      AND contype = 'f'
      AND conname ILIKE '%participant_id%';
    IF fk_name IS NOT NULL THEN
      EXECUTE format('ALTER TABLE v2_submissions DROP CONSTRAINT %I', fk_name);
    END IF;

    ALTER TABLE v2_submissions
      ALTER COLUMN participant_id TYPE TEXT USING participant_id::text;

    UPDATE v2_submissions s
    SET participant_id = c.cid
    FROM v2_participants vp
    JOIN contacts c
      ON (c.cid = vp.user_id OR LOWER(c.email) = LOWER(vp.email))
    WHERE s.participant_id = vp.id::text
      AND s.participant_id <> c.cid
      AND c.deleted = 0;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. NORMALIZE FEEDBACK PARTICIPANT IDS (Phase 4c)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  fk_name text;
BEGIN
  IF to_regclass('public.v2_feedback') IS NOT NULL THEN
    SELECT conname INTO fk_name
    FROM pg_constraint
    WHERE conrelid = 'v2_feedback'::regclass
      AND contype = 'f'
      AND conname ILIKE '%participant_id%';
    IF fk_name IS NOT NULL THEN
      EXECUTE format('ALTER TABLE v2_feedback DROP CONSTRAINT %I', fk_name);
    END IF;

    ALTER TABLE v2_feedback
      ALTER COLUMN participant_id TYPE TEXT USING participant_id::text;

    UPDATE v2_feedback f
    SET participant_id = c.cid
    FROM v2_participants vp
    JOIN contacts c
      ON (c.cid = vp.user_id OR LOWER(c.email) = LOWER(vp.email))
    WHERE f.participant_id = vp.id::text
      AND f.participant_id <> c.cid
      AND c.deleted = 0;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. ADD screening_status TO participant_programs (Fix Phase 2)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE participant_programs
  ADD COLUMN IF NOT EXISTS screening_status TEXT DEFAULT 'pending';

COMMIT;
