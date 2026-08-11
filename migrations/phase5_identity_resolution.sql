-- Phase 5: Identity Resolution
-- contact_duplicate_flags: stores potential duplicate pairs for admin review
-- Safe: additive, no destructive changes

CREATE TABLE IF NOT EXISTS contact_duplicate_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_cid_a TEXT NOT NULL REFERENCES contacts(cid) ON DELETE CASCADE,
    contact_cid_b TEXT NOT NULL REFERENCES contacts(cid) ON DELETE CASCADE,
    match_reason TEXT NOT NULL,
    confidence DECIMAL(3,2) DEFAULT 0.50,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'merged', 'dismissed')),
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(contact_cid_a, contact_cid_b)
);

CREATE INDEX IF NOT EXISTS idx_duplicate_flags_status ON contact_duplicate_flags(status);
