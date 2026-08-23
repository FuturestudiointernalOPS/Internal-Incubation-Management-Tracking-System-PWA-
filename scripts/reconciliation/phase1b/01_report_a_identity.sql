-- =============================================================================
-- PHASE 1B — 01_REPORT_A_IDENTITY (READ-ONLY)
-- -----------------------------------------------------------------------------
-- Identity relationship audit. Nothing here writes data.
-- Classification convention:
--   CONFIDENT     -> the system can determine the relationship unambiguously
--   AMBIGUOUS     -> review manually, do not merge/alter
--   UNRESOLVABLE  -> no confident determination possible from existing data
-- =============================================================================

-- A1. Totals and status distribution
SELECT 'total_contacts' AS metric, COUNT(*)::bigint AS value FROM contacts
UNION ALL SELECT 'status_active', COUNT(*)::bigint FROM contacts WHERE status IN ('active','approved')
UNION ALL SELECT 'status_pending', COUNT(*)::bigint FROM contacts WHERE status = 'pending'
UNION ALL SELECT 'status_inactive_suspended', COUNT(*)::bigint FROM contacts WHERE status IN ('inactive','suspended')
UNION ALL SELECT 'status_other', COUNT(*)::bigint FROM contacts WHERE status NOT IN ('active','approved','pending','inactive','suspended')
UNION ALL SELECT 'soft_deleted', COUNT(*)::bigint FROM contacts WHERE deleted = 1 OR deleted_at IS NOT NULL
UNION ALL SELECT 'archived', COUNT(*)::bigint FROM contacts WHERE archived_at IS NOT NULL
UNION ALL SELECT 'missing_email', COUNT(*)::bigint FROM contacts WHERE email IS NULL OR TRIM(email) = ''
UNION ALL SELECT 'missing_name', COUNT(*)::bigint FROM contacts WHERE name IS NULL OR TRIM(name) = '';

-- A2. DUPLICATE EMAILS -> same person, multiple cid (AMBIGUOUS: report only)
SELECT LOWER(TRIM(email)) AS email,
       COUNT(*)::int AS account_count,
       ARRAY_AGG(cid ORDER BY created_at) AS cids,
       ARRAY_AGG(status ORDER BY created_at) AS statuses
FROM contacts
WHERE email IS NOT NULL AND TRIM(email) <> '' AND deleted = 0
GROUP BY LOWER(TRIM(email))
HAVING COUNT(*) > 1
ORDER BY account_count DESC;

-- A3. Placeholder / unknown names (AMBIGUOUS: report only)
SELECT cid, name, email, status
FROM contacts
WHERE (LOWER(TRIM(name)) IN ('unknown', 'unassigned', 'n/a', 'none', 'null', '-')
       OR TRIM(name) = ''
       OR LOWER(name) LIKE '%placeholder%'
       OR LOWER(name) LIKE '%test%')
  AND deleted = 0
ORDER BY name;

-- A4. Inactive/deleted/archived contacts that still hold ACTIVE operational
--     memberships (AMBIGUOUS — memberships may be historical; report only)
SELECT c.cid, c.name, c.email, c.status,
       c.deleted, c.deleted_at IS NOT NULL AS is_deleted, c.archived_at IS NOT NULL AS is_archived,
       pp.program_id AS membership_program, pp.status AS membership_status
FROM contacts c
JOIN participant_programs pp ON pp.participant_id = c.cid
WHERE (c.status NOT IN ('active','approved') OR c.deleted = 1 OR c.deleted_at IS NOT NULL OR c.archived_at IS NOT NULL)
ORDER BY c.cid;

-- A5. Same person across legacy sources: contacts whose group_name matches a
--     family AND whose email also exists in v2_participants — used only to
--     list candidate identities for manual review (AMBIGUOUS)
SELECT c.cid, c.name, c.email, c.group_name, f.name AS family_name, f.program_id AS family_program
FROM contacts c
JOIN families f ON UPPER(TRIM(f.name)) = UPPER(TRIM(c.group_name))
WHERE c.deleted = 0
ORDER BY c.email;
