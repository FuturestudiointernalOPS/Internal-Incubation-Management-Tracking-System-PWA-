import db from "@/lib/db";

/**
 * Auth flows model — new invite and resend-invite writes (REPOSITORY layer).
 *
 * The contact reads/writes, setup-token issue/expiry and timeline entries used
 * by `/api/auth/invite` and `/api/auth/resend-invite`, split verbatim out of
 * `models/authFlows.js` — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

/** Contact brief lookup by email (invite resend flow). */
export async function getContactBriefByEmailForResend(email) {
  return db.execute({
    sql: "SELECT cid, name, email FROM contacts WHERE email = ? AND deleted = 0 AND deleted_at IS NULL LIMIT 1",
    args: [email],
  });
}

/** Expire all setup tokens for a contact (invite resend flow). */
export async function expirePasswordSetupTokensForResend(contactCid) {
  return db.execute({
    sql: "UPDATE password_setup_tokens SET used = 1 WHERE contact_cid = ?",
    args: [contactCid],
  });
}

/** Issue a fresh staff-invite setup token (invite resend flow). */
export async function createStaffInviteSetupTokenForResend(token, tokenHash, contactCid) {
  return db.execute({
    sql: "INSERT INTO password_setup_tokens (token, token_hash, contact_cid, expires_at, token_type) VALUES (?, ?, ?, NOW() + INTERVAL '48 hours', 'staff_invite')",
    args: [token, tokenHash, contactCid],
  });
}

/** Contact timeline entry — invitation resent (invite resend flow). */
export async function logInvitationResent(contactCid, actorId) {
  return db.execute({
    sql: `INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, actor_id, metadata)
                VALUES (?, 'invitation_resent', 'Invitation resent', 'contacts', ?, '{}'::jsonb)`,
    args: [contactCid, actorId],
  });
}

/** Contact lookup with password by email (invite reuse detection). */
export async function getContactWithPasswordByEmail(email) {
  return db.execute({
    sql: "SELECT cid, name, password FROM contacts WHERE email = ? AND deleted = 0 AND deleted_at IS NULL LIMIT 1",
    args: [email],
  });
}

/** Update an existing invited contact's name + group (only when a name is given). */
export async function updateContactNameAndGroup(name, groupName, contactCid) {
  return db.execute({
    sql: "UPDATE contacts SET name = ?, group_name = COALESCE(?, group_name) WHERE cid = ?",
    args: [name, groupName, contactCid],
  });
}

/** Update an existing invited contact's group only. */
export async function updateContactGroup(groupName, contactCid) {
  return db.execute({
    sql: "UPDATE contacts SET group_name = COALESCE(?, group_name) WHERE cid = ?",
    args: [groupName, contactCid],
  });
}

/** Create a pending contact record for a new invite. */
export async function createPendingContact(contactCid, name, email, role, groupName) {
  return db.execute({
    sql: "INSERT INTO contacts (cid, name, email, role, status, group_name) VALUES (?, ?, ?, ?, 'pending', ?)",
    args: [contactCid, name, email, role, groupName],
  });
}

/** Expire all setup tokens for a contact (new invite flow). */
export async function expirePasswordSetupTokensForNewInvite(contactCid) {
  return db.execute({
    sql: "UPDATE password_setup_tokens SET used = 1 WHERE contact_cid = ?",
    args: [contactCid],
  });
}

/** Issue a fresh staff-invite setup token (new invite flow). */
export async function createStaffInviteSetupTokenForNewInvite(token, tokenHash, contactCid) {
  return db.execute({
    sql: "INSERT INTO password_setup_tokens (token, token_hash, contact_cid, expires_at, token_type) VALUES (?, ?, ?, NOW() + INTERVAL '48 hours', 'staff_invite')",
    args: [token, tokenHash, contactCid],
  });
}

/** Contact timeline entry — invitation sent (new invite flow, program context). */
export async function logInvitationSent(contactCid, description, contextId, actorId) {
  return db.execute({
    sql: `INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, context_id, actor_id, metadata)
              VALUES (?, 'invitation_sent', ?, 'programs', ?, ?, '{}'::jsonb)`,
    args: [contactCid, description, contextId, actorId],
  });
}
