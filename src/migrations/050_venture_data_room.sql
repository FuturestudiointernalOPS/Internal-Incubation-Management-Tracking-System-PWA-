-- =============================================================================
-- VENTURE DATA ROOM — additive schema
-- =============================================================================
--
-- The Data Room reuses the tables the product already has:
--
--   venture_documents            the catalogue row (the LIVE pointer to a file)
--   venture_document_versions    the history (one row per upload)
--   ventures / venture_members   ownership and membership
--   venture_staff_assignments    delegated staff scope
--   investor_profiles            who counts as an investor
--   venture_activity_log         the audit trail
--
-- What is NEW is only what those tables could not express:
--
--   * review metadata on a document (uploading ≠ verifying);
--   * an expiry date and a soft-delete marker;
--   * per-investor grants, at document or category level;
--   * per-venture requirement levels (stage-based, editable by staff).
--
-- Every statement is idempotent. The application also applies these on the
-- first Data Room read (`ensureDataRoomSchema`), so a database that does not
-- run this file still works; running it is the explicit, reviewable path.
--
-- No existing column is dropped or rewritten.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS venture_data_room_grants (
    id SERIAL PRIMARY KEY,
    venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
    -- NULL document_id = a grant covering the whole category.
    document_id UUID REFERENCES venture_documents(id) ON DELETE CASCADE,
    category TEXT,
    grantee_cid TEXT NOT NULL,
    access_level TEXT NOT NULL DEFAULT 'view',
    granted_by TEXT,
    expires_at TIMESTAMP,
    revoked_at TIMESTAMP,
    revoked_by TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_room_grants_venture
    ON venture_data_room_grants(venture_id, grantee_cid);

-- One LIVE grant per person per document / per category. Revoked rows are kept
-- for the audit trail, so the uniqueness is partial.
CREATE UNIQUE INDEX IF NOT EXISTS idx_data_room_grants_doc_user
    ON venture_data_room_grants(document_id, grantee_cid)
    WHERE document_id IS NOT NULL AND revoked_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_data_room_grants_category_user
    ON venture_data_room_grants(venture_id, category, grantee_cid)
    WHERE document_id IS NULL AND revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS venture_data_room_requirements (
    id SERIAL PRIMARY KEY,
    venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    level TEXT NOT NULL DEFAULT 'conditional',
    stage_bucket TEXT,
    note TEXT,
    customized BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(venture_id, category)
);

CREATE INDEX IF NOT EXISTS idx_data_room_requirements_venture
    ON venture_data_room_requirements(venture_id);

ALTER TABLE venture_data_room_requirements
    ADD COLUMN IF NOT EXISTS stage_bucket TEXT;

ALTER TABLE venture_documents
    ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'uploaded';
ALTER TABLE venture_documents ADD COLUMN IF NOT EXISTS reviewer_id TEXT;
ALTER TABLE venture_documents ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;
ALTER TABLE venture_documents ADD COLUMN IF NOT EXISTS review_notes TEXT;
ALTER TABLE venture_documents ADD COLUMN IF NOT EXISTS reviewed_version INTEGER;
ALTER TABLE venture_documents ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;
ALTER TABLE venture_documents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE venture_documents ADD COLUMN IF NOT EXISTS deleted_by TEXT;

-- The legacy version writer only set `version`; both spellings are kept in step
-- so a row can never exist with a NULL version number.
ALTER TABLE venture_document_versions ADD COLUMN IF NOT EXISTS version_number INTEGER;
ALTER TABLE venture_document_versions ADD COLUMN IF NOT EXISTS version_notes TEXT;
ALTER TABLE venture_document_versions ADD COLUMN IF NOT EXISTS file_type TEXT;

CREATE INDEX IF NOT EXISTS idx_venture_documents_room
    ON venture_documents(venture_id, is_deleted, category);

COMMIT;

-- ─── Verify ─────────────────────────────────────────────────────────────────
--   SELECT review_status, count(*) FROM venture_documents GROUP BY 1;
--   SELECT * FROM venture_data_room_requirements ORDER BY venture_id, category;
--   SELECT * FROM venture_data_room_grants WHERE revoked_at IS NULL;
