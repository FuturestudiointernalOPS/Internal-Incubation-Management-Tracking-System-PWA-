-- =============================================================================
-- 043 — FORM RESPONSE SHARING (READ-ONLY, EMAIL-VERIFIED)
-- -----------------------------------------------------------------------------
-- Additive, idempotent migration. Lets an admin share a single form response
-- (platform_form_submissions) with a recipient email for read-only viewing.
--
-- SECURITY MODEL
--   The random token is NOT the only access layer. The recipient must
--   authenticate and their verified account email must match recipient_email,
--   AND the share must be active and unexpired. Only then is the response shown.
--   The token is stored only as a SHA-256 hash at rest.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS form_response_shares (
    id SERIAL PRIMARY KEY,
    response_id INTEGER NOT NULL REFERENCES platform_form_submissions(id) ON DELETE CASCADE,
    recipient_email TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'revoked', 'expired')),
    expires_at TIMESTAMPTZ,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    revoked_by TEXT,
    last_viewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_form_response_shares_response ON form_response_shares(response_id);
CREATE INDEX IF NOT EXISTS idx_form_response_shares_email ON form_response_shares(LOWER(recipient_email));
CREATE INDEX IF NOT EXISTS idx_form_response_shares_token_hash ON form_response_shares(token_hash);

COMMIT;
