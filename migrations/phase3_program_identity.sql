-- Phase 3: Program-Identity Integration
-- Strengthen v2_participants.user_id link to contacts.cid
-- Safe: additive, backward-compatible

-- Add user_id index for faster lookups
CREATE INDEX IF NOT EXISTS idx_v2_participants_user_id ON v2_participants(user_id);

-- Add foreign key constraint (if not exists) — ensures referential integrity
-- Skip if constraint already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'v2_participants_user_id_fkey'
  ) THEN
    ALTER TABLE v2_participants
      ADD CONSTRAINT v2_participants_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES contacts(cid) ON DELETE SET NULL;
  END IF;
END $$;

-- Populate user_id for participants missing it (match by email)
UPDATE v2_participants vp
SET user_id = c.cid
FROM contacts c
WHERE vp.user_id IS NULL
  AND LOWER(vp.email) = LOWER(c.email)
  AND c.deleted_at IS NULL;
