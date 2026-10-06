import db from "@/lib/db";

/**
 * Auth flows model — forgot/setup/reset password flows (REPOSITORY layer).
 *
 * The setup-token reads/writes, the legacy-hash backfills and the contact
 * credential/audit writes used by `/api/auth/forgot-password`,
 * `/api/auth/setup-password` and `/api/auth/reset-password`, split verbatim out
 * of `models/authFlows.js` — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

/** Active contact lookup by email (forgot-password — no enumeration). */
export async function getActiveContactByEmail(email) {
  return db.execute({
    sql: "SELECT cid, name, email FROM contacts WHERE email = ? AND deleted = 0 AND deleted_at IS NULL AND status = 'active' LIMIT 1",
    args: [email],
  });
}

/** Invalidate prior unused setup tokens for a contact (forgot-password). */
export async function expireUnusedPasswordSetupTokensForReset(contactCid) {
  return db.execute({
    sql: "UPDATE password_setup_tokens SET used = 1 WHERE contact_cid = ? AND used = 0",
    args: [contactCid],
  });
}

/** Create a password-reset setup token (1h expiry, forgot-password). */
export async function createPasswordResetToken(contactCid, token, tokenHash, expiresAtStr) {
  return db.execute({
    sql: `INSERT INTO password_setup_tokens (contact_cid, token, token_hash, expires_at, used)
              VALUES (?, ?, ?, ?, 0)`,
    args: [contactCid, token, tokenHash, expiresAtStr],
  });
}

/** Valid unused, unexpired setup token by hash/raw (setup-password). */
export async function getValidPasswordSetupToken(tokenHash, token) {
  return db.execute({
    sql: `SELECT * FROM password_setup_tokens
            WHERE used = 0 AND expires_at > NOW()
              AND (token_hash = ? OR token = ?)`,
    args: [tokenHash, token],
  });
}

/** Lazily backfill the hash of a legacy token row (setup-password). */
export async function backfillPasswordSetupTokenHash(tokenHash, id) {
  return db.execute({
    sql: "UPDATE password_setup_tokens SET token_hash = ? WHERE id = ?",
    args: [tokenHash, id],
  });
}

/** Set the contact password and flip status to active (setup-password). */
export async function setContactPasswordAndStatusActive(hashedPassword, contactCid) {
  return db.execute({
    sql: "UPDATE contacts SET password = ?, status = 'active' WHERE cid = ?",
    args: [hashedPassword, contactCid],
  });
}

/** Mark a setup token as used (setup-password). */
export async function markPasswordSetupTokenUsed(id) {
  return db.execute({
    sql: "UPDATE password_setup_tokens SET used = 1 WHERE id = ?",
    args: [id],
  });
}

/** Audit log entry — password set via secure setup link. */
export async function logPasswordSetupAudit(contactCid) {
  return db.execute({
    sql: `INSERT INTO audit_log (entity_type, entity_id, user_id, user_name, action, details)
              VALUES ('user', 0, ?, ?, 'password_setup', 'Password set via secure setup link')`,
    args: [contactCid, contactCid],
  });
}

/** Valid setup token joined with contact name/email (setup-password validate). */
export async function getPasswordSetupTokenWithUser(tokenHash, token) {
  return db.execute({
    sql: `SELECT pst.*, c.name as user_name, c.email as user_email
            FROM password_setup_tokens pst
            LEFT JOIN contacts c ON pst.contact_cid = c.cid
            WHERE pst.used = 0 AND pst.expires_at > NOW()
              AND (pst.token_hash = ? OR pst.token = ?)`,
    args: [tokenHash, token],
  });
}

/** Lazily backfill the hash of a legacy token row (setup-password validate). */
export async function backfillPasswordSetupTokenHashOnValidate(tokenHash, id) {
  return db.execute({
    sql: "UPDATE password_setup_tokens SET token_hash = ? WHERE id = ?",
    args: [tokenHash, id],
  });
}

/** Full contact row by email (reset-password current-password gate). */
export async function getContactByEmailForPasswordReset(email) {
  return db.execute({
    sql: 'SELECT * FROM contacts WHERE email = ? LIMIT 1',
    args: [email],
  });
}

/** Replace the contact's password hash by email (reset-password). */
export async function updateContactPasswordByEmail(hashedPassword, email) {
  return db.execute({
    sql: 'UPDATE contacts SET password = ? WHERE email = ?',
    args: [hashedPassword, email],
  });
}
