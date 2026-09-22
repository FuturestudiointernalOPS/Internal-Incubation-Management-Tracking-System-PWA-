-- =============================================================================
-- READ-ONLY — verify the retired `developer` / `admin` roles are fully gone
-- =============================================================================
-- The build that removed the `developer` role (and its Developer / Developer
-- Intern templates) and the already-retired `admin` role ships a boot migration,
-- `retire-developer-admin-roles-v1` (see src/models/authorization/backfill.js).
-- It runs ONCE per database and records its name in `authz_migrations`.
--
-- This script is the AFTER image: every query below should return 0 rows (or the
-- recorded marker). Run it against both databases once the build has served at
-- least one authenticated request (that request is what triggers the migration
-- burst — see docs/PRODUCTION_TEST.md §7).
--
--   node scripts/db-audit/run-readonly.mjs migrations/check_retired_developer_admin_roles.sql .env.local
--   node scripts/db-audit/run-readonly.mjs migrations/check_retired_developer_admin_roles.sql .env.audit-staging
-- =============================================================================

-- Q1. The retired templates must be gone from access_profiles.
SELECT id, name, is_active FROM access_profiles
 WHERE name IN ('Developer', 'Developer Intern')
 ORDER BY name;

-- Q2. No contact may still point at a retired template (the migration NULLs it).
SELECT c.cid, c.name, c.access_profile_id
  FROM contacts c
  JOIN access_profiles ap ON ap.id = c.access_profile_id
 WHERE ap.name IN ('Developer', 'Developer Intern')
 ORDER BY c.cid;

-- Q3. Retired role → profile default mappings (the old admin→Staff Default
--     mapping is what made Staff Default unsavable).
SELECT role_name, access_profile_id FROM role_access_profile_defaults
 WHERE role_name IN ('developer', 'admin')
 ORDER BY role_name;

-- Q4. Retired roles in the legacy role_capabilities fallback.
SELECT role, module, capability, access_level FROM role_capabilities
 WHERE role IN ('developer', 'admin')
 ORDER BY role, module, capability;

-- Q5. Retired roles in feature_eligibility (role rows only — group rows are
--     sacred and are never touched).
SELECT feature_key, identity_type, identity_value, eligible
  FROM feature_eligibility
 WHERE identity_type = 'role' AND identity_value IN ('developer', 'admin')
 ORDER BY feature_key;

-- Q6. The retired engineering.manage_developers capability, everywhere it could
--     have been granted. Every one of these tables must return 0 rows.
SELECT 'role_capabilities' AS table, role AS holder, module, capability FROM role_capabilities
 WHERE module = 'engineering' AND capability = 'manage_developers'
UNION ALL
SELECT 'group_capabilities', group_name, module, capability FROM group_capabilities
 WHERE module = 'engineering' AND capability = 'manage_developers'
UNION ALL
SELECT 'user_capabilities', user_cid, module, capability FROM user_capabilities
 WHERE module = 'engineering' AND capability = 'manage_developers'
UNION ALL
SELECT 'user_capability_restrictions', user_cid, module, capability FROM user_capability_restrictions
 WHERE module = 'engineering' AND capability = 'manage_developers'
UNION ALL
SELECT 'access_profile_capabilities', profile_id::text, module, capability FROM access_profile_capabilities
 WHERE module = 'engineering' AND capability = 'manage_developers'
UNION ALL
SELECT 'responsibility_capability_grants', user_cid, module, capability FROM responsibility_capability_grants
 WHERE module = 'engineering' AND capability = 'manage_developers';

-- Q7. THE BOOT CANARY — the migration's own marker. One row means it ran.
SELECT name, applied_at FROM authz_migrations
 WHERE name = 'retire-developer-admin-roles-v1';

-- Q8. Every recorded step, in name order. Diff production against staging: the
--     only name production should lack is the one from this release.
SELECT name FROM authz_migrations ORDER BY name;
