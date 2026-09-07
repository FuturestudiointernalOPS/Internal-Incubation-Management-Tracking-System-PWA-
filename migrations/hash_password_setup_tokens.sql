-- =============================================================================
-- Store invitation/password-setup tokens as SHA-256 hashes at rest
-- -----------------------------------------------------------------------------
-- Additive and idempotent. Existing rows keep their raw `token` temporarily so
-- in-flight links continue to work. Lookups use `token_hash` first with a raw
-- `token` fallback, then lazily backfill the hash.
-- =============================================================================

ALTER TABLE password_setup_tokens ADD COLUMN IF NOT EXISTS token_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_password_setup_tokens_token_hash
  ON password_setup_tokens(token_hash)
  WHERE token_hash IS NOT NULL;

-- Best-effort backfill when pgcrypto is available (Supabase usually has it).
-- If it is unavailable, runtime lookups lazily backfill each row on first use.
DO $$
BEGIN
  BEGIN
    UPDATE password_setup_tokens
    SET token_hash = encode(digest(token, 'sha256'), 'hex')
    WHERE token_hash IS NULL AND token IS NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;
