-- =============================================================================
-- IMPACTOS — VENTURE OS PITCH DECK & DATA ROOM MANAGEMENT
-- Enhancement 4.3 — Data Room
-- =============================================================================

-- Data room documents
CREATE TABLE IF NOT EXISTS venture_documents (
    id SERIAL PRIMARY KEY,
    venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    document_type TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'other',
    file_name TEXT NOT NULL,
    file_size BIGINT,
    file_type TEXT,
    file_url TEXT NOT NULL,
    thumbnail_url TEXT,
    current_version INTEGER DEFAULT 1,
    is_pitch_deck BOOLEAN DEFAULT FALSE,
    uploaded_by TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venture_documents_venture ON venture_documents(venture_id);
CREATE INDEX IF NOT EXISTS idx_venture_documents_type ON venture_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_venture_documents_pitch ON venture_documents(is_pitch_deck);

-- Document versions (append-only)
CREATE TABLE IF NOT EXISTS venture_document_versions (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES venture_documents(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    file_name TEXT NOT NULL,
    file_size BIGINT,
    file_url TEXT NOT NULL,
    uploaded_by TEXT,
    change_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(document_id, version)
);

CREATE INDEX IF NOT EXISTS idx_doc_versions_document ON venture_document_versions(document_id);

-- Secure sharing links
CREATE TABLE IF NOT EXISTS venture_document_shares (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES venture_documents(id) ON DELETE CASCADE,
    venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
    share_token TEXT NOT NULL UNIQUE,
    shared_with_email TEXT,
    shared_with_name TEXT,
    access_type TEXT DEFAULT 'read', -- read | download | full
    password_hash TEXT,
    expires_at TIMESTAMP,
    max_downloads INTEGER,
    download_count INTEGER DEFAULT 0,
    is_revoked BOOLEAN DEFAULT FALSE,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_shares_token ON venture_document_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_doc_shares_document ON venture_document_shares(document_id);

-- Access logs
CREATE TABLE IF NOT EXISTS venture_document_access_logs (
    id SERIAL PRIMARY KEY,
    share_id INTEGER REFERENCES venture_document_shares(id) ON DELETE CASCADE,
    document_id INTEGER NOT NULL REFERENCES venture_documents(id) ON DELETE CASCADE,
    venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
    access_type TEXT NOT NULL, -- view | download
    viewer_email TEXT,
    viewer_name TEXT,
    ip_address TEXT,
    user_agent TEXT,
    duration_seconds INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_access_logs_document ON venture_document_access_logs(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_access_logs_share ON venture_document_access_logs(share_id);
