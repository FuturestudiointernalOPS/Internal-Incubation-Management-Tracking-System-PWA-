-- =============================================================================
-- 045 — RUN RESPONSE SHARES (READ-ONLY, LOGIN + EMAIL-VERIFIED)
-- -----------------------------------------------------------------------------
-- Additive, idempotent migration. Replaces the complex run-view token +
-- allowlist + HMAC magic-link system with one simple, secure model:
--
--   One row per (run, email). One random token per row (stored hashed).
--   Access requires: valid token AND logged-in session AND session email
--   matches the share email. Read-only, revocable, expirable.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS run_response_shares (
    id SERIAL PRIMARY KEY,
    run_id INTEGER NOT NULL,
    email TEXT NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_run_response_shares_run ON run_response_shares(run_id);
CREATE INDEX IF NOT EXISTS idx_run_response_shares_email ON run_response_shares(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_run_response_shares_token_hash ON run_response_shares(token_hash);

COMMIT;
