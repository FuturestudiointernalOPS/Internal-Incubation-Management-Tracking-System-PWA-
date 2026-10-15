/**
 * Venture session INVITEES — the people told about a session by e-mail.
 *
 * A session invitee is NOT an attendance row (`venture_session_attendance`):
 * attendance records who showed up, and requires a platform account. An invitee
 * is anybody the session is announced to, by e-mail alone — on ImpactOS or not.
 * `contact_cid` is filled when the e-mail belongs to an account (so the session
 * can also reach that person's calendar); it is NULL for an outside guest.
 *
 * One part of the Venture schema bootstrap; concatenated, in order, by
 * `../schema.js`. Statement order across parts is significant.
 */

export default [
  "CREATE TABLE IF NOT EXISTS venture_session_invitees (id SERIAL PRIMARY KEY, session_id INTEGER NOT NULL REFERENCES venture_sessions(id) ON DELETE CASCADE, email TEXT NOT NULL, name TEXT, contact_cid TEXT, status TEXT NOT NULL DEFAULT 'pending', invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_by TEXT)",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_venture_session_invitees_email ON venture_session_invitees(session_id, LOWER(email))",
  "CREATE INDEX IF NOT EXISTS idx_venture_session_invitees_contact ON venture_session_invitees(contact_cid) WHERE contact_cid IS NOT NULL",
];
