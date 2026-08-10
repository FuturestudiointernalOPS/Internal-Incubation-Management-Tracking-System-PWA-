-- ============================================================================
-- MIGRATION: Fix Form Approval → Activation Flow Schema Issues
-- Run against staging Supabase first. Test, then apply to production.
-- ============================================================================

-- 1. Allow contacts without passwords (set during activation, not registration)
ALTER TABLE contacts ALTER COLUMN password DROP NOT NULL;
ALTER TABLE contacts ALTER COLUMN password SET DEFAULT '';

-- 2. Allow contacts without groups (assigned after approval)
ALTER TABLE contacts ALTER COLUMN group_name DROP NOT NULL;
ALTER TABLE contacts ALTER COLUMN group_name SET DEFAULT '';

-- 3. Add default_role to families (defines what role group members get)
ALTER TABLE families ADD COLUMN IF NOT EXISTS default_role TEXT;

-- 4. Fix contact_timeline FK to allow deferred constraint checking
--    (prevents FK violations when contact creation happens in same transaction)
ALTER TABLE contact_timeline DROP CONSTRAINT IF EXISTS contact_timeline_contact_cid_fkey;
ALTER TABLE contact_timeline ADD CONSTRAINT contact_timeline_contact_cid_fkey
  FOREIGN KEY (contact_cid) REFERENCES contacts(cid) DEFERRABLE INITIALLY DEFERRED;
