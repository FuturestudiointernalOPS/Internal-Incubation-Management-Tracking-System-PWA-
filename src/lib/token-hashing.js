import crypto from "crypto";
import db from "@/lib/db";

/**
 * One-way hashing for invitation/password-setup/session tokens.
 *
 * Tokens are still generated as high-entropy UUIDs and sent to the user in
 * plaintext (that's the value the link carries), but we store only the
 * SHA-256 hash at rest so a direct DB read does not expose usable tokens.
 */
export function hashToken(token) {
  if (!token) return null;
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

/**
 * Idempotent runtime self-healing for the token_hash columns.
 *
 * Runs ONCE per process lifetime (module-level promise), so repeated calls
 * are free. Every statement is IF NOT EXISTS, so applying the SQL migrations
 * explicitly is optional — the columns appear on first use in any
 * environment. On failure the cache resets so the next request retries.
 */
let ensurePromise = null;

export function ensureTokenHashColumns() {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      const statements = [
        "ALTER TABLE password_setup_tokens ADD COLUMN IF NOT EXISTS token_hash TEXT",
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_password_setup_tokens_token_hash ON password_setup_tokens(token_hash) WHERE token_hash IS NOT NULL",
        "ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS token_hash TEXT",
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash) WHERE token_hash IS NOT NULL",
        "ALTER TABLE v2_invitations ADD COLUMN IF NOT EXISTS token_hash TEXT",
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_v2_invitations_token_hash ON v2_invitations(token_hash) WHERE token_hash IS NOT NULL",
        "ALTER TABLE venture_invite_links ADD COLUMN IF NOT EXISTS token_hash TEXT",
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_venture_invite_links_token_hash ON venture_invite_links(token_hash) WHERE token_hash IS NOT NULL",
      ];
      for (const sql of statements) {
        await db.execute(sql);
      }
      return true;
    })().catch((e) => {
      console.warn("[TokenHashing] ensureTokenHashColumns failed:", e.message);
      ensurePromise = null; // allow retry on the next call
      return false;
    });
  }
  return ensurePromise;
}
