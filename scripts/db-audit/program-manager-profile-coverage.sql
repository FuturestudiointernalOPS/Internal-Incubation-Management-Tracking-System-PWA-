-- Program-manager profile coverage — READ ONLY
--
-- Usage:
--   node scripts/db-audit/run-readonly.mjs scripts/db-audit/program-manager-profile-coverage.sql .env.local
--
-- Purpose: before enabling AUTHZ_PM_IDENTITY=staff (D-1), prove that nobody
-- who carries the legacy `program_manager` role loses their function, and that
-- every staff member managing a program holds the equivalent PROFILE.
--
-- Every statement is a SELECT. The runner refuses anything else.

-- 1. How many contacts still carry the legacy global role?
SELECT role, COUNT(*) AS n
FROM contacts
WHERE LOWER(COALESCE(role, '')) = 'program_manager'
GROUP BY role;

-- 2. How many people hold an ACTIVE program_manager profile (real source of
--    the PM function after the switch)?
SELECT COUNT(DISTINCT contact_cid) AS people_with_active_pm_profile
FROM profile_assignments
WHERE profile_key = 'program_manager'
  AND status = 'active'
  AND (ends_at IS NULL OR ends_at > NOW())
  AND (started_at IS NULL OR started_at <= NOW());

-- 3. The gap that blocks activation: a legacy program_manager contact with NO
--    active program_manager profile.
WITH legacy AS (
  SELECT cid FROM contacts WHERE LOWER(COALESCE(role, '')) = 'program_manager'
),
active_pm AS (
  SELECT DISTINCT contact_cid FROM profile_assignments
  WHERE profile_key = 'program_manager'
    AND status = 'active'
    AND (ends_at IS NULL OR ends_at > NOW())
    AND (started_at IS NULL OR started_at <= NOW())
)
SELECT COUNT(*) AS legacy_pm_without_profile
FROM legacy l
LEFT JOIN active_pm a ON a.contact_cid = l.cid
WHERE a.contact_cid IS NULL;

-- 4. Per-person listing (PRIVATE — run it only when the aggregate reports a
--    gap, and keep the output out of shared logs). It is deliberately NOT part
--    of the default audit so the aggregate run never prints names or emails.
--    Uncomment the block below if a case-by-case review is needed.
--
-- WITH active_pm AS (
--   SELECT DISTINCT contact_cid FROM profile_assignments
--   WHERE profile_key = 'program_manager'
--     AND status = 'active'
--     AND (ends_at IS NULL OR ends_at > NOW())
--     AND (started_at IS NULL OR started_at <= NOW())
-- )
-- SELECT
--   c.cid,
--   c.name,
--   c.email,
--   c.role,
--   (a.contact_cid IS NOT NULL) AS has_active_pm_profile,
--   EXISTS (
--     SELECT 1 FROM v2_program_staff s
--     WHERE LOWER(COALESCE(s.role, '')) = 'program_manager'
--       AND (
--         CAST(s.staff_id AS TEXT) = CAST(c.cid AS TEXT)
--         OR LOWER(TRIM(CAST(s.staff_id AS TEXT))) = LOWER(TRIM(COALESCE(c.email, '')))
--       )
--   ) AS has_pm_staff_assignment,
--   EXISTS (
--     SELECT 1 FROM v2_programs p
--     WHERE CAST(p.assigned_pm_id AS TEXT) = CAST(c.cid AS TEXT)
--   ) AS is_named_pm
-- FROM contacts c
-- LEFT JOIN active_pm a ON a.contact_cid = c.cid
-- WHERE LOWER(COALESCE(c.role, '')) = 'program_manager'
-- ORDER BY (a.contact_cid IS NOT NULL), c.name;

-- 5. A staff member with a program-manager assignment but no profile card is a
--    reconciliation gap: the flag must not be enabled while this count is > 0.
WITH assigned AS (
  SELECT DISTINCT CAST(c.cid AS TEXT) AS cid
  FROM contacts c
  JOIN v2_program_staff s
    ON LOWER(COALESCE(s.role, '')) = 'program_manager'
   AND (
     CAST(s.staff_id AS TEXT) = CAST(c.cid AS TEXT)
     OR LOWER(TRIM(CAST(s.staff_id AS TEXT))) = LOWER(TRIM(COALESCE(c.email, '')))
   )
  UNION
  SELECT DISTINCT CAST(c.cid AS TEXT) AS cid
  FROM contacts c
  JOIN v2_programs p ON CAST(p.assigned_pm_id AS TEXT) = CAST(c.cid AS TEXT)
),
active_pm AS (
  SELECT DISTINCT CAST(contact_cid AS TEXT) AS cid FROM profile_assignments
  WHERE profile_key = 'program_manager'
    AND status = 'active'
    AND (ends_at IS NULL OR ends_at > NOW())
    AND (started_at IS NULL OR started_at <= NOW())
)
SELECT COUNT(*) AS pm_assignment_without_profile
FROM assigned a
LEFT JOIN active_pm p ON p.cid = a.cid
WHERE p.cid IS NULL;
