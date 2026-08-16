-- =============================================================================
-- MANUAL DATA RECONCILIATION — Participant/Facilitator conflicts
-- =============================================================================
-- Safe, idempotent, read-then-delete. Does NOT touch production automatically.
-- Run these manually against the target database, in order.
--
-- Purpose:
--   A person should never be BOTH a participant AND a facilitator in the SAME
--   program. Where a conflict exists, we keep the FACILITATOR relationship and
--   remove the PARTICIPANT membership (participant_programs) — history in
--   submissions/timeline/deliverables is left fully intact.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- STEP 1 — INSPECT conflicts (read-only)
-- Lists every person who is simultaneously a facilitator (v2_program_staff) and
-- a participant (participant_programs) in the same program.
-- -----------------------------------------------------------------------------
SELECT
  ps.program_id,
  ps.staff_id,
  c.name,
  c.email,
  pp.participant_id,
  pp.status AS participant_status
FROM v2_program_staff ps
JOIN contacts c
  ON (ps.staff_id = c.cid OR LOWER(TRIM(ps.staff_id)) = LOWER(TRIM(c.email)))
JOIN participant_programs pp
  ON pp.participant_id = c.cid
 AND CAST(pp.program_id AS TEXT) = CAST(ps.program_id AS TEXT)
WHERE ps.role = 'facilitator';

-- -----------------------------------------------------------------------------
-- STEP 2 — RESOLVE conflicts (delete participant membership, keep facilitator)
-- Idempotent: re-running deletes nothing more.
-- -----------------------------------------------------------------------------
DELETE FROM participant_programs pp
USING v2_program_staff ps, contacts c
WHERE ps.role = 'facilitator'
  AND CAST(pp.program_id AS TEXT) = CAST(ps.program_id AS TEXT)
  AND c.cid = pp.participant_id
  AND (ps.staff_id = c.cid OR LOWER(TRIM(ps.staff_id)) = LOWER(TRIM(c.email)));

-- -----------------------------------------------------------------------------
-- STEP 3 — VERIFY (read-only, should return 0 rows after Step 2)
-- -----------------------------------------------------------------------------
SELECT COUNT(*) AS remaining_conflicts
FROM v2_program_staff ps
JOIN contacts c
  ON (ps.staff_id = c.cid OR LOWER(TRIM(ps.staff_id)) = LOWER(TRIM(c.email)))
JOIN participant_programs pp
  ON pp.participant_id = c.cid
 AND CAST(pp.program_id AS TEXT) = CAST(ps.program_id AS TEXT)
WHERE ps.role = 'facilitator';
