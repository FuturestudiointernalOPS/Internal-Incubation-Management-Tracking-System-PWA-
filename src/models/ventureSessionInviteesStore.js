/**
 * Venture session invitees — statements (REPOSITORY layer).
 *
 * The data access behind `@/services/ventures/sessionInvitees`: the invitees of
 * one session (or several, for a list read), one invitee row, the upsert/delete
 * writes and the lookup a person's calendar needs ("which sessions was I invited
 * to").
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";

// ── Reads ────────────────────────────────────────────────────────────────────

/** The invitees of one session, oldest first. */
export function selectInviteesBySession(sessionId) {
  return db.execute({
    sql: `SELECT id, session_id, email, name, contact_cid, status, invited_at
            FROM venture_session_invitees
           WHERE session_id = ?
           ORDER BY invited_at ASC, id ASC`,
    args: [sessionId],
  });
}

/** The invitees of several sessions, for a batched list read. */
export function selectInviteesBySessionIds(sessionIds) {
  const ids = (sessionIds || []).map((id) => parseInt(id, 10)).filter((id) => Number.isFinite(id));
  if (ids.length === 0) return Promise.resolve({ rows: [] });
  return db.execute({
    sql: `SELECT id, session_id, email, name, contact_cid, status, invited_at
            FROM venture_session_invitees
           WHERE session_id IN (${ids.map(() => "?").join(", ")})
           ORDER BY session_id ASC, invited_at ASC, id ASC`,
    args: ids,
  });
}

/** One invitee row, for an object-level authorization check before a write. */
export function selectInviteeById(inviteeId) {
  return db.execute({
    sql: `SELECT id, session_id, email, name, contact_cid, status
            FROM venture_session_invitees
           WHERE id = ?`,
    args: [inviteeId],
  });
}

/**
 * The sessions a platform account was invited to — the calendar source read.
 * Only rows bound to an account (`contact_cid`) can be reached this way; an
 * outside guest has no account to push to.
 */
export function selectInvitedSessionsForContact(contactCid) {
  return db.execute({
    sql: `SELECT s.id, s.venture_id, s.title, s.description, s.session_type,
                 s.coach_name, s.start_time, s.end_time, s.timezone, s.location,
                 s.meeting_link, s.status, s.journey_stage_id, s.milestone_ref,
                 s.venture_facing, s.created_by, s.coach_contact_id
            FROM venture_session_invitees i
            JOIN venture_sessions s ON s.id = i.session_id
           WHERE i.contact_cid = ?
             AND s.start_time IS NOT NULL
             AND s.status NOT IN ('cancelled', 'no_show')
           ORDER BY s.start_time ASC`,
    args: [contactCid],
  });
}

// ── Writes ───────────────────────────────────────────────────────────────────

/**
 * Add (or refresh) one invitee. Re-adding an existing address updates the name
 * and clears the previous status back to `pending` — a fresh invitation is a
 * fresh invitation.
 */
export function upsertInvitee({ sessionId, email, name, contactCid, createdBy }) {
  return db.execute({
    sql: `INSERT INTO venture_session_invitees (session_id, email, name, contact_cid, created_by)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT (session_id, LOWER(email)) DO UPDATE SET
            name = EXCLUDED.name,
            contact_cid = EXCLUDED.contact_cid,
            status = 'pending',
            invited_at = NOW()
          RETURNING id, session_id, email, name, contact_cid, status`,
    args: [sessionId, String(email).trim(), name || null, contactCid || null, createdBy || null],
  });
}

/** Remove one invitee. */
export function deleteInvitee(inviteeId) {
  return db.execute({ sql: "DELETE FROM venture_session_invitees WHERE id = ?", args: [inviteeId] });
}
