-- LEGACY IDENTITIES — give the function BEFORE taking the label away.
--
-- The four legacy labels cannot hold their own profile: the profile ↔ role gate
-- allows `participant` / `founder` only for the MEMBER identity and
-- `facilitator` for STAFF or MEMBER. So the automatic reconcile refuses to create
-- the card while the account still carries the legacy label, and the person's
-- base rights come from the ROLE DEFAULT profile instead.
--
-- This migration does both halves in ONE transaction:
--   1. create the contextual profile card for every ACTIVE relationship;
--   2. normalize the identity to `member` (three baseline identities).
-- Run the other way round, rights disappear between the two writes.
--
-- A legacy label with NO active relationship (a programme that ended, a venture
-- that was left) receives no card: there is no function to carry, and the
-- person holds no base rights from that label today. They simply become member,
-- and a future relationship will grant the profile again.
--
-- Every statement is idempotent: a card already present is not duplicated, and
-- the role update only touches the three legacy values.

-- ── Active relationships, one family at a time ──────────────────────────────
-- These CTEs are the SAME rules the automatic reconcile uses, so a later pass
-- neither duplicates nor removes what this migration writes.
CREATE TEMP TABLE legacy_migration_relationships AS
WITH participant_rel AS (
  SELECT DISTINCT c.cid
  FROM contacts c
  JOIN participant_programs pp ON pp.participant_id = c.cid
  WHERE c.role = 'participant'
    AND pp.program_id IS NOT NULL
),
facilitator_rel AS (
  SELECT DISTINCT c.cid
  FROM contacts c
  JOIN v2_program_staff ps
    ON (ps.staff_id = c.cid OR LOWER(TRIM(ps.staff_id)) = LOWER(c.email))
  JOIN v2_programs p ON CAST(p.id AS TEXT) = CAST(ps.program_id AS TEXT)
  WHERE c.role = 'facilitator'
    AND LOWER(COALESCE(ps.role, '')) = 'facilitator'
    AND (p.end_date IS NULL OR p.end_date >= CURRENT_DATE)
),
founder_rel AS (
  SELECT DISTINCT c.cid
  FROM contacts c
  JOIN venture_members vm
    ON (vm.contact_id = c.cid OR vm.user_cid = c.cid)
  WHERE c.role = 'founder'
    AND vm.removed_at IS NULL
    AND (vm.member_type = 'founder' OR vm.role IN ('founder', 'co-founder'))
)
SELECT
  c.cid,
  c.role AS source_role,
  CASE c.role
    WHEN 'participant' THEN 'participant'
    WHEN 'facilitator' THEN 'facilitator'
    WHEN 'founder'     THEN 'founder'
  END AS profile_key,
  CASE c.role
    WHEN 'participant' THEN EXISTS (SELECT 1 FROM participant_rel r WHERE r.cid = c.cid)
    WHEN 'facilitator' THEN EXISTS (SELECT 1 FROM facilitator_rel r WHERE r.cid = c.cid)
    WHEN 'founder'     THEN EXISTS (SELECT 1 FROM founder_rel r WHERE r.cid = c.cid)
    ELSE FALSE
  END AS has_relationship
FROM contacts c
WHERE c.role IN ('participant', 'facilitator', 'founder');

-- The plan, for the run's output.
SELECT
  source_role,
  has_relationship,
  COUNT(*) AS people
FROM legacy_migration_relationships
GROUP BY source_role, has_relationship
ORDER BY source_role, has_relationship DESC;

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

-- ── Facilitators: one card per ACTIVE program assignment ────────────────────
-- Same relationship source as the reconcile (`v2_program_staff`, email-tolerant),
-- ended programmes excluded, and the card expires with the programme: all cards
-- of one person carry the latest programme end date, as the reconcile dates them.
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

-- ── Post-conditions — any failure aborts the transaction ──────────────────
-- A target WITH an active relationship must hold its card. A target with NO
-- relationship is allowed to have none: there is no function to carry, and the
-- legacy label gave it no base rights.
DO $$
DECLARE
  bad_role int;
  bad_card int;
  no_card int;
  total int;
BEGIN
  SELECT COUNT(*) INTO bad_role
  FROM contacts
  WHERE role IN ('participant', 'facilitator', 'founder');
  IF bad_role > 0 THEN
    RAISE EXCEPTION 'Migration annulée : % ancien(s) rôle(s) subsiste(nt)', bad_role;
  END IF;

  SELECT COUNT(*) INTO bad_card
  FROM legacy_migration_relationships t
  WHERE t.has_relationship
    AND NOT EXISTS (
      SELECT 1 FROM profile_assignments pa
      WHERE pa.contact_cid = t.cid
        AND pa.profile_key = t.profile_key
        AND pa.status = 'active'
        AND (pa.started_at IS NULL OR pa.started_at <= NOW())
        AND (pa.ends_at IS NULL OR pa.ends_at > NOW())
    );
  IF bad_card > 0 THEN
    RAISE EXCEPTION 'Migration annulée : % relation(s) active(s) sans carte', bad_card;
  END IF;

  SELECT COUNT(*) INTO no_card
  FROM legacy_migration_relationships t
  WHERE NOT t.has_relationship;

  SELECT COUNT(*) INTO total FROM legacy_migration_relationships;

  RAISE NOTICE 'Migration prête : % personne(s), dont % sans relation (membre sans carte).', total, no_card;
END $$;
