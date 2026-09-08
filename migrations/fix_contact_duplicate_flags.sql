-- ═══════════════════════════════════════════════════════════════════════════
-- contact_duplicate_flags — two fixes
--
-- 1. Order-insensitive uniqueness
--    The old UNIQUE(contact_cid_a, contact_cid_b) treated the pair (a,b)
--    and the pair (b,a) as DIFFERENT pairs, so the same two contacts could
--    be flagged twice (once in each order). It is replaced by a unique
--    index on the *unordered* pair: LEAST(a,b), GREATEST(a,b).
--
-- 2. Zombie flags on soft delete
--    Pending flags whose contact was soft-deleted (deleted = 1) stayed
--    'pending' forever. Section 1 dismisses the ones that already exist;
--    the trigger in section 4 dismisses them automatically from now on.
--
-- HOW TO RUN
--   * Run the two PRE-FLIGHT queries first (read-only, show what will change).
--   * Then run the whole script (one transaction). Everything except the
--     pre-flight queries is idempotent, so a re-run is harmless.
--
-- ═══════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────────
-- 0. PRE-FLIGHT (read-only — run these BEFORE the script)
-- ────────────────────────────────────────────────────────────────────────────

-- 0a. Zombie flags that will be dismissed (pending flag, contact soft-deleted)
SELECT df.id, df.contact_cid_a, df.contact_cid_b, df.match_reason, df.confidence,
       df.status, df.created_at,
       ca.name AS contact_a_name, cb.name AS contact_b_name
FROM contact_duplicate_flags df
LEFT JOIN contacts ca ON ca.cid = df.contact_cid_a
LEFT JOIN contacts cb ON cb.cid = df.contact_cid_b
WHERE df.status = 'pending'
  AND (ca.deleted = 1 OR cb.deleted = 1);

-- 0b. Reversed duplicate pairs that will be collapsed (only the keeper row
--     survives per unordered pair; the rest are deleted)
SELECT df.id, df.contact_cid_a, df.contact_cid_b, df.status, df.created_at
FROM contact_duplicate_flags df
JOIN contact_duplicate_flags dup
  ON dup.id <> df.id
 AND LEAST(dup.contact_cid_a, dup.contact_cid_b) = LEAST(df.contact_cid_a, df.contact_cid_b)
 AND GREATEST(dup.contact_cid_a, dup.contact_cid_b) = GREATEST(df.contact_cid_a, df.contact_cid_b)
ORDER BY LEAST(df.contact_cid_a, df.contact_cid_b), df.created_at DESC;

-- ────────────────────────────────────────────────────────────────────────────
-- SCRIPT START
-- ────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. One-time cleanup: dismiss pending flags whose contact is soft-deleted.
--    (Future soft-deletes are handled by the trigger in section 4.)
--    reviewed_by holds a sentinel, not a contact cid — the flag was resolved
--    by the system, not by a human reviewer.
-- ────────────────────────────────────────────────────────────────────────────
UPDATE contact_duplicate_flags df
   SET status = 'dismissed',
       reviewed_at = NOW(),
       reviewed_by = 'system:contact_deleted'
  FROM contacts c
 WHERE df.status = 'pending'
   AND (df.contact_cid_a = c.cid OR df.contact_cid_b = c.cid)
   AND c.deleted = 1;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Collapse reversed duplicates: keep ONE row per unordered pair.
--    Keep-priority: merged > dismissed > pending — a human decision beats an
--    automatic signal. Newest created_at wins ties. Redundant rows are
--    deleted: a flag row is only a "maybe duplicate" signal, and a merge is
--    permanently recorded in contact_timeline by the app.
-- ────────────────────────────────────────────────────────────────────────────
WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY LEAST(contact_cid_a, contact_cid_b),
                            GREATEST(contact_cid_a, contact_cid_b)
               ORDER BY CASE status WHEN 'merged' THEN 3
                                    WHEN 'dismissed' THEN 2
                                    ELSE 1 END DESC,
                        created_at DESC,
                        id DESC
           ) AS rn
    FROM contact_duplicate_flags
)
DELETE FROM contact_duplicate_flags df
USING ranked r
WHERE df.id = r.id AND r.rn > 1;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Replace the order-sensitive uniqueness with an order-insensitive one.
--    If the constraint below was renamed at some point, find its real name
--    first:  SELECT conname FROM pg_constraint
--            WHERE conrelid = 'contact_duplicate_flags'::regclass AND contype = 'u';
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE contact_duplicate_flags
    DROP CONSTRAINT IF EXISTS contact_duplicate_flags_contact_cid_a_contact_cid_b_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_duplicate_flags_pair
    ON contact_duplicate_flags (
        LEAST(contact_cid_a, contact_cid_b),
        GREATEST(contact_cid_a, contact_cid_b)
    );

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Future-proofing: auto-dismiss pending flags when a contact is
--    soft-deleted by ANY code path (contact DELETE, merge, future flows).
--    Note: the merge flow soft-deletes the duplicate contact first (this
--    trigger fires) and then explicitly marks that pair 'merged', so merged
--    flags keep their real reviewer — the trigger only touches 'pending'.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION dismiss_pending_flags_for_deleted_contact()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE contact_duplicate_flags
       SET status = 'dismissed',
           reviewed_at = NOW(),
           reviewed_by = 'system:contact_deleted'
     WHERE status = 'pending'
       AND (contact_cid_a = NEW.cid OR contact_cid_b = NEW.cid);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_contact_duplicate_flags_on_contact_delete ON contacts;
CREATE TRIGGER trg_contact_duplicate_flags_on_contact_delete
    AFTER UPDATE OF deleted ON contacts
    FOR EACH ROW
    WHEN (NEW.deleted = 1 AND NEW.deleted IS DISTINCT FROM OLD.deleted)
    EXECUTE FUNCTION dismiss_pending_flags_for_deleted_contact();

COMMIT;
