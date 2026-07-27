-- =============================================================================
-- IMPACTOS — VENTURE OS STARTUP VERIFICATION
-- Enhancement 1.4 — Startup Verification
-- =============================================================================

-- Main verification record per venture
CREATE TABLE IF NOT EXISTS venture_verifications (
    id SERIAL PRIMARY KEY,
    venture_id TEXT NOT NULL UNIQUE REFERENCES ventures(venture_id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'draft',
    -- draft | pending_review | verified | rejected | suspended
    submitted_at TIMESTAMP,
    reviewed_by TEXT,
    reviewed_at TIMESTAMP,
    reviewer_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venture_verifications_venture_id ON venture_verifications(venture_id);
CREATE INDEX IF NOT EXISTS idx_venture_verifications_status ON venture_verifications(status);

-- Individual verification categories
CREATE TABLE IF NOT EXISTS venture_verification_items (
    id SERIAL PRIMARY KEY,
    verification_id INTEGER NOT NULL REFERENCES venture_verifications(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    -- business_registration | founder_identity | email_verification | phone_verification | legal_documents | financial_documents
    status TEXT NOT NULL DEFAULT 'pending',
    -- pending | under_review | verified | rejected | not_applicable
    notes TEXT,
    reviewed_by TEXT,
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(verification_id, category)
);

CREATE INDEX IF NOT EXISTS idx_verification_items_verification_id ON venture_verification_items(verification_id);
CREATE INDEX IF NOT EXISTS idx_verification_items_category ON venture_verification_items(category);

-- Verification documents (submitted by founder)
CREATE TABLE IF NOT EXISTS venture_verification_documents (
    id SERIAL PRIMARY KEY,
    verification_id INTEGER NOT NULL REFERENCES venture_verifications(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    document_type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size BIGINT,
    file_type TEXT,
    file_url TEXT NOT NULL,
    uploaded_by TEXT,
    uploaded_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(verification_id, category, document_type, file_name)
);

CREATE INDEX IF NOT EXISTS idx_verification_documents_verification_id ON venture_verification_documents(verification_id);

-- Verification history (append-only audit trail)
CREATE TABLE IF NOT EXISTS venture_verification_history (
    id SERIAL PRIMARY KEY,
    verification_id INTEGER NOT NULL REFERENCES venture_verifications(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    -- VERIFICATION_SUBMITTED | VERIFICATION_APPROVED | VERIFICATION_REJECTED
    -- | VERIFICATION_RESUBMITTED | VERIFICATION_SUSPENDED | ITEM_UPDATED
    previous_status TEXT,
    new_status TEXT,
    actor_cid TEXT,
    actor_name TEXT,
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_history_verification_id ON venture_verification_history(verification_id);
CREATE INDEX IF NOT EXISTS idx_verification_history_action ON venture_verification_history(action);

-- Verification reviews (reviewer comments per review session)
CREATE TABLE IF NOT EXISTS venture_verification_reviews (
    id SERIAL PRIMARY KEY,
    verification_id INTEGER NOT NULL REFERENCES venture_verifications(id) ON DELETE CASCADE,
    reviewer_cid TEXT NOT NULL,
    reviewer_name TEXT,
    decision TEXT NOT NULL,
    -- approved | rejected | info_requested
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_reviews_verification_id ON venture_verification_reviews(verification_id);

-- Verification comments (reviewer-founder communication)
CREATE TABLE IF NOT EXISTS venture_verification_comments (
    id SERIAL PRIMARY KEY,
    verification_id INTEGER NOT NULL REFERENCES venture_verifications(id) ON DELETE CASCADE,
    author_type TEXT NOT NULL,
    -- reviewer | founder | system
    author_cid TEXT,
    author_name TEXT,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_comments_verification_id ON venture_verification_comments(verification_id);
