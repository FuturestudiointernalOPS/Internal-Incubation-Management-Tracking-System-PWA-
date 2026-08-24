-- =============================================================================
-- PHASE 3A — ROLE-ELEVATION PREPASS (MANUAL REVIEW — READ-ONLY BY DEFAULT)
-- -----------------------------------------------------------------------------
-- Phase 3A removed the login "elevation" branches: a facilitator/PM assignment
-- no longer turns into a global session role. From now on, the global role
-- comes ONLY from contacts.role.
--
-- Users who previously relied on elevation (assignment without an explicit
-- contacts.role) will now land on /workspaces and enter their contexts from
-- there — which is the intended behavior. If you want to PRESERVE their old
-- landing, set contacts.role explicitly using the guarded UPDATE at the end.
--
-- RUN THE SELECTS FIRST and review before running any UPDATE.
-- =============================================================================

-- 1. Facilitators who were elevated via v2_program_staff assignment but whose
--    contacts.role is NOT 'facilitator' (and not another explicit privileged role).
SELECT ps.staff_id AS assignment_id,
       c.cid, c.name, c.email, c.role, c.status,
       ps.program_id, ps.created_at AS assigned_at
FROM v2_program_staff ps
JOIN contacts c
  ON (c.cid = ps.staff_id OR LOWER(TRIM(c.email)) = LOWER(TRIM(ps.staff_id)))
WHERE ps.role = 'facilitator'
  AND LOWER(COALESCE(c.role,'')) <> 'facilitator'
  AND LOWER(COALESCE(c.role,'')) NOT IN ('super_admin','staff','program_manager','teacher','developer')
ORDER BY c.email;

-- 2. Program Managers who were elevated via v2_programs.assigned_pm_id but whose
--    contacts.role is NOT 'program_manager' (and not another explicit role).
SELECT p.assigned_pm_id AS assigned_id,
       c.cid, c.name, c.email, c.role, c.status,
       COUNT(*) AS program_count
FROM v2_programs p
JOIN contacts c ON c.cid = p.assigned_pm_id
WHERE LOWER(COALESCE(c.role,'')) <> 'program_manager'
  AND LOWER(COALESCE(c.role,'')) NOT IN ('super_admin','staff','teacher','developer')
GROUP BY p.assigned_pm_id, c.cid, c.name, c.email, c.role, c.status
ORDER BY c.email;

-- 3. MANUAL (only after review): preserve the old landing by setting an explicit
--    global role. Replace the placeholder CID lists with the reviewed rows.
-- UPDATE contacts SET role = 'facilitator'
--   WHERE cid IN (/* reviewed facilitator cids */);
-- UPDATE contacts SET role = 'program_manager'
--   WHERE cid IN (/* reviewed PM cids */);
