-- ═══════════════════════════════════════════════════════════════════════════════
-- STAGING DATABASE WIPE — KEEP SUPER ADMIN ONLY
-- ═══════════════════════════════════════════════════════════════════════════════
-- ⚠️  DANGER: This PERMANENTLY DELETES ALL APPLICATION DATA.
--
-- Run this ONLY against STAGING. Never against production.
--
-- What it does:
--   1. Truncates every table in the `public` schema EXCEPT `contacts`.
--   2. Deletes every contact whose role is NOT 'super_admin'.
--   3. Resets auto-increment identity sequences.
--
-- Preserved:
--   • All contacts where contacts.role = 'super_admin' (and their password).
--
-- Not preserved (will be emptied):
--   • All programs, groups, families, forms, runs, submissions, participants,
--     facilitators, staff assignments, sessions, tasks, emails, timeline, etc.
--   • All login sessions (super admin will need to log in again).
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Optional safety guard ─────────────────────────────────────────────────────
-- Uncomment to refuse running against a database whose name looks like production.
--
-- DO $$
-- BEGIN
--   IF current_database() ILIKE '%prod%' THEN
--     RAISE EXCEPTION 'Refusing to wipe a production database';
--   END IF;
-- END $$;

-- ── 1. Truncate all public tables except `contacts` ───────────────────────────
-- This also clears dependent tables via CASCADE and resets sequences.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> 'contacts'
  LOOP
    EXECUTE format('TRUNCATE TABLE public.%I RESTART IDENTITY CASCADE', r.tablename);
  END LOOP;
END $$;

-- ── 2. Delete all contacts except super admins ────────────────────────────────
DELETE FROM contacts
WHERE role IS NULL
   OR role <> 'super_admin';

COMMIT;

-- ── Verify what remains (should list only your super admin account(s)) ────────
SELECT cid, name, email, role, status
FROM contacts
ORDER BY created_at DESC;
