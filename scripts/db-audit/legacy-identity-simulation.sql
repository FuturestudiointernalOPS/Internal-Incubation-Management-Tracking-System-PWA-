-- LEGACY IDENTITIES — READ-ONLY SIMULATION.
--
-- Answers, in ONE result set: how many people carry a legacy label, how many
-- have an ACTIVE relationship, how many cards the migration would create, and
-- how many people would end up without a card despite an active relationship.
--
-- The relationship rules are the ones the migration writes (programmes ended on
-- a past date do not count). If one side changes, change both.
--
-- OPTIONAL MODULES. The migration probes each family's table and skips a family
-- whose table is absent (measured: production has no `investor_profiles`). This
-- script therefore covers the three core families and REPORTS whether the
-- investor table exists; run `legacy-identity-simulation-investor.sql` only
-- when it does. A plain SQL query cannot reference a missing relation, which is
-- why the investor block is a separate file rather than a conditional here.
--
-- Writes nothing. Safe to paste in any SQL console.

WITH
targets AS (
  SELECT c.cid, LOWER(c.role) AS role
  FROM contacts c
  WHERE LOWER(c.role) IN ('participant', 'facilitator', 'investor', 'founder')
),

participant_rel AS (
  SELECT DISTINCT c.cid
  FROM contacts c
  JOIN participant_programs pp ON pp.participant_id = c.cid
  WHERE LOWER(c.role) = 'participant'
    AND pp.program_id IS NOT NULL
),

facilitator_rel AS (
  SELECT DISTINCT c.cid
  FROM contacts c
  JOIN v2_program_staff ps
    ON (ps.staff_id = c.cid OR LOWER(TRIM(ps.staff_id)) = LOWER(c.email))
  JOIN v2_programs p ON CAST(p.id AS TEXT) = CAST(ps.program_id AS TEXT)
  WHERE LOWER(c.role) = 'facilitator'
    AND LOWER(COALESCE(ps.role, '')) = 'facilitator'
    AND (p.end_date IS NULL OR NULLIF(TRIM(p.end_date::text), '')::timestamptz >= CURRENT_DATE)
),

founder_rel AS (
  SELECT DISTINCT c.cid
  FROM contacts c
  JOIN venture_members vm
    ON (vm.contact_id = c.cid OR vm.user_cid = c.cid)
  WHERE LOWER(c.role) = 'founder'
    AND vm.removed_at IS NULL
    AND (vm.member_type = 'founder' OR vm.role IN ('founder', 'co-founder'))
),

participant_cards AS (
  SELECT DISTINCT c.cid
  FROM contacts c
  JOIN participant_programs pp ON pp.participant_id = c.cid
  WHERE LOWER(c.role) = 'participant'
    AND pp.program_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM profile_assignments pa
      WHERE pa.contact_cid = c.cid
        AND pa.profile_key = 'participant'
        AND pa.context_type = 'program'
        AND pa.context_id = CAST(pp.program_id AS TEXT)
        AND pa.status = 'active'
    )
),

facilitator_cards AS (
  SELECT DISTINCT c.cid
  FROM contacts c
  JOIN v2_program_staff ps
    ON (ps.staff_id = c.cid OR LOWER(TRIM(ps.staff_id)) = LOWER(c.email))
  JOIN v2_programs p ON CAST(p.id AS TEXT) = CAST(ps.program_id AS TEXT)
  WHERE LOWER(c.role) = 'facilitator'
    AND LOWER(COALESCE(ps.role, '')) = 'facilitator'
    AND (p.end_date IS NULL OR NULLIF(TRIM(p.end_date::text), '')::timestamptz >= CURRENT_DATE)
    AND NOT EXISTS (
      SELECT 1 FROM profile_assignments pa
      WHERE pa.contact_cid = c.cid
        AND pa.profile_key = 'facilitator'
        AND pa.context_type = 'program'
        AND pa.context_id = CAST(ps.program_id AS TEXT)
        AND pa.status = 'active'
    )
),

founder_cards AS (
  SELECT DISTINCT c.cid
  FROM contacts c
  JOIN venture_members vm
    ON (vm.contact_id = c.cid OR vm.user_cid = c.cid)
  WHERE LOWER(c.role) = 'founder'
    AND vm.removed_at IS NULL
    AND (vm.member_type = 'founder' OR vm.role IN ('founder', 'co-founder'))
    AND NOT EXISTS (
      SELECT 1 FROM profile_assignments pa
      WHERE pa.contact_cid = c.cid
        AND pa.profile_key = 'founder'
        AND pa.context_type = 'venture'
        AND pa.context_id = CAST(vm.venture_id AS TEXT)
        AND pa.status = 'active'
    )
),

report AS (
  SELECT 'participant' AS famille, t.cid FROM targets t WHERE t.role = 'participant'
  UNION ALL
  SELECT 'facilitateur', t.cid FROM targets t WHERE t.role = 'facilitator'
  UNION ALL
  SELECT 'fondateur', t.cid FROM targets t WHERE t.role = 'founder'
)

SELECT * FROM (
  SELECT 'participant · personnes' AS indicateur, COUNT(*)::int AS valeur, '—' AS attendu
  FROM report WHERE famille = 'participant'
  UNION ALL
  SELECT 'participant · relations actives', COUNT(*)::int, '—'
  FROM participant_rel
  UNION ALL
  SELECT 'participant · cartes à créer', COUNT(*)::int, '—'
  FROM participant_cards
  UNION ALL
  SELECT 'participant · relation active sans carte', COUNT(*)::int, '0'
  FROM report r
  WHERE r.famille = 'participant'
    AND EXISTS (SELECT 1 FROM participant_rel x WHERE x.cid = r.cid)
    AND NOT EXISTS (SELECT 1 FROM participant_cards x WHERE x.cid = r.cid)
  UNION ALL
  SELECT 'participant · sans relation (membre sans carte)', COUNT(*)::int, 'signalé'
  FROM report r
  WHERE r.famille = 'participant'
    AND NOT EXISTS (SELECT 1 FROM participant_rel x WHERE x.cid = r.cid)

  UNION ALL
  SELECT 'facilitateur · personnes', COUNT(*)::int, '—'
  FROM report WHERE famille = 'facilitateur'
  UNION ALL
  SELECT 'facilitateur · relations actives', COUNT(*)::int, '—'
  FROM facilitator_rel
  UNION ALL
  SELECT 'facilitateur · cartes à créer', COUNT(*)::int, '—'
  FROM facilitator_cards
  UNION ALL
  SELECT 'facilitateur · relation active sans carte', COUNT(*)::int, '0'
  FROM report r
  WHERE r.famille = 'facilitateur'
    AND EXISTS (SELECT 1 FROM facilitator_rel x WHERE x.cid = r.cid)
    AND NOT EXISTS (SELECT 1 FROM facilitator_cards x WHERE x.cid = r.cid)
  UNION ALL
  SELECT 'facilitateur · sans relation (membre sans carte)', COUNT(*)::int, 'signalé'
  FROM report r
  WHERE r.famille = 'facilitateur'
    AND NOT EXISTS (SELECT 1 FROM facilitator_rel x WHERE x.cid = r.cid)

  UNION ALL
  SELECT 'fondateur · personnes', COUNT(*)::int, '—'
  FROM report WHERE famille = 'fondateur'
  UNION ALL
  SELECT 'fondateur · relations actives', COUNT(*)::int, '—'
  FROM founder_rel
  UNION ALL
  SELECT 'fondateur · cartes à créer', COUNT(*)::int, '—'
  FROM founder_cards
  UNION ALL
  SELECT 'fondateur · relation active sans carte', COUNT(*)::int, '0'
  FROM report r
  WHERE r.famille = 'fondateur'
    AND EXISTS (SELECT 1 FROM founder_rel x WHERE x.cid = r.cid)
    AND NOT EXISTS (SELECT 1 FROM founder_cards x WHERE x.cid = r.cid)
  UNION ALL
  SELECT 'fondateur · sans relation (membre sans carte)', COUNT(*)::int, 'signalé'
  FROM report r
  WHERE r.famille = 'fondateur'
    AND NOT EXISTS (SELECT 1 FROM founder_rel x WHERE x.cid = r.cid)

  UNION ALL
  -- The investor family is skipped when this table is absent. 0 = absent.
  SELECT 'investisseur · table investor_profiles présente', COUNT(*)::int, '0 ou 1'
  FROM (SELECT to_regclass('public.investor_profiles') AS name) t
  WHERE t.name IS NOT NULL

  UNION ALL
  SELECT 'sessions ouvertes sous un ancien nom', COUNT(*)::int, 'signalé'
  FROM user_sessions
  WHERE expires_at > NOW()
    AND LOWER(role) IN ('participant', 'facilitator', 'investor', 'founder')
) resultat
ORDER BY indicateur;
