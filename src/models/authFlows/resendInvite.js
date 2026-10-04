import db from "@/lib/db";

/**
 * Auth flows model — resend-invite reads and token re-issue (REPOSITORY layer).
 *
 * The contact-brief read, the pending-token expiry and the fresh setup-token
 * issue used by `/api/auth/resend-invite`, split verbatim out of
 * `models/authFlows.js` — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

/** Contact brief lookup by cid (resend-invite). */
export async function getContactBriefByCid(cid) {
  return db.execute({
    sql: "SELECT cid, name, email, role FROM contacts WHERE cid = ?",
    args: [cid],
  });
}

/** Expire still-pending setup tokens for a contact (resend-invite). */
export async function expirePendingSetupTokensByCid(cid) {
  return db.execute({
    sql: "UPDATE password_setup_tokens SET expires_at = NOW() - INTERVAL '1 second' WHERE contact_cid = ? AND used = 0",
    args: [cid],
  });
}

/** Issue a fresh password setup token (resend-invite). */
export async function createResendInviteSetupToken(token, tokenHash, cid) {
  return db.execute({
    sql: "INSERT INTO password_setup_tokens (token, token_hash, contact_cid, expires_at) VALUES (?, ?, ?, NOW() + INTERVAL '48 hours')",
    args: [token, tokenHash, cid],
  });
}
