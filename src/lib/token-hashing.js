import crypto from "crypto";

/**
 * One-way hashing for invitation/password-setup/session tokens.
 *
 * Tokens are still generated as high-entropy UUIDs and sent to the user in
 * plaintext (that's the value the link carries), but we store only the
 * SHA-256 hash at rest so a direct DB read does not expose usable tokens.
 *
 * The token_hash column self-heal moved to `@/services/platform/tokenHash` and is
 * re-exported here (see docs/LAYER_SPLIT.md).
 */

export { ensureTokenHashColumns } from "@/services/platform/tokenHash";

export function hashToken(token) {
  if (!token) return null;
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}
