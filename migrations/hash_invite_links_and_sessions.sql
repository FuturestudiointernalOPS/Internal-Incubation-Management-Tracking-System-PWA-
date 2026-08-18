-- =============================================================================
-- Store remaining link/session tokens as SHA-256 hashes at rest
-- -----------------------------------------------------------------------------
-- Covers:
--   v2_invitations        (program invite links  /invite/{token})
--   venture_invite_links  (venture invite links  /register-venture?token=)
--   user_sessions         (session cookie tokens)
--
-- Additive and idempotent. Raw `token` columns are kept temporarily so
-- in-flight links and sessions keep working; lookups use `token_hash` first
-- with a raw `token` fallback and lazily backfill the hash.
-- =============================================================================

-- ── v2_invitations ─────────────────────────────────────────────────────────
ALTER TABLE v2_invitations ADD COLUMN IF NOT EXISTS token_hash TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_v2_invitations_token_hash
  ON v2_invitations(token_hash) WHERE token_hash IS NOT NULL;

-- ── venture_invite_links ───────────────────────────────────────────────────
ALTER TABLE venture_invite_links ADD COLUMN IF NOT EXISTS token_hash TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_venture_invite_links_token_hash
  ON venture_invite_links(token_hash) WHERE token_hash IS NOT NULL;

-- ── user_sessions ──────────────────────────────────────────────────────────
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS token_hash TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_sessions_token_hash
  ON user_sessions(token_hash) WHERE token_hash IS NOT NULL;

-- Best-effort backfill when pgcrypto is available. If unavailable, runtime
-- lookups lazily backfill each row on first use.
DO $$
BEGIN
  BEGIN
    UPDATE v2_invitations
    SET token_hash = encode(digest(token, 'sha256'), 'hex')
    WHERE token_hash IS NULL AND token IS NOT NULL;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    UPDATE venture_invite_links
    SET token_hash = encode(digest(token, 'sha256'), 'hex')
    WHERE token_hash IS NULL AND token IS NOT NULL;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    UPDATE user_sessions
    SET token_hash = encode(digest(token, 'sha256'), 'hex')
    WHERE token_hash IS NULL AND token IS NOT NULL;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;
