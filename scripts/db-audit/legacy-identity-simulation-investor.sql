-- LEGACY IDENTITIES — INVESTOR FAMILY (READ-ONLY, OPTIONAL).
--
-- Run this ONLY when the main simulation reports
--   « investisseur · table investor_profiles présente » = 1.
-- On a database without that table, a query referencing it cannot even be
-- planned — which is why this block is separate instead of conditional.
--
-- The rules mirror the migration: an APPROVED investor profile is the active
-- relationship, and it gives one card per investor context.
--
-- Writes nothing. Safe to paste in any SQL console.

WITH
targets AS (
  SELECT c.cid
  FROM contacts c
  WHERE LOWER(c.role) = 'investor'
),

investor_rel AS (
  SELECT DISTINCT c.cid
  FROM contacts c
  JOIN investor_profiles ip
    ON ip.user_id = c.cid AND ip.approval_status = 'approved'
  WHERE LOWER(c.role) = 'investor'
),

investor_cards AS (
  SELECT DISTINCT c.cid
  FROM contacts c
  JOIN investor_profiles ip
    ON ip.user_id = c.cid AND ip.approval_status = 'approved'
  WHERE LOWER(c.role) = 'investor'
    AND NOT EXISTS (
      SELECT 1 FROM profile_assignments pa
      WHERE pa.contact_cid = c.cid
        AND pa.profile_key = 'investor'
        AND pa.context_type = 'investor'
        AND pa.context_id = CAST(ip.id AS TEXT)
        AND pa.status = 'active'
    )
)

SELECT * FROM (
  SELECT 'investisseur · personnes' AS indicateur, COUNT(*)::int AS valeur, '—' AS attendu
  FROM targets
  UNION ALL
  SELECT 'investisseur · relations actives', COUNT(*)::int, '—'
  FROM investor_rel
  UNION ALL
  SELECT 'investisseur · cartes à créer', COUNT(*)::int, '—'
  FROM investor_cards
  UNION ALL
  SELECT 'investisseur · relation active sans carte', COUNT(*)::int, '0'
  FROM targets t
  WHERE EXISTS (SELECT 1 FROM investor_rel x WHERE x.cid = t.cid)
    AND NOT EXISTS (SELECT 1 FROM investor_cards x WHERE x.cid = t.cid)
  UNION ALL
  SELECT 'investisseur · sans relation (membre sans carte)', COUNT(*)::int, 'signalé'
  FROM targets t
  WHERE NOT EXISTS (SELECT 1 FROM investor_rel x WHERE x.cid = t.cid)
) resultat
ORDER BY indicateur;
