-- Program perimeter — CURRENT vs PROFILE-BASED (READ ONLY)
--
-- Usage:
--   node scripts/db-audit/run-readonly.mjs \
--     scripts/db-audit/program-perimeter-compare.sql .env.local
--
-- Purpose (Lot 3, step 3.1 / D-4): before switching the enforced program
-- perimeter from "staffed on the program" to "holds the program_manager
-- PROFILE", list who would GAIN and who would LOSE access.
--
-- The two sets are built exactly as the application reads them:
--   CURRENT  (program_staffed): v2_program_staff rows (staff_id may hold a cid
--            OR an email) UNION v2_programs.assigned_pm_id.
--   TARGET   (program_managed): active program_manager profile assignment in
--            the program context, inside its validity period.
--
-- No name, email or phone is selected.

-- 1. Shape check — does profile_assignments.context_id hold program ids?
SELECT
  COUNT(*) AS program_manager_assignments,
  COUNT(*) FILTER (WHERE context_id ~ '^[0-9]+$') AS numeric_context_ids,
  COUNT(*) FILTER (WHERE context_id !~ '^[0-9]+$') AS non_numeric_context_ids,
  COUNT(*) FILTER (
    WHERE context_id IN (SELECT CAST(id AS TEXT) FROM v2_programs)
  ) AS ids_matching_a_program
FROM profile_assignments
WHERE context_type = 'program'
  AND profile_key = 'program_manager';

-- 2. Totals: current pairs, target pairs, gains, losses, people.
WITH staffed AS (
  SELECT DISTINCT
         COALESCE(c_cid.cid, c_email.cid, CAST(s.staff_id AS TEXT)) AS who,
         CAST(s.program_id AS TEXT) AS program_id
  FROM v2_program_staff s
  LEFT JOIN contacts c_cid
    ON CAST(c_cid.cid AS TEXT) = CAST(s.staff_id AS TEXT)
  LEFT JOIN contacts c_email
    ON LOWER(TRIM(c_email.email)) = LOWER(TRIM(CAST(s.staff_id AS TEXT)))
  UNION
  SELECT DISTINCT CAST(p.assigned_pm_id AS TEXT), CAST(p.id AS TEXT)
  FROM v2_programs p
  WHERE p.assigned_pm_id IS NOT NULL
),
managed AS (
  SELECT DISTINCT CAST(pa.contact_cid AS TEXT) AS who, CAST(pa.context_id AS TEXT) AS program_id
  FROM profile_assignments pa
  WHERE pa.context_type = 'program'
    AND pa.profile_key = 'program_manager'
    AND pa.status = 'active'
    AND (pa.started_at IS NULL OR pa.started_at <= NOW())
    AND (pa.ends_at IS NULL OR pa.ends_at > NOW())
    AND pa.context_id IS NOT NULL
)
SELECT
  (SELECT COUNT(*) FROM staffed) AS current_pairs,
  (SELECT COUNT(*) FROM managed) AS target_pairs,
  (SELECT COUNT(DISTINCT who) FROM staffed) AS current_people,
  (SELECT COUNT(DISTINCT who) FROM managed) AS target_people,
  (SELECT COUNT(*) FROM staffed s
    WHERE NOT EXISTS (SELECT 1 FROM managed m
                      WHERE m.who = s.who AND m.program_id = s.program_id)) AS pairs_that_would_lose,
  (SELECT COUNT(*) FROM managed m
    WHERE NOT EXISTS (SELECT 1 FROM staffed s
                      WHERE s.who = m.who AND s.program_id = m.program_id)) AS pairs_that_would_gain;

-- 3. Per-program summary — where the switch bites.
WITH staffed AS (
  SELECT DISTINCT
         COALESCE(c_cid.cid, c_email.cid, CAST(s.staff_id AS TEXT)) AS who,
         CAST(s.program_id AS TEXT) AS program_id
  FROM v2_program_staff s
  LEFT JOIN contacts c_cid
    ON CAST(c_cid.cid AS TEXT) = CAST(s.staff_id AS TEXT)
  LEFT JOIN contacts c_email
    ON LOWER(TRIM(c_email.email)) = LOWER(TRIM(CAST(s.staff_id AS TEXT)))
  UNION
  SELECT DISTINCT CAST(p.assigned_pm_id AS TEXT), CAST(p.id AS TEXT)
  FROM v2_programs p
  WHERE p.assigned_pm_id IS NOT NULL
),
managed AS (
  SELECT DISTINCT CAST(pa.contact_cid AS TEXT) AS who, CAST(pa.context_id AS TEXT) AS program_id
  FROM profile_assignments pa
  WHERE pa.context_type = 'program'
    AND pa.profile_key = 'program_manager'
    AND pa.status = 'active'
    AND (pa.started_at IS NULL OR pa.started_at <= NOW())
    AND (pa.ends_at IS NULL OR pa.ends_at > NOW())
    AND pa.context_id IS NOT NULL
),
divergence AS (
  SELECT s.program_id, 'lose' AS direction, s.who
  FROM staffed s
  WHERE NOT EXISTS (SELECT 1 FROM managed m
                    WHERE m.who = s.who AND m.program_id = s.program_id)
  UNION ALL
  SELECT m.program_id, 'gain' AS direction, m.who
  FROM managed m
  WHERE NOT EXISTS (SELECT 1 FROM staffed s
                    WHERE s.who = m.who AND s.program_id = m.program_id)
)
SELECT
  d.program_id,
  p.name AS program_name,
  COUNT(*) FILTER (WHERE d.direction = 'lose') AS would_lose,
  COUNT(*) FILTER (WHERE d.direction = 'gain') AS would_gain
FROM divergence d
LEFT JOIN v2_programs p ON CAST(p.id AS TEXT) = d.program_id
GROUP BY d.program_id, p.name
ORDER BY (COUNT(*)) DESC, d.program_id;

-- 4. The pairs themselves (cids and program ids only — no names).
WITH staffed AS (
  SELECT DISTINCT
         COALESCE(c_cid.cid, c_email.cid, CAST(s.staff_id AS TEXT)) AS who,
         CAST(s.program_id AS TEXT) AS program_id
  FROM v2_program_staff s
  LEFT JOIN contacts c_cid
    ON CAST(c_cid.cid AS TEXT) = CAST(s.staff_id AS TEXT)
  LEFT JOIN contacts c_email
    ON LOWER(TRIM(c_email.email)) = LOWER(TRIM(CAST(s.staff_id AS TEXT)))
  UNION
  SELECT DISTINCT CAST(p.assigned_pm_id AS TEXT), CAST(p.id AS TEXT)
  FROM v2_programs p
  WHERE p.assigned_pm_id IS NOT NULL
),
managed AS (
  SELECT DISTINCT CAST(pa.contact_cid AS TEXT) AS who, CAST(pa.context_id AS TEXT) AS program_id
  FROM profile_assignments pa
  WHERE pa.context_type = 'program'
    AND pa.profile_key = 'program_manager'
    AND pa.status = 'active'
    AND (pa.started_at IS NULL OR pa.started_at <= NOW())
    AND (pa.ends_at IS NULL OR pa.ends_at > NOW())
    AND pa.context_id IS NOT NULL
)
SELECT 'lose' AS direction, s.who, s.program_id
FROM staffed s
WHERE NOT EXISTS (SELECT 1 FROM managed m
                  WHERE m.who = s.who AND m.program_id = s.program_id)
UNION ALL
SELECT 'gain' AS direction, m.who, m.program_id
FROM managed m
WHERE NOT EXISTS (SELECT 1 FROM staffed s
                  WHERE s.who = m.who AND s.program_id = m.program_id)
ORDER BY direction, program_id, who;
