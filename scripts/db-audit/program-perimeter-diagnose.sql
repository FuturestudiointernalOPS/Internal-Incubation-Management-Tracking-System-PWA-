-- Diagnose the ONE divergence found by program-perimeter-compare.sql — READ ONLY.
--
-- Usage:
--   node scripts/db-audit/run-readonly.mjs \
--     scripts/db-audit/program-perimeter-diagnose.sql .env.local

-- 1. The staff rows that define the CURRENT perimeter.
SELECT CAST(program_id AS TEXT) AS program_id, CAST(staff_id AS TEXT) AS staff_id, role
FROM v2_program_staff
ORDER BY program_id, staff_id;

-- 2. The PROFILE assignments that define the TARGET perimeter.
SELECT CAST(contact_cid AS TEXT) AS contact_cid,
       profile_key,
       context_type,
       CAST(context_id AS TEXT) AS context_id,
       status,
       started_at,
       ends_at
FROM profile_assignments
WHERE profile_key = 'program_manager'
ORDER BY started_at;

-- 3. Is the staff_id an email that matches a contact (any casing)?
SELECT CAST(cid AS TEXT) AS cid,
       role,
       status,
       LOWER(TRIM(email)) AS email
FROM contacts
WHERE LOWER(TRIM(email)) LIKE '%christelle.fagbehouro%';

-- 4. The program row and its recorded manager.
SELECT CAST(id AS TEXT) AS id, name, CAST(assigned_pm_id AS TEXT) AS assigned_pm_id, status
FROM v2_programs;
