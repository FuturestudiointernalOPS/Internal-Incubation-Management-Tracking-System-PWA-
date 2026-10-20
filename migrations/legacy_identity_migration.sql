-- LEGACY IDENTITIES — give the function BEFORE taking the label away.
--
-- The four legacy labels cannot hold their own profile: the profile ↔ role gate
-- allows `participant` / `founder` only for the MEMBER identity and
-- `facilitator` for STAFF or MEMBER. So the automatic reconcile refuses to create
-- the card while the account still carries the legacy label, and the person's
-- base rights come from the ROLE DEFAULT profile instead.
--
-- This migration does both halves in ONE transaction:
--   1. create the contextual profile card for every real relationship;
--   2. normalize the identity to `member` (three baseline identities).
-- Run the other way round, rights disappear between the two writes.
--
-- Every statement is idempotent: a card already present is not duplicated, and
-- the role update only touches the three legacy values.

-- ── Targets: who is concerned, and which profile they must end up holding ────
CREATE TEMP TABLE legacy_migration_targets ON COMMIT DROP AS
SELECT
  c.cid,
  c.role AS source_role,
  CASE c.role
    WHEN 'participant' THEN 'participant'
    WHEN 'facilitator' THEN 'facilitator'
    WHEN 'founder'     THEN 'founder'
  END AS profile_key
FROM contacts c
WHERE c.role IN ('participant', 'facilitator', 'founder');

-- The plan, for the run's output.
SELECT source_role, profile_key, COUNT(*) AS people
FROM legacy_migration_targets
GROUP BY source_role, profile_key
ORDER BY source_role;

-- ── Participants: one card per enrolment ────────────────────────────────────
-- The reconcile reads every `participant_programs` row (it does not filter on
-- status), so this insert uses the same rule to avoid a card the next reconcile
-- would immediately remove.
INSERT INTO profile_assignments
  (contact_cid, profile_key, context_type, context_id, started_at, ends_at,
   status, source, source_ref, notes, created_by)
SELECT DISTINCT
  c.cid,
  'participant',
  'program',
  CAST(pp.program_id AS TEXT),
  NOW(),
  NULL,
  'active',
  'automatic',
  CAST(pp.program_id AS TEXT),
  'legacy-identity-migration',
  NULL
FROM contacts c
JOIN participant_programs pp ON pp.participant_id = c.cid
WHERE c.role = 'participant'
  AND pp.program_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM profile_assignments pa
    WHERE pa.contact_cid = c.cid
      AND pa.profile_key = 'participant'
      AND pa.context_type = 'program'
      AND pa.context_id = CAST(pp.program_id AS TEXT)
      AND pa.status = 'active'
  );

-- ── Facilitators: one card per active program assignment ────────────────────
-- Same relationship source as the reconcile (`v2_program_staff`, email-tolerant),
-- and the card expires with the program: all cards of one person carry the latest
-- program end date, exactly as the reconcile dates them.
WITH facilitator_assignments AS (
  SELECT
    c.cid,
    CAST(ps.program_id AS TEXT) AS program_id,
    MAX(p.end_date) OVER (PARTITION BY c.cid) AS ends_at
  FROM contacts c
  JOIN v2_program_staff ps
    ON (ps.staff_id = c.cid OR LOWER(TRIM(ps.staff_id)) = LOWER(c.email))
  JOIN v2_programs p ON CAST(p.id AS TEXT) = CAST(ps.program_id AS TEXT)
  WHERE c.role = 'facilitator'
    AND LOWER(COALESCE(ps.role, '')) = 'facilitator'
    AND (p.end_date IS NULL OR p.end_date >= CURRENT_DATE)
)
INSERT INTO profile_assignments
  (contact_cid, profile_key, context_type, context_id, started_at, ends_at,
   status, source, source_ref, notes, created_by)
SELECT DISTINCT
  fa.cid,
  'facilitator',
  'program',
  fa.program_id,
  NOW(),
  fa.ends_at,
  'active',
  'automatic',
  fa.program_id,
  'legacy-identity-migration',
  NULL
FROM facilitator_assignments fa
WHERE fa.program_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM profile_assignments pa
    WHERE pa.contact_cid = fa.cid
      AND pa.profile_key = 'facilitator'
      AND pa.context_type = 'program'
      AND pa.context_id = fa.program_id
      AND pa.status = 'active'
  );

-- ── Founders: one card per venture they founded ─────────────────────────────
INSERT INTO profile_assignments
  (contact_cid, profile_key, context_type, context_id, started_at, ends_at,
   status, source, source_ref, notes, created_by)
SELECT DISTINCT
  c.cid,
  'founder',
  'venture',
  CAST(vm.venture_id AS TEXT),
  NOW(),
  NULL,
  'active',
  'automatic',
  CAST(vm.venture_id AS TEXT),
  'legacy-identity-migration',
  NULL
FROM contacts c
JOIN venture_members vm
  ON (vm.contact_id = c.cid OR vm.user_cid = c.cid)
WHERE c.role = 'founder'
  AND vm.removed_at IS NULL
  AND (vm.member_type = 'founder' OR vm.role IN ('founder', 'co-founder'))
  AND NOT EXISTS (
    SELECT 1 FROM profile_assignments pa
    WHERE pa.contact_cid = c.cid
      AND pa.profile_key = 'founder'
      AND pa.context_type = 'venture'
      AND pa.context_id = CAST(vm.venture_id AS TEXT)
      AND pa.status = 'active'
  );

-- ── The identity change ─────────────────────────────────────────────────────
-- After this line the role default no longer matters: an active profile card is
-- preferred over it by the resolver.
UPDATE contacts
SET role = 'member'
WHERE role IN ('participant', 'facilitator', 'founder');

-- ── Post-conditions — the transaction is rolled back if any is false ────────

-- No legacy label survives.
SELECT
  'legacy_roles_remaining' AS check_name,
  COUNT(*) AS failing,
  (COUNT(*) = 0) AS ok
FROM contacts
WHERE role IN ('participant', 'facilitator', 'founder');

-- Every target now holds an ACTIVE card for its function.
SELECT
  'targets_without_active_card' AS check_name,
  COUNT(*) AS failing,
  (COUNT(*) = 0) AS ok
FROM legacy_migration_targets t
WHERE NOT EXISTS (
  SELECT 1 FROM profile_assignments pa
  WHERE pa.contact_cid = t.cid
    AND pa.profile_key = t.profile_key
    AND pa.status = 'active'
    AND (pa.started_at IS NULL OR pa.started_at <= NOW())
    AND (pa.ends_at IS NULL OR pa.ends_at > NOW())
);

-- Sessions still carrying a legacy role (reported, not modified here).
SELECT
  'live_legacy_sessions' AS check_name,
  COUNT(*) AS failing,
  TRUE AS ok
FROM user_sessions
WHERE expires_at > NOW()
  AND role IN ('participant', 'facilitator', 'founder');
