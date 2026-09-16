-- =============================================================================
-- PRE-FLIGHT FOR B2 — migrations/sync_permission_config_from_staging.sql
-- =============================================================================
-- Read-only. Run against BOTH databases and compare the two outputs.
--
-- Its one documented failure mode is `responsibilities`: the table has
-- UNIQUE(name) AND UNIQUE(key), but the sync file conflicts on (name) only. If
-- this database already holds a DIFFERENT name owning one of staging's keys, that
-- single statement errors and the rest of the file still applies. Q2/Q3 show the
-- two sides side by side, so the collision is visible BEFORE the paste.
--
--   node scripts/db-audit/run-readonly.mjs migrations/preflight_permission_config_sync.sql .env.local
--   node scripts/db-audit/run-readonly.mjs migrations/preflight_permission_config_sync.sql .env.audit-staging
-- =============================================================================

-- Q1. The shape of the platform responsibilities table, so Q2's columns are known.
SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'responsibilities' ORDER BY ordinal_position;

-- Q2. Every responsibility, whole row. Compare the two databases.
SELECT * FROM responsibilities ORDER BY 1;

-- Q3. The unique constraints that can collide. Expect a UNIQUE on (name) and one on (key).
SELECT c.conname, pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c WHERE c.conrelid = 'public.responsibilities'::regclass AND c.contype IN ('p', 'u') ORDER BY 1;

-- Q4. Which profiles the sync will add vs overwrite, and how many capability rows
-- hang off each.
SELECT ap.name, ap.is_active, count(c.id) AS caps FROM access_profiles ap LEFT JOIN access_profile_capabilities c ON c.profile_id = ap.id GROUP BY ap.name, ap.is_active ORDER BY ap.name;

-- Q5. The row counts the sync rewrites.
SELECT (SELECT count(*) FROM access_profiles) AS profiles, (SELECT count(*) FROM access_profile_capabilities) AS profile_caps, (SELECT count(*) FROM role_capabilities) AS role_caps, (SELECT count(*) FROM role_access_profile_defaults) AS role_defaults, (SELECT count(*) FROM feature_eligibility) AS eligibility, (SELECT count(*) FROM responsibilities) AS responsibilities;

-- Q6. B3's target. Expect 0 rows before B3 runs — runs.edit is absent on both
-- databases, which is the whole reason the Program Manager sees 403.
SELECT count(*) AS runs_edit_rows_now FROM access_profile_capabilities WHERE module = 'runs' AND capability = 'edit';

-- Q7. And what that Program Manager actually holds today.
SELECT ap.name, c.module, c.capability, c.access_level FROM access_profile_capabilities c JOIN access_profiles ap ON ap.id = c.profile_id WHERE ap.name = 'Program Manager' AND c.module IN ('runs', 'communication') ORDER BY c.module, c.capability;

-- Q8. The marker the sync must NOT touch. Expect 14 here, 24 on staging.
SELECT count(*) AS authz_migrations FROM authz_migrations;
