-- =============================================================================
-- PHASE 1B — 00_ENVIRONMENT_CHECK (RUN FIRST, MANUAL REVIEW ONLY)
-- -----------------------------------------------------------------------------
-- Goal: confirm WHICH environment you are about to touch and whether the
-- schema required by the reconciliation scripts actually exists.
--
-- RULES:
--   * Read-only. No data is modified by this script.
--   * If the database name below is PRODUCTION, STOP and obtain explicit
--     approval before executing ANY of the 01-05 scripts.
--   * If any "MISSING" row appears in the schema check, do NOT run 01-05
--     until the schema gap is explained.
-- =============================================================================

-- 1. WHERE ARE WE?
SELECT current_database()                AS db_name,
       current_user                      AS db_user,
       inet_server_addr()                AS server_addr,
       version()                         AS server_version,
       NOW()                             AS checked_at;

-- 2. ROW COUNTS (baseline for the reconciliation reports)
SELECT 'contacts'                   AS tbl, COUNT(*)::bigint AS rows FROM contacts
UNION ALL SELECT 'participant_programs', COUNT(*)::bigint FROM participant_programs
UNION ALL SELECT 'contact_roles', COUNT(*)::bigint FROM contact_roles
UNION ALL SELECT 'v2_program_staff', COUNT(*)::bigint FROM v2_program_staff
UNION ALL SELECT 'v2_participants', COUNT(*)::bigint FROM v2_participants
UNION ALL SELECT 'v2_programs', COUNT(*)::bigint FROM v2_programs
UNION ALL SELECT 'families', COUNT(*)::bigint FROM families
UNION ALL SELECT 'user_groups', COUNT(*)::bigint FROM user_groups
UNION ALL SELECT 'user_responsibilities', COUNT(*)::bigint FROM user_responsibilities
UNION ALL SELECT 'access_profiles', COUNT(*)::bigint FROM access_profiles
UNION ALL SELECT 'access_profile_capabilities', COUNT(*)::bigint FROM access_profile_capabilities
UNION ALL SELECT 'role_access_profile_defaults', COUNT(*)::bigint FROM role_access_profile_defaults
UNION ALL SELECT 'role_capabilities', COUNT(*)::bigint FROM role_capabilities
UNION ALL SELECT 'user_capabilities', COUNT(*)::bigint FROM user_capabilities
UNION ALL SELECT 'user_capability_restrictions', COUNT(*)::bigint FROM user_capability_restrictions
UNION ALL SELECT 'venture_members', COUNT(*)::bigint FROM venture_members
ORDER BY tbl;

-- 3. SCHEMA PRESENCE CHECK — the generalized assignment columns MUST exist
--    before 02/03 backfills touch contact_roles.
SELECT 'contact_roles' AS tbl, 'title' AS column_name,
       COUNT(*) FILTER (WHERE column_name = 'title')::int AS present
  FROM information_schema.columns WHERE table_name = 'contact_roles'
UNION ALL
SELECT 'contact_roles', 'scope', COUNT(*) FILTER (WHERE column_name = 'scope')::int
  FROM information_schema.columns WHERE table_name = 'contact_roles'
UNION ALL
SELECT 'contact_roles', 'status', COUNT(*) FILTER (WHERE column_name = 'status')::int
  FROM information_schema.columns WHERE table_name = 'contact_roles'
UNION ALL
SELECT 'contact_roles', 'access_profile_id', COUNT(*) FILTER (WHERE column_name = 'access_profile_id')::int
  FROM information_schema.columns WHERE table_name = 'contact_roles'
UNION ALL
SELECT 'contact_roles', 'capability_overrides', COUNT(*) FILTER (WHERE column_name = 'capability_overrides')::int
  FROM information_schema.columns WHERE table_name = 'contact_roles'
UNION ALL
SELECT 'v2_program_staff', 'permissions', COUNT(*) FILTER (WHERE column_name = 'permissions')::int
  FROM information_schema.columns WHERE table_name = 'v2_program_staff'
UNION ALL
SELECT 'participant_programs', 'status', COUNT(*) FILTER (WHERE column_name = 'status')::int
  FROM information_schema.columns WHERE table_name = 'participant_programs'
UNION ALL
SELECT 'families', 'lead_facilitator_id', COUNT(*) FILTER (WHERE column_name = 'lead_facilitator_id')::int
  FROM information_schema.columns WHERE table_name = 'families'
ORDER BY tbl, column_name;

-- Interpretation: any row with present = 0 means the column is missing in this
-- environment. Stop and report before continuing.
