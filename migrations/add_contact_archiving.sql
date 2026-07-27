-- =============================================================================
-- Contact Archiving & Soft Delete
-- Adds archived_at, archived_by, deleted_at, deleted_by columns to contacts table
-- =============================================================================

-- Archive columns (lightweight removal — restorable)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS archived_by TEXT;

-- Soft-delete columns (permanent removal — not shown, not restorable via UI)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS deleted_by TEXT;

-- Index for efficient archive/deleted queries
CREATE INDEX IF NOT EXISTS idx_contacts_archived_at ON contacts(archived_at) WHERE archived_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_deleted_at ON contacts(deleted_at) WHERE deleted_at IS NOT NULL;
