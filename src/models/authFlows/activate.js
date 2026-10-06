import db from "@/lib/db";

/**
 * Auth flows model — account activation (REPOSITORY layer).
 *
 * The activation invite reads, the legacy-hash backfills and the contact/token
 * activation writes used by `/api/auth/activate`, split verbatim out of
 * `models/authFlows.js` — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

/** Valid activation invite + contact info by token hash (activate GET). */
export async function getActivationInviteByTokenHash(tokenHash, token) {
  return db.execute({
    sql: `SELECT pt.*, c.name, c.email, c.role, c.language
            FROM password_setup_tokens pt
            JOIN contacts c ON pt.contact_cid = c.cid
            WHERE pt.used = 0 AND pt.expires_at > NOW()
              AND (pt.token_hash = ? OR pt.token = ?)`,
    args: [tokenHash, token],
  });
}

/** Token expiry row lookup (activate GET — expired-link detection). */
export async function getActivationTokenExpiry(tokenHash, token) {
  return db.execute({
    sql: "SELECT expires_at FROM password_setup_tokens WHERE token_hash = ? OR token = ?",
    args: [tokenHash, token],
  });
}

/** Lazily backfill the hash of a legacy token row (activate GET). */
export async function backfillActivationTokenHashOnOpen(tokenHash, id) {
  return db.execute({
    sql: "UPDATE password_setup_tokens SET token_hash = ? WHERE id = ?",
    args: [tokenHash, id],
  });
}

/** Contact timeline entry — invitation opened (activate GET). */
export async function logInvitationOpened(contactCid) {
  return db.execute({
    sql: `INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, actor_id, metadata)
              VALUES (?, 'invitation_opened', 'Invitation opened', 'contacts', ?, '{}'::jsonb)`,
    args: [contactCid, contactCid],
  });
}

/** Valid activation invite + contact info by token hash (activate POST). */
export async function getActivationInviteForPasswordSetup(tokenHash, token) {
  return db.execute({
    sql: `SELECT pt.*, c.email, c.name, c.role, c.language
            FROM password_setup_tokens pt
            JOIN contacts c ON pt.contact_cid = c.cid
            WHERE pt.used = 0 AND pt.expires_at > NOW()
              AND (pt.token_hash = ? OR pt.token = ?)`,
    args: [tokenHash, token],
  });
}

/** Lazily backfill the hash of a legacy token row (activate POST). */
export async function backfillActivationTokenHashOnActivate(tokenHash, id) {
  return db.execute({
    sql: "UPDATE password_setup_tokens SET token_hash = ? WHERE id = ?",
    args: [tokenHash, id],
  });
}

/** Set the contact password, status = active and activated_at on account activation. */
export async function activateContactWithPassword(hashedPassword, contactCid) {
  return db.execute({
    sql: "UPDATE contacts SET password = ?, status = 'active', activated_at = NOW() WHERE cid = ?",
    args: [hashedPassword, contactCid],
  });
}

/** Mark an activation invite token as used (activate POST). */
export async function markActivationTokenUsed(id) {
  return db.execute({
    sql: "UPDATE password_setup_tokens SET used = 1 WHERE id = ?",
    args: [id],
  });
}

/** Contact timeline entry — invitation activated (activate POST). */
export async function logInvitationActivated(contactCid) {
  return db.execute({
    sql: `INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, actor_id, metadata)
              VALUES (?, 'invitation_activated', 'Account activated', 'contacts', ?, '{}'::jsonb)`,
    args: [contactCid, contactCid],
  });
}
