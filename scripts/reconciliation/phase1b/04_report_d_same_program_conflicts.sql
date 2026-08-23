-- =============================================================================
-- PHASE 1B — 04_REPORT_D_SAME_PROGRAM_CONFLICTS (READ-ONLY)
-- -----------------------------------------------------------------------------
-- A person may be a participant in Program A and a facilitator in Program B.
-- A person may NOT simultaneously be participant AND facilitator in the SAME
-- program. This report lists every violation. NO destructive correction —
-- classify manually using created dates and statuses.
-- =============================================================================

SELECT
  c.cid                                     AS contact,
  c.name                                    AS name,
  c.email                                   AS email,
  ps.program_id                             AS program_id,
  p.name                                    AS program_name,
  pp.id                                     AS participant_record_id,
  pp.status                                 AS participant_status,
  pp.created_at                             AS participant_created,
  ps.id                                     AS facilitator_record_id,
  ps.created_at                             AS facilitator_created,
  CASE
    WHEN pp.status IN ('completed','rejected','withdrawn','inactive') THEN 'POSSIBLE_HISTORICAL_STATE'
    WHEN pp.status IN ('pending','applied') AND ps.created_at > pp.created_at THEN 'LIKELY_ERROR'
    WHEN pp.status IN ('pending','applied') THEN 'AMBIGUOUS'
    ELSE 'LIKELY_ERROR'
  END                                       AS classification
FROM v2_program_staff ps
JOIN participant_programs pp
  ON pp.participant_id = ps.staff_id
 AND pp.program_id::text = ps.program_id::text
JOIN contacts c
  ON (c.cid = ps.staff_id OR LOWER(TRIM(c.email)) = LOWER(TRIM(ps.staff_id)))
LEFT JOIN v2_programs p ON p.id::text = ps.program_id::text
WHERE ps.role = 'facilitator'
ORDER BY classification, program_id, c.cid;

-- Expected business rule:
--   participant_programs + v2_program_staff(role='facilitator')
--   + same contact + same program  ==>  violation (no auto-fix)
--
-- Historical note: scripts/reconcile_participant_facilitator_conflicts.sql
-- (already in the repo) documents the manual remediation procedure — review
-- and apply only with explicit approval; nothing here deletes or updates.
