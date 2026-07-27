-- =============================================================================
-- IMPACTOS — VENTURE OS FOUNDER & CO-FOUNDER MANAGEMENT
-- Enhancement 1.3 — Founder & Co-Founder Management
-- =============================================================================

-- Add role column to venture_founders if missing
ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'founder';
ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS is_owner BOOLEAN DEFAULT FALSE;
ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP;
ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS suspended_by TEXT;
ALTER TABLE venture_founders ADD COLUMN IF NOT EXISTS invitation_expires_at TIMESTAMP;

-- Ownership history (append-only, never overwritten)
CREATE TABLE IF NOT EXISTS ownership_history (
    id SERIAL PRIMARY KEY,
    venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
    previous_owner_id INTEGER REFERENCES venture_founders(id) ON DELETE SET NULL,
    previous_owner_email TEXT NOT NULL,
    previous_owner_name TEXT NOT NULL,
    new_owner_id INTEGER REFERENCES venture_founders(id) ON DELETE SET NULL,
    new_owner_email TEXT NOT NULL,
    new_owner_name TEXT NOT NULL,
    transferred_by_id INTEGER REFERENCES venture_founders(id) ON DELETE SET NULL,
    transferred_by_email TEXT,
    reason TEXT DEFAULT 'ownership_transfer',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ownership_history_venture_id ON ownership_history(venture_id);

-- Extended invitation tokens table
CREATE TABLE IF NOT EXISTS venture_invitations (
    id SERIAL PRIMARY KEY,
    venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
    invited_by INTEGER REFERENCES venture_founders(id) ON DELETE SET NULL,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'co-founder',
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    accepted_at TIMESTAMP,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(venture_id, email)
);

CREATE INDEX IF NOT EXISTS idx_venture_invitations_venture_id ON venture_invitations(venture_id);
CREATE INDEX IF NOT EXISTS idx_venture_invitations_token ON venture_invitations(token);
CREATE INDEX IF NOT EXISTS idx_venture_invitations_email ON venture_invitations(email);

-- Update existing founders: set first founder as owner if none exists
UPDATE venture_founders vf
SET is_owner = TRUE, role = COALESCE(vf.role, 'founder')
WHERE vf.id = (
    SELECT MIN(vf2.id) FROM venture_founders vf2
    WHERE vf2.venture_id = vf.venture_id
    AND NOT EXISTS (
        SELECT 1 FROM venture_founders vf3
        WHERE vf3.venture_id = vf2.venture_id AND vf3.is_owner = TRUE
    )
);
