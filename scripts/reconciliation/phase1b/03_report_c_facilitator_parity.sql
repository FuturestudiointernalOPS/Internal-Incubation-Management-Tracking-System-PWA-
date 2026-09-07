-- =============================================================================
-- PHASE 1B — 03_REPORT_C_FACILITATOR_PARITY
-- -----------------------------------------------------------------------------
-- Part 1: READ-ONLY parity audit between v2_program_staff and contact_roles.
-- Part 2: INSERT-only backfill of MISSING contact_roles rows (idempotent).
--
-- v2_program_staff remains the operational source of truth. contact_roles is
-- the generalized mirror. Nothing here touches v2_program_staff.
-- =============================================================================

-- ── PART 1: AUDIT ────────────────────────────────────────────────────────────

-- C1. Facilitator parity summary
SELECT
  (SELECT COUNT(*)::bigint FROM v2_program_staff WHERE role = 'facilitator') AS total_facilitators,
  (SELECT COUNT(*)::bigint FROM v2_program_staff WHERE role = 'facilitator' AND deleted = 0) AS active_facilitators,
  (SELECT COUNT(*)::bigint FROM contact_roles WHERE role = 'facilitator' AND context_type = 'program' AND is_current = true) AS current_facilitator_contact_roles;

-- C2. v2_program_staff rows WITHOUT an equivalent current contact_roles row
--     (MISSING CONTACT ROLE -> candidates for Part 2)
SELECT ps.id AS program_staff_id, ps.program_id, ps.staff_id, ps.role, ps.permissions, ps.created_at
FROM v2_program_staff ps
WHERE NOT EXISTS (
  SELECT 1 FROM contact_roles cr
  WHERE cr.contact_cid = ps.staff_id
    AND cr.role = LOWER(ps.role)
    AND cr.context_type = 'program'
    AND cr.context_id::text = ps.program_id::text
    AND cr.is_current = true
)
ORDER BY ps.program_id, ps.staff_id;

-- C3. contact_roles rows WITHOUT an equivalent v2_program_staff row
--     (MISSING PROGRAM STAFF -> v2_program_staff was likely deleted; the
--      contact_roles row is intentionally preserved history. Report only.)
SELECT cr.id AS contact_role_id, cr.contact_cid, cr.context_id AS program_id, cr.role, cr.status, cr.is_current
FROM contact_roles cr
WHERE cr.context_type = 'program' AND cr.is_current = true
  AND NOT EXISTS (
    SELECT 1 FROM v2_program_staff ps
    WHERE ps.staff_id = cr.contact_cid
      AND ps.role = LOWER(cr.role)
      AND ps.program_id::text = cr.context_id::text
  )
ORDER BY cr.contact_cid;

-- C4. ROLE/PROGRAM MISMATCHES between the two layers (report only)
SELECT ps.id AS program_staff_id, ps.program_id, ps.staff_id, ps.role AS ps_role,
       cr.id AS contact_role_id, cr.context_id AS cr_program_id, cr.role AS cr_role
FROM v2_program_staff ps
JOIN contact_roles cr
  ON cr.contact_cid = ps.staff_id
 AND cr.context_type = 'program'
 AND cr.context_id::text = ps.program_id::text
 AND cr.is_current = true
 AND (cr.role <> LOWER(ps.role))
ORDER BY ps.staff_id;

-- C5. DUPLICATE current facilitator contact_roles per (contact, program)
SELECT contact_cid, context_id AS program_id, COUNT(*)::int AS n
FROM contact_roles
WHERE context_type = 'program' AND is_current = true AND role = 'facilitator'
GROUP BY contact_cid, context_id
HAVING COUNT(*) > 1
ORDER BY n DESC;

-- ── PART 2: INSERT-ONLY BACKFILL (MANUAL REVIEW, THEN RUN) ──────────────────
-- Creates the missing contact_roles representation for every v2_program_staff
-- row whose contact still exists and is not deleted. Idempotent.
-- capability_overrides mirrors v2_program_staff.permissions so permission
-- parity is preserved. Resolution order is unchanged (v2_program_staff first).
INSERT INTO contact_roles
  (contact_cid, role, context_type, context_id, is_current, title, scope, status, capability_overrides, assigned_by)
SELECT c.cid,
       LOWER(ps.role),
       'program',
       ps.program_id::text,
       true,
       LOWER(ps.role),
       '{"type":"program"}'::jsonb,
       'active',
       COALESCE(ps.permissions, '{}'::jsonb),
       'system'
FROM v2_program_staff ps
JOIN contacts c
  ON (c.cid = ps.staff_id OR LOWER(TRIM(c.email)) = LOWER(TRIM(ps.staff_id)))
 AND c.deleted = 0
WHERE NOT EXISTS (
  SELECT 1 FROM contact_roles cr
  WHERE cr.contact_cid = c.cid
    AND cr.role = LOWER(ps.role)
    AND cr.context_type = 'program'
    AND cr.context_id::text = ps.program_id::text
    AND cr.is_current = true
)
ON CONFLICT DO NOTHING;

-- To backfill ONLY facilitators, append:  AND ps.role = 'facilitator'  before
-- the NOT EXISTS clause. By default this mirrors ALL program-staff roles,
-- matching the V1 program-staff route behavior.
