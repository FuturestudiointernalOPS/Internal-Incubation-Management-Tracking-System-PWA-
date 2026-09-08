-- =============================================================================
-- PHASE 1B — 02_REPORT_B_PARTICIPANT_PARITY
-- -----------------------------------------------------------------------------
-- Part 1: READ-ONLY audit. Part 2: INSERT-only, idempotent reconciliation of
-- UNAMBIGUOUS missing participant_programs rows.
--
-- RUN 00_environment_check.sql FIRST and confirm the environment.
-- Review the output of Part 1 BEFORE executing Part 2.
-- No UPDATE/DELETE anywhere in this script.
-- =============================================================================

-- ── PART 1: AUDIT ────────────────────────────────────────────────────────────

-- B1. participant_programs vs contact operational state
--     CORRECT: contact active + membership exists
--     SUSPICIOUS: membership exists but contact inactive/deleted/archived
SELECT 'total_pp_rows' AS bucket, COUNT(*)::bigint AS n FROM participant_programs
UNION ALL SELECT 'pp_with_active_contact', COUNT(*)::bigint
  FROM participant_programs pp JOIN contacts c ON c.cid = pp.participant_id
  WHERE c.status IN ('active','approved') AND c.deleted = 0 AND c.deleted_at IS NULL AND c.archived_at IS NULL
UNION ALL SELECT 'pp_with_inactive_contact', COUNT(*)::bigint
  FROM participant_programs pp JOIN contacts c ON c.cid = pp.participant_id
  WHERE c.status NOT IN ('active','approved') OR c.deleted = 1 OR c.deleted_at IS NOT NULL OR c.archived_at IS NOT NULL
UNION ALL SELECT 'pp_with_unknown_contact', COUNT(*)::bigint
  FROM participant_programs pp LEFT JOIN contacts c ON c.cid = pp.participant_id
  WHERE c.cid IS NULL;

-- B1b. The SUSPICIOUS rows (report only)
SELECT c.cid, c.name, c.email, c.status, c.deleted, c.archived_at,
       pp.program_id, pp.status AS pp_status, pp.created_at AS pp_created
FROM participant_programs pp
JOIN contacts c ON c.cid = pp.participant_id
WHERE c.status NOT IN ('active','approved') OR c.deleted = 1 OR c.deleted_at IS NOT NULL OR c.archived_at IS NOT NULL
ORDER BY c.cid;

-- B2. LEGACY-ONLY memberships: clearly enrolled through a legacy source but
--     missing from participant_programs (these feed Part 2)
--     2a. v2_participants with an operational status + a known contact
SELECT 'v2_participants_operational_without_pp' AS bucket, COUNT(*)::bigint AS n
FROM v2_participants vp
JOIN contacts c ON (c.cid = vp.user_id OR LOWER(TRIM(c.email)) = LOWER(TRIM(vp.email)))
LEFT JOIN participant_programs pp ON pp.participant_id = c.cid AND pp.program_id::text = vp.program_id::text
WHERE LOWER(COALESCE(vp.status,'')) IN ('active','approved')
  AND c.deleted = 0
  AND pp.id IS NULL;

--     2b. contacts.program_id direct pointer without a row
SELECT 'contacts_program_id_without_pp' AS bucket, COUNT(*)::bigint AS n
FROM contacts c
LEFT JOIN participant_programs pp ON pp.participant_id = c.cid AND pp.program_id::text = c.program_id::text
WHERE c.program_id IS NOT NULL AND TRIM(c.program_id) <> ''
  AND c.status IN ('active','approved') AND c.deleted = 0
  AND pp.id IS NULL;

--     2c. families name-match without a row
SELECT 'families_name_match_without_pp' AS bucket, COUNT(*)::bigint AS n
FROM contacts c
JOIN families f ON UPPER(TRIM(f.name)) = UPPER(TRIM(c.group_name)) AND f.program_id IS NOT NULL
LEFT JOIN participant_programs pp ON pp.participant_id = c.cid AND pp.program_id::text = f.program_id::text
WHERE c.status IN ('active','approved') AND c.deleted = 0
  AND pp.id IS NULL;

-- ── PART 2: INSERT-ONLY RECONCILIATION (MANUAL REVIEW, THEN RUN) ─────────────
-- Each statement is idempotent (ON CONFLICT DO NOTHING) and inserts the
-- MINIMAL columns; status stays NULL, which the system treats as active.
-- Run one statement at a time and verify counts.

-- 2a. From v2_participants with operational status + known contact
INSERT INTO participant_programs (participant_id, program_id)
SELECT c.cid, vp.program_id
FROM v2_participants vp
JOIN contacts c ON (c.cid = vp.user_id OR LOWER(TRIM(c.email)) = LOWER(TRIM(vp.email)))
LEFT JOIN participant_programs pp ON pp.participant_id = c.cid AND pp.program_id::text = vp.program_id::text
WHERE LOWER(COALESCE(vp.status,'')) IN ('active','approved')
  AND c.deleted = 0
  AND pp.id IS NULL
ON CONFLICT (participant_id, program_id) DO NOTHING;

-- 2b. From contacts.program_id direct pointer
INSERT INTO participant_programs (participant_id, program_id)
SELECT c.cid, c.program_id
FROM contacts c
LEFT JOIN participant_programs pp ON pp.participant_id = c.cid AND pp.program_id::text = c.program_id::text
WHERE c.program_id IS NOT NULL AND TRIM(c.program_id) <> ''
  AND c.status IN ('active','approved') AND c.deleted = 0
  AND pp.id IS NULL
ON CONFLICT (participant_id, program_id) DO NOTHING;

-- 2c. From families name-match (legacy fallback used by participant-membership.js)
INSERT INTO participant_programs (participant_id, program_id)
SELECT c.cid, f.program_id
FROM contacts c
JOIN families f ON UPPER(TRIM(f.name)) = UPPER(TRIM(c.group_name)) AND f.program_id IS NOT NULL
LEFT JOIN participant_programs pp ON pp.participant_id = c.cid AND pp.program_id::text = f.program_id::text
WHERE c.status IN ('active','approved') AND c.deleted = 0
  AND pp.id IS NULL
ON CONFLICT (participant_id, program_id) DO NOTHING;

-- NOTE: form respondents (platform_form_submissions) are deliberately NOT a
-- reconciliation source — a form submission does not equal program membership.
