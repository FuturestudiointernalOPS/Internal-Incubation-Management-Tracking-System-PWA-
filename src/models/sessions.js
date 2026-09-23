/**
 * sessions model — every SQL statement touching `user_sessions`.
 *
 * One function per query, named after the outcome it returns. The statements are
 * byte-identical to the ones the authentication module used to run inline: the
 * API suites match SQL text, so moving them must not alter a single character.
 *
 * This module holds no policy. What a session *means* (how long it lives, which
 * user standing is acceptable, how failures are cached) belongs to
 * `@/server/auth/session`.
 */

import db from "@/lib/db";

/** Live sessions of one user, oldest first — used to enforce the session cap. */
export async function listSessionsForUser(userCid) {
  return db.execute({
    sql: "SELECT id, created_at FROM user_sessions WHERE user_cid = ? ORDER BY created_at ASC",
    args: [userCid],
  });
}

export async function deleteSessionById(id) {
  return db.execute({
    sql: "DELETE FROM user_sessions WHERE id = ?",
    args: [id],
  });
}

export async function insertSession({ token, tokenHash, userCid, role, expiresAt, isImpersonation }) {
  return db.execute({
    sql: `INSERT INTO user_sessions (token, token_hash, user_cid, role, expires_at, is_impersonation)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [token, tokenHash, userCid, role, expiresAt, isImpersonation === true],
  });
}

/** Preferred lookup: hits the unique partial index on `token_hash`. */
export async function findSessionByTokenHash(tokenHash) {
  return db.execute({
    sql: `SELECT s.*, c.name, c.email, c.status, c.group_name
          FROM user_sessions s
          LEFT JOIN contacts c ON s.user_cid = c.cid
          WHERE s.expires_at > NOW() AND s.token_hash = ?`,
    args: [tokenHash],
  });
}

/** Fallback for rows written before hashing existed (PK-indexed token). */
export async function findSessionByToken(token) {
  return db.execute({
    sql: `SELECT s.*, c.name, c.email, c.status, c.group_name
          FROM user_sessions s
          LEFT JOIN contacts c ON s.user_cid = c.cid
          WHERE s.expires_at > NOW() AND s.token = ?`,
    args: [token],
  });
}

/** Lazily upgrade a legacy row to the hashed lookup. */
export async function backfillSessionTokenHash(tokenHash, token) {
  return db.execute({
    sql: "UPDATE user_sessions SET token_hash = ? WHERE token = ?",
    args: [tokenHash, token],
  });
}

export async function deleteSessionByTokenOrHash(tokenHash, token) {
  return db.execute({
    sql: "DELETE FROM user_sessions WHERE token_hash = ? OR token = ?",
    args: [tokenHash, token],
  });
}

/**
 * Schema self-heal: an environment whose `user_sessions` predates the
 * impersonation column must not fail the login path.
 */
export async function ensureImpersonationColumn() {
  return db.execute(
    "ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS is_impersonation BOOLEAN DEFAULT FALSE",
  );
}
