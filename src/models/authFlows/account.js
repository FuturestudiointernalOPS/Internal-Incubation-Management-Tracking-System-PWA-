import db from "@/lib/db";

/**
 * Auth flows model — language preference and revoke-access writes
 * (REPOSITORY layer).
 *
 * The language update, the contact existence/inactive writes and the session
 * destruction used by `/api/auth/language` and the revoke-access flow, split
 * verbatim out of `models/authFlows.js` — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

/** Update the current user's language preference (contacts by cid or id). */
export async function updateContactLanguage(language, userId) {
  return db.execute({
    sql: "UPDATE contacts SET language = ? WHERE (cid = ? OR id = ?) AND deleted = 0",
    args: [language, userId, userId],
  });
}

/** Existence check used by the revoke-access flow. */
export async function findContactCidByCid(cid) {
  return db.execute({
    sql: "SELECT cid FROM contacts WHERE cid = ?",
    args: [cid],
  });
}

/** Revoke access — mark the contact inactive. */
export async function setContactInactive(cid) {
  return db.execute({
    sql: "UPDATE contacts SET status = 'inactive' WHERE cid = ?",
    args: [cid],
  });
}

/** Revoke access — destroy all of a user's sessions. */
export async function deleteUserSessions(cid) {
  return db.execute({
    sql: "DELETE FROM user_sessions WHERE user_cid = ?",
    args: [cid],
  });
}

/**
 * Delete every session for a user EXCEPT the one identified by `keepTokenHash`.
 * Used when a user changes their own password: the credential change must kill
 * older sessions, but the session performing the change stays alive.
 */
export async function deleteUserSessionsExcept(cid, keepTokenHash) {
  return db.execute({
    sql: "DELETE FROM user_sessions WHERE user_cid = ? AND (token_hash IS NULL OR token_hash <> ?)",
    args: [cid, keepTokenHash],
  });
}
