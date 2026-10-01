/**
 * Contacts — identity lookup (REPOSITORY layer).
 *
 * The statement that answers "which person is this email?" for the contacts and
 * invites routes. The normalisation and the empty-input guard live in
 * `@/services/contacts/contactLookup`.
 *
 * SQL is byte-identical to what used to sit inline in `models/contacts.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";

/** The live contact a (already-normalised) email belongs to, or none. */
export function selectContactByEmail(cleanEmail) {
  return db.execute({
    sql: `SELECT cid, name, email, phone, role, status
            FROM contacts
           WHERE LOWER(email) = ? AND deleted_at IS NULL
           LIMIT 1`,
    args: [cleanEmail],
  });
}
