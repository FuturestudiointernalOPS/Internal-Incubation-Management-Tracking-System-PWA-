-- =============================================================================
-- 044 — RUN VIEW TOKENS (READ-ONLY RESPONSE VIEWER, EMAIL-ALLOWLISTED)
-- -----------------------------------------------------------------------------
-- Creates a table for run-level view tokens.
-- A token grants read-only access to ALL responses for a specific form run.
-- Access is restricted to a specific set of whitelisted emails — recipients
-- must provide their email and it must match an allowlisted entry.
-- No login, no CRM access, no edit/delete capability.
--
-- SECURITY MODEL
--   1. Visitor visits /platform/runs/view/[token]
--   2. They enter their email address
--   3. Server checks:  (a) token exists and is active,
--                      (b) email matches an entry in run_view_token_emails
--   4. Only then are responses shown in read-only mode
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS run_view_tokens (
    id          SERIAL PRIMARY KEY,
    run_id      INTEGER NOT NULL REFERENCES platform_form_runs(id) ON DELETE CASCADE,
    token       TEXT NOT NULL UNIQUE,          -- plaintext token (random 48-char hex)
    created_by  TEXT,                          -- cid of the admin who created it
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    expires_at  TIMESTAMPTZ,                   -- NULL = never expires
    is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS run_view_token_emails (
    id          SERIAL PRIMARY KEY,
    token_id    INTEGER NOT NULL REFERENCES run_view_tokens(id) ON DELETE CASCADE,
    email       TEXT NOT NULL,
    added_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_run_view_tokens_run      ON run_view_tokens(run_id);
CREATE INDEX IF NOT EXISTS idx_run_view_tokens_token    ON run_view_tokens(token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_run_view_token_emails_uniq
    ON run_view_token_emails(token_id, LOWER(email));

COMMIT;
