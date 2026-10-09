import db from "@/lib/db";

/**
 * The email on file for an assignee who is only a NAME (REPOSITORY layer).
 *
 * A tracker assigns work to "Amina". She has no ImpactOS account, so there is
 * no address to remind her at — and finding one must NOT mean inventing a
 * person. This table stores an address against the name the tracker wrote.
 *
 * The name stays the reference: one row for Amina covers every activity she
 * owns in that Venture, and resolving the assignment to a real contact later
 * simply takes precedence over it.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement.
 */

/** Every email on file for a Venture, keyed for lookup by display name. */
export function selectAssigneeEmails(ventureId) {
  return db.execute({
    sql: `SELECT id, display_name, email, updated_at
          FROM venture_assignee_emails
          WHERE venture_id::text = ?::text
          ORDER BY LOWER(TRIM(display_name))`,
    args: [String(ventureId)],
  });
}

/**
 * Record (or correct) the address for one name.
 *
 * Upsert on the lower-cased name: a person's address is corrected, never
 * duplicated, however the sheet capitalises their name on each row.
 */
export function upsertAssigneeEmail({ ventureId, displayName, email, actorCid }) {
  return db.execute({
    sql: `INSERT INTO venture_assignee_emails (venture_id, display_name, email, created_by)
          VALUES (?, ?, ?, ?)
          ON CONFLICT (venture_id, LOWER(TRIM(display_name)))
          DO UPDATE SET email = EXCLUDED.email, updated_at = NOW()
          RETURNING id, display_name, email`,
    args: [String(ventureId), String(displayName).trim(), String(email).trim(), actorCid || null],
  });
}

/** Remove the address on file for one name. The assignments themselves stay. */
export function deleteAssigneeEmail({ ventureId, displayName }) {
  return db.execute({
    sql: `DELETE FROM venture_assignee_emails
          WHERE venture_id::text = ?::text AND LOWER(TRIM(display_name)) = LOWER(TRIM(?))`,
    args: [String(ventureId), String(displayName)],
  });
}

/**
 * The addresses of real contacts, by cid, for the people who HAVE an account.
 *
 * A person with a contact record is asked for their address from the record —
 * the table above is only ever the fallback for a name with no account behind
 * it, so a real person's own email always wins over anything typed by hand.
 * Returns nothing for an unknown cid, which the caller reads as "no address".
 */
export function selectContactEmailsByCids(cids = []) {
  const list = (Array.isArray(cids) ? cids : []).map((cid) => String(cid)).filter(Boolean);
  if (list.length === 0) return Promise.resolve({ rows: [] });
  return db.execute({
    sql: `SELECT cid, name, email, deleted
          FROM contacts
          WHERE cid IN (${list.map(() => "?").join(", ")})`,
    args: list,
  });
}

/**
 * The contact that already holds an address, if any.
 *
 * Answers "does this address belong to someone who can sign in?" for a
 * reminder sent to an address typed by hand: the button in the email sends a
 * known address to the login page and an unknown one to registration.
 */
export function selectContactCidByEmail(email) {
  return db.execute({
    sql: `SELECT cid
          FROM contacts
          WHERE LOWER(TRIM(email)) = LOWER(TRIM(?)) AND deleted = 0 AND deleted_at IS NULL
          LIMIT 1`,
    args: [String(email ?? "")],
  });
}
