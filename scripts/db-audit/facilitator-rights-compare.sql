-- Facilitator rights — the two sources, compared (READ ONLY)
--
-- Usage:
--   node scripts/db-audit/run-readonly.mjs \
--     scripts/db-audit/facilitator-rights-compare.sql .env.local
--
-- Purpose (Lot 3, step 3.4 / D-5): before making the PROFILE the single source
-- of a facilitator's rights, measure how many assignments carry the per-row
-- checkbox override (`v2_program_staff.permissions`), how many have a profile
-- key, and what the profile actually grants.
--
-- No name, email or phone is selected.

-- 1. Totals.
SELECT
  COUNT(*) AS facilitator_assignments,
  COUNT(*) FILTER (WHERE permissions IS NOT NULL) AS with_permissions_column,
  COUNT(*) FILTER (
    WHERE permissions IS NOT NULL
      AND TRIM(permissions::text) NOT IN ('', '{}', 'null', '[]')
  ) AS with_checkbox_override,
  COUNT(*) FILTER (WHERE profile_key IS NOT NULL AND profile_key <> '') AS with_profile_key,
  COUNT(*) FILTER (WHERE profile_key IS NULL OR profile_key = '') AS without_profile_key
FROM v2_program_staff
WHERE role = 'facilitator';

-- 2. Which profile keys do facilitator assignments carry?
SELECT COALESCE(NULLIF(profile_key, ''), '(none)') AS profile_key, COUNT(*) AS assignments
FROM v2_program_staff
WHERE role = 'facilitator'
GROUP BY COALESCE(NULLIF(profile_key, ''), '(none)')
ORDER BY assignments DESC;

-- 3. What does the facilitator PROFILE grant?
SELECT profile_key, module, capability, access_level
FROM profile_capabilities
WHERE profile_key = 'facilitator'
ORDER BY module, capability;

-- 4. The rows themselves (identifiers only): the override, the profile, the
--    program default. `has_override` is what disappears when the profile
--    becomes the single source.
SELECT
  ps.id,
  CAST(ps.program_id AS TEXT) AS program_id,
  CAST(ps.staff_id AS TEXT) AS staff_id,
  COALESCE(NULLIF(ps.profile_key, ''), '(none)') AS profile_key,
  (ps.permissions IS NOT NULL
    AND TRIM(ps.permissions::text) NOT IN ('', '{}', 'null', '[]')) AS has_override,
  ps.permissions::text AS override_json,
  p.facilitator_default_permissions::text AS program_default_json
FROM v2_program_staff ps
LEFT JOIN v2_programs p ON CAST(p.id AS TEXT) = CAST(ps.program_id AS TEXT)
WHERE ps.role = 'facilitator'
ORDER BY ps.id;
