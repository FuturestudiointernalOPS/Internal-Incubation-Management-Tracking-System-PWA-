-- =============================================================================
-- PRODUCTION PRE-DEPLOYMENT VERIFICATION
-- Run this in the Supabase SQL editor (production) BEFORE any migration.
-- It is READ-ONLY — it does not modify any data.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────
-- 1. REQUIRED TABLES (the combined migration assumes these exist)
-- ─────────────────────────────────────────────────────────────
SELECT 'contact_roles'        AS object, to_regclass('public.contact_roles') IS NOT NULL        AS present
UNION ALL SELECT 'access_profiles',     to_regclass('public.access_profiles') IS NOT NULL
UNION ALL SELECT 'v2_program_staff',    to_regclass('public.v2_program_staff') IS NOT NULL
UNION ALL SELECT 'participant_programs', to_regclass('public.participant_programs') IS NOT NULL
UNION ALL SELECT 'v2_attendance',       to_regclass('public.v2_attendance') IS NOT NULL
UNION ALL SELECT 'v2_submissions',      to_regclass('public.v2_submissions') IS NOT NULL
UNION ALL SELECT 'v2_feedback',         to_regclass('public.v2_feedback') IS NOT NULL
UNION ALL SELECT 'v2_participants',     to_regclass('public.v2_participants') IS NOT NULL
UNION ALL SELECT 'contacts',            to_regclass('public.contacts') IS NOT NULL
UNION ALL SELECT 'v2_programs',         to_regclass('public.v2_programs') IS NOT NULL
ORDER BY object;

-- ─────────────────────────────────────────────────────────────
-- 2. CURRENT participant_id DATA TYPES (this tells us if migration was already applied)
-- ─────────────────────────────────────────────────────────────
SELECT table_name, column_name, data_type, udt_name
FROM information_schema.columns
WHERE (table_name IN ('v2_attendance','v2_submissions','v2_feedback','v2_participants','participant_programs'))
  AND column_name IN ('participant_id','user_id','cid')
ORDER BY table_name, column_name;

-- ─────────────────────────────────────────────────────────────
-- 3. participant_programs COLUMNS (need screening_status after migration)
-- ─────────────────────────────────────────────────────────────
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'participant_programs'
ORDER BY ordinal_position;

-- ─────────────────────────────────────────────────────────────
-- 4. contact_roles COLUMNS (need title, scope, status, access_profile_id, capability_overrides)
-- ─────────────────────────────────────────────────────────────
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'contact_roles'
ORDER BY ordinal_position;

-- ─────────────────────────────────────────────────────────────
-- 5. ROW COUNTS (baseline for before/after comparison)
-- ─────────────────────────────────────────────────────────────
SELECT 'contacts' AS tbl, COUNT(*) AS rows FROM contacts
UNION ALL SELECT 'v2_participants', COUNT(*) FROM v2_participants
UNION ALL SELECT 'v2_submissions', COUNT(*) FROM v2_submissions
UNION ALL SELECT 'v2_attendance', COUNT(*) FROM v2_attendance
UNION ALL SELECT 'v2_feedback', COUNT(*) FROM v2_feedback
UNION ALL SELECT 'participant_programs', COUNT(*) FROM participant_programs
UNION ALL SELECT 'v2_programs', COUNT(*) FROM v2_programs
UNION ALL SELECT 'contact_roles', COUNT(*) FROM contact_roles
ORDER BY tbl;

-- ─────────────────────────────────────────────────────────────
-- 6. ORPHANED participant_id CHECK (should be 0 after migration)
--    — counts rows whose participant_id does NOT match a contacts.cid
-- ─────────────────────────────────────────────────────────────
SELECT 'v2_submissions orphaned' AS check_name,
       COUNT(*) AS orphan_count
FROM v2_submissions s
WHERE NOT EXISTS (SELECT 1 FROM contacts c WHERE c.cid = s.participant_id::text)
UNION ALL
SELECT 'v2_attendance orphaned',
       COUNT(*)
FROM v2_attendance a
WHERE NOT EXISTS (SELECT 1 FROM contacts c WHERE c.cid = a.participant_id::text)
UNION ALL
SELECT 'v2_feedback orphaned',
       COUNT(*)
FROM v2_feedback f
WHERE NOT EXISTS (SELECT 1 FROM contacts c WHERE c.cid = f.participant_id::text);
