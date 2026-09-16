-- =============================================================================
-- READ-ONLY — the two pieces of the eligibility-ceiling change that are NOT code
-- =============================================================================
-- The build shipped in f1857b8e ("Reconcile templates with the eligibility
-- ceiling") does two things by itself: the insert-only catch-up migration
-- `eligibility-template-ceiling-v1`, and dropping the `admin -> Staff Default`
-- mapping from src/lib/auth.js. Two leftovers are NOT covered by either — the
-- code comment in src/lib/auth.js says the mapping is "removed by hand", and the
-- catch-up only INSERTS feature_eligibility rows, while
-- scripts/apply-template-ceiling-eligibility.mjs additionally DELETEs the retired
-- role's fallback capabilities.
--
-- Run against both databases:
--   node scripts/db-audit/run-readonly.mjs migrations/check_retired_admin_role.sql .env.local
--   node scripts/db-audit/run-readonly.mjs migrations/check_retired_admin_role.sql .env.audit-staging
-- =============================================================================

-- Q1. The retired `admin` role in the role_capabilities fallback. The boot
-- catch-up does NOT remove these; only the script does. A non-zero count means
-- every role_bound profile save can still be blocked by it.
SELECT role, module, capability, access_level FROM role_capabilities WHERE role = 'admin' ORDER BY module, capability;

-- Q2. The retired `admin` role in role_access_profile_defaults — the mapping the
-- code comment says is removed by hand. A row here is what pointed Staff Default
-- at an identity that can never be eligible for anything.
SELECT role_name, access_profile_id FROM role_access_profile_defaults WHERE role_name = 'admin';

-- Q3. The retired `admin` role in feature_eligibility.
SELECT feature_key, identity_type, identity_value, eligible FROM feature_eligibility WHERE identity_value = 'admin' ORDER BY feature_key;

-- Q4. Has the new ceiling catch-up run here yet? It is insert-only, so after it
-- runs there are exactly these 8 rows (communication x3, operations x3,
-- programs x2).
SELECT feature_key, identity_value FROM feature_eligibility WHERE identity_type = 'role' AND feature_key IN ('communication', 'operations', 'programs') AND identity_value IN ('participant', 'mentor', 'investor') ORDER BY feature_key, identity_value;

-- Q5. For context: what those three features carry today.
SELECT feature_key, count(*) AS role_rows FROM feature_eligibility WHERE identity_type = 'role' AND feature_key IN ('communication', 'operations', 'programs') GROUP BY feature_key ORDER BY feature_key;

-- Q6. THE BOOT CANARY. Every authz migration records its name here once it has
-- run, so this list is the proof of what the first authenticated request did.
-- Before that request: 14 names, WITHOUT `eligibility-template-ceiling-v1`.
-- After a healthy boot: 15 names, WITH it. If the count stays 14 AND requests
-- 500 with errors.authzSystemFailure, the chain failed at that step.
SELECT count(*) AS authz_migrations FROM authz_migrations;

-- Q7. The step G added, called out by name.
SELECT name FROM authz_migrations WHERE name = 'eligibility-template-ceiling-v1';

-- Q8. Every recorded step, in name order. Diff production against staging: the
-- only name production should lack is the one from this release.
SELECT name FROM authz_migrations ORDER BY name;
