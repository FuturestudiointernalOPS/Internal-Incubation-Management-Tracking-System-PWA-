-- ============================================================================
-- PHASE: AUTH-02 — Invite & Activation Flow
-- Run against staging first, then production after testing.
-- ============================================================================

-- 1. Extend password_setup_tokens for invite flow
ALTER TABLE password_setup_tokens
  ADD COLUMN IF NOT EXISTS token_type TEXT
    CHECK (token_type IN ('staff_invite','participant_invite','password_reset','family_invite')),
  ADD COLUMN IF NOT EXISTS invited_by TEXT REFERENCES contacts(cid),
  ADD COLUMN IF NOT EXISTS role TEXT,
  ADD COLUMN IF NOT EXISTS group_id TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '48 hours'),
  ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ;

-- 2. Add email verification fields to contacts
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_password_tokens_token ON password_setup_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_tokens_type ON password_setup_tokens(token_type);
CREATE INDEX IF NOT EXISTS idx_password_tokens_expires ON password_setup_tokens(expires_at);
