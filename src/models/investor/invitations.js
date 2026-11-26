import db from "@/lib/db";

// ── Phase 4 — investor invitations ───────────────────────────────────────────

export async function insertInvitation({ email, name, tokenHash, sentBy, expiresAt }) {
  return db.execute({
    sql: `INSERT INTO investor_invitations (email, name, token_hash, sent_by, expires_at, status)
          VALUES (?, ?, ?, ?, ?, 'sent') RETURNING *`,
    args: [
      String(email).trim().toLowerCase(),
      name || null,
      tokenHash,
      sentBy || null,
      expiresAt || null,
    ],
  });
}

export async function listInvitations({ status = null, limit = 200 } = {}) {
  const args = [];
  let sql = `SELECT id, email, name, sent_by, sent_at, expires_at, opened_at,
                    submitted_at, form_submission_id, status, created_at
               FROM investor_invitations`;
  if (status) {
    sql += " WHERE status = ?";
    args.push(status);
  }
  sql += " ORDER BY created_at DESC LIMIT ?";
  args.push(limit);
  return db.execute({ sql, args });
}

export async function getInvitationByTokenHash(tokenHash) {
  return db.execute({
    sql: "SELECT * FROM investor_invitations WHERE token_hash = ? LIMIT 1",
    args: [tokenHash],
  });
}

export async function getLatestInvitationByEmail(email) {
  return db.execute({
    sql: `SELECT * FROM investor_invitations
           WHERE email = ?
           ORDER BY created_at DESC LIMIT 1`,
    args: [String(email).trim().toLowerCase()],
  });
}

export async function markInvitationOpened(id) {
  return db.execute({
    sql: `UPDATE investor_invitations
             SET opened_at = COALESCE(opened_at, NOW()),
                 status = CASE WHEN status = 'sent' THEN 'opened' ELSE status END
           WHERE id = ?`,
    args: [id],
  });
}

export async function markInvitationSubmitted({ id, submissionId = null }) {
  return db.execute({
    sql: `UPDATE investor_invitations
             SET submitted_at = NOW(),
                 form_submission_id = COALESCE(?, form_submission_id),
                 status = 'submitted'
           WHERE id = ?`,
    args: [submissionId, id],
  });
}

export async function updateInvitationStatus({ id, status }) {
  return db.execute({
    sql: "UPDATE investor_invitations SET status = ? WHERE id = ? RETURNING *",
    args: [status, id],
  });
}
