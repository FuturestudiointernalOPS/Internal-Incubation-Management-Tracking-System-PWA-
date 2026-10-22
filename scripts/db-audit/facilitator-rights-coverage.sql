-- Facilitator/contact-role coverage before the D-5 priority switch — READ ONLY.
--
-- Usage:
--   node scripts/db-audit/run-readonly.mjs \
--     scripts/db-audit/facilitator-rights-coverage.sql .env.local

-- 1. Current program assignments in the generalized layer, by role.
SELECT role, COUNT(*) AS assignments,
       COUNT(*) FILTER (WHERE capability_overrides IS NOT NULL
                         AND TRIM(capability_overrides::text) NOT IN ('', '{}', 'null')) AS with_overrides
FROM contact_roles
WHERE context_type = 'program' AND is_current = true
GROUP BY role
ORDER BY assignments DESC;

-- 2. Does every facilitator source resolve to a profile after the switch?
SELECT
  (SELECT COUNT(*) FROM v2_program_staff WHERE role = 'facilitator') AS staff_facilitator_rows,
  (SELECT COUNT(*) FROM v2_program_staff
     WHERE role = 'facilitator' AND profile_key IS NOT NULL AND profile_key <> '') AS with_explicit_key,
  (SELECT COUNT(*) FROM profile_capabilities WHERE profile_key = 'facilitator') AS facilitator_profile_caps;
