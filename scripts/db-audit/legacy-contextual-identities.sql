-- LEGACY CONTEXTUAL IDENTITIES — the population a data migration must cover.
--
-- Lot 8 asks to stop accepting `participant`, `facilitator`, `investor` and
-- `founder` as sign-in identities. Before that can happen, every person who
-- carries one must hold the equivalent PROFILE (or, for a participant, the
-- relationship the personal surface already reads), otherwise their surface
-- disappears at the next sign-in.
--
-- READ-ONLY. Every statement is a SELECT.

-- ── 1. The stored vocabulary as it is today ────────────────────────────────
SELECT role, status, COUNT(*) AS contacts
FROM contacts
GROUP BY role, status
ORDER BY contacts DESC, role, status;

-- ── 2. Each legacy value against its equivalent profile ────────────────────
-- `with_profile`      = already covered; nothing to migrate for that person.
-- `without_profile`   = would lose the context if the label stopped being read.
WITH legacy(role, profile_key) AS (
  VALUES
    ('participant', 'participant'),
    ('facilitator', 'facilitator'),
    ('investor', 'investor'),
    ('founder', 'founder')
)
SELECT
  l.role,
  COUNT(*) AS contacts,
  COUNT(*) FILTER (
    WHERE EXISTS (
      SELECT 1 FROM profile_assignments pa
      WHERE pa.contact_cid = c.cid
        AND pa.profile_key = l.profile_key
        AND pa.status = 'active'
        AND (pa.started_at IS NULL OR pa.started_at <= NOW())
        AND (pa.ends_at IS NULL OR pa.ends_at > NOW())
    )
  ) AS with_profile,
  COUNT(*) FILTER (
    WHERE NOT EXISTS (
      SELECT 1 FROM profile_assignments pa
      WHERE pa.contact_cid = c.cid
        AND pa.profile_key = l.profile_key
        AND pa.status = 'active'
        AND (pa.started_at IS NULL OR pa.started_at <= NOW())
        AND (pa.ends_at IS NULL OR pa.ends_at > NOW())
    )
  ) AS without_profile
FROM contacts c
JOIN legacy l ON l.role = c.role
GROUP BY l.role
ORDER BY l.role;

-- ── 3. Live sessions that would outlive the vocabulary change ──────────────
-- A session snapshot keeps its role until it expires; these must be drained or
-- re-issued after the migration.
SELECT role, COUNT(*) AS live_sessions
FROM user_sessions
WHERE expires_at > NOW()
  AND role IN ('participant', 'facilitator', 'investor', 'founder')
GROUP BY role
ORDER BY live_sessions DESC;

-- ── 4. Participants with no programme relationship ─────────────────────────
-- `participant` is already the DEFAULT_ROLE, so dropping it from the accepted
-- values changes nothing for this group — but the count proves the claim.
SELECT
  COUNT(*) AS participant_rows,
  COUNT(*) FILTER (
    WHERE EXISTS (
      SELECT 1 FROM participant_programs pp
      WHERE pp.participant_id = c.cid
        AND pp.status = 'active'
    )
  ) AS with_active_program,
  COUNT(*) FILTER (
    WHERE c.program_id IS NOT NULL AND TRIM(CAST(c.program_id AS TEXT)) <> ''
  ) AS with_direct_program
FROM contacts c
WHERE c.role = 'participant';
