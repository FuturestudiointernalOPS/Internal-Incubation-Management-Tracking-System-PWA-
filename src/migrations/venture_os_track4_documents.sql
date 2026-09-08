-- Sprint 3 Track 4: Documents, Assets & Transition
-- Reuses existing Supabase Storage helper (src/lib/storage.js: uploadFile/deleteFile)
-- instead of a new storage layer. New tables only track metadata + permissions.

CREATE TABLE IF NOT EXISTS venture_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'general', -- business | legal | financial | investment | brand | general
  folder TEXT,
  name TEXT NOT NULL,
  storage_path TEXT NOT NULL, -- path passed to supabase.storage bucket
  file_url TEXT NOT NULL,     -- public/signed URL returned by uploadFile()
  mime_type TEXT,
  size_bytes BIGINT,
  approval_status TEXT NOT NULL DEFAULT 'private', -- private | pending_review | approved | shared_with_investor
  is_deleted BOOLEAN NOT NULL DEFAULT false, -- soft delete, business rule 39 (never auto-delete versions)
  uploaded_by TEXT REFERENCES contacts(cid),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS venture_document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES venture_documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  version_notes TEXT,
  uploaded_by TEXT REFERENCES contacts(cid),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(document_id, version_number)
);

CREATE TABLE IF NOT EXISTS venture_document_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES venture_documents(id) ON DELETE CASCADE,
  role_scope TEXT NOT NULL, -- founder | team | advisor | administrator | investor
  access_level TEXT NOT NULL DEFAULT 'view', -- view | edit
  UNIQUE(document_id, role_scope)
);

CREATE TABLE IF NOT EXISTS venture_document_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES venture_documents(id) ON DELETE CASCADE,
  reviewer_id TEXT REFERENCES contacts(cid),
  comment TEXT,
  decision TEXT, -- comment | approved | revision_requested
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vdoc_venture ON venture_documents(venture_id);
CREATE INDEX IF NOT EXISTS idx_vdoc_versions_doc ON venture_document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_vdoc_perms_doc ON venture_document_permissions(document_id);
CREATE INDEX IF NOT EXISTS idx_vdoc_reviews_doc ON venture_document_reviews(document_id);
