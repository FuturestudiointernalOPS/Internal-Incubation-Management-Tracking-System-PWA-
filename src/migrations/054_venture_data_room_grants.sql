-- 054 — Venture Data Room: grants, requirement levels and review metadata.
--
-- This file mirrors `ensureDataRoomSchema()` in
-- `src/models/ventureDataRoomStore.js` exactly, so the same DDL can be applied
-- deliberately to a database whose Venture Data Room has never been opened.
--
-- Why it is needed: `ensureDataRoomSchema` runs lazily, on the first Data Room
-- read or write. Until then `venture_documents.review_status` / `expires_at` do
-- not exist, so the readiness read in `GET /api/ventures` fails, is caught, and
-- every Venture reports 0% Investment Readiness on the Ventures list.
--
-- Safe to run repeatedly: every statement is IF NOT EXISTS or ADD COLUMN IF NOT
-- EXISTS. Purely additive — no DROP, no UPDATE, no DELETE.
--
-- Apply with: node scripts/db-audit/apply-schema-file.mjs src/migrations/054_venture_data_room_grants.sql --apply .env.local

CREATE TABLE IF NOT EXISTS venture_data_room_grants (id SERIAL PRIMARY KEY, venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE, document_id UUID REFERENCES venture_documents(id) ON DELETE CASCADE, category TEXT, grantee_cid TEXT NOT NULL, access_level TEXT NOT NULL DEFAULT 'view', granted_by TEXT, expires_at TIMESTAMP, revoked_at TIMESTAMP, revoked_by TEXT, created_at TIMESTAMP DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_data_room_grants_venture ON venture_data_room_grants(venture_id, grantee_cid);
CREATE UNIQUE INDEX IF NOT EXISTS idx_data_room_grants_doc_user ON venture_data_room_grants(document_id, grantee_cid) WHERE document_id IS NOT NULL AND revoked_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_data_room_grants_category_user ON venture_data_room_grants(venture_id, category, grantee_cid) WHERE document_id IS NULL AND revoked_at IS NULL;
CREATE TABLE IF NOT EXISTS venture_data_room_requirements (id SERIAL PRIMARY KEY, venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE, category TEXT NOT NULL, level TEXT NOT NULL DEFAULT 'conditional', stage_bucket TEXT, note TEXT, customized BOOLEAN NOT NULL DEFAULT FALSE, updated_by TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW(), UNIQUE(venture_id, category));
CREATE INDEX IF NOT EXISTS idx_data_room_requirements_venture ON venture_data_room_requirements(venture_id);
ALTER TABLE venture_data_room_requirements ADD COLUMN IF NOT EXISTS stage_bucket TEXT;
ALTER TABLE venture_documents ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'uploaded';
ALTER TABLE venture_documents ADD COLUMN IF NOT EXISTS reviewer_id TEXT;
ALTER TABLE venture_documents ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;
ALTER TABLE venture_documents ADD COLUMN IF NOT EXISTS review_notes TEXT;
ALTER TABLE venture_documents ADD COLUMN IF NOT EXISTS reviewed_version INTEGER;
ALTER TABLE venture_documents ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;
ALTER TABLE venture_documents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE venture_documents ADD COLUMN IF NOT EXISTS deleted_by TEXT;
ALTER TABLE venture_document_versions ADD COLUMN IF NOT EXISTS version_number INTEGER;
ALTER TABLE venture_document_versions ADD COLUMN IF NOT EXISTS version_notes TEXT;
ALTER TABLE venture_document_versions ADD COLUMN IF NOT EXISTS file_type TEXT;
CREATE INDEX IF NOT EXISTS idx_venture_documents_room ON venture_documents(venture_id, is_deleted, category);
