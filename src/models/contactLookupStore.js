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

/**
 * Up to `limit` live contacts whose NAME or EMAIL contains `term`.
 *
 * `term` is lower-cased and stripped of LIKE wildcards by the caller, so this
 * stays a plain statement with no decisions in it. Address matches come first
 * (a picker is usually fed the start of an address), then people by name.
 * `limit` is a server-side integer, never caller input, and is interpolated
 * because a bound LIMIT is not portable.
 */
export function selectContactsByTerm(term, limit = 8) {
  const take = Math.min(Math.max(Number(limit) || 8, 1), 25);
  return db.execute({
    sql: `SELECT cid, name, email, role, status
            FROM contacts
           WHERE deleted_at IS NULL
             AND (LOWER(email) LIKE ? OR LOWER(name) LIKE ?)
           ORDER BY (LOWER(email) LIKE ?) DESC, name ASC
           LIMIT ${take}`,
    args: [`${term}%`, `%${term}%`, `${term}%`],
  });
}
