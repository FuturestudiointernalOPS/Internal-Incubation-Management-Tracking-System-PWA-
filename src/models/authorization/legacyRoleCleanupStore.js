/**
 * Authorization — legacy global-role cleanup (REPOSITORY layer).
 *
 * Phase H of docs/ROADMAP_ROLES_PROFILES_ACCESS.md. The global identity
 * (`contacts.role`) must only ever carry one of the three BASELINE values
 * (super_admin / staff / member); every other value — `participant`, `founder`,
 * `facilitator`, `investor`, `program_manager`, or a retired label — is a
 * CONTEXTUAL value that belongs in a relationship row and a profile card, never
 * on the person's account.
 *
 * This module is the data access behind the survey and the alignment: the read
 * that enumerates the role values actually in use, the read that lists the
 * accounts holding one of them, and the GUARDED write that rewrites a legacy
 * value to the baseline. No decision lives here — which values are legacy and
 * what the report means is `@/services/authorization/legacyRoleCleanup`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement,
 * no decisions.
 */

import db from "@/lib/db";

/**
 * Every distinct `contacts.role` value in use, with how many accounts hold it.
 * The survey's first read: the list is small (one row per distinct value), so it
 * is safe to run on a hot admin screen.
 */
export function listContactRoleCounts() {
  return db.execute(
    `SELECT role, COUNT(*)::int AS count
       FROM contacts
      GROUP BY role
      ORDER BY count DESC, role`,
  );
}

/** The accounts holding one exact role value (bounded sample for the screen). */
export function listContactsByRole(role, limit = 200) {
  return db.execute({
    sql: `SELECT cid, name, role, status
            FROM contacts
           WHERE role = ?
           ORDER BY name NULLS LAST, cid
           LIMIT ?`,
    args: [String(role), Number(limit)],
  });
}

/**
 * Rewrite one legacy role value to a baseline role, in a single statement.
 *
 * The `WHERE role = ?` predicate is the guard that makes this idempotent and
 * safe: a replay after the first pass matches no row (the value is gone), and a
 * baseline value can never be the source because the caller only passes a value
 * the survey classified as legacy. Nothing else on the contact row is touched —
 * in particular the relationships and profile cards that carry the context are
 * never deleted.
 */
export function alignContactsFromRoleToBaseline({ fromRole, toRole }) {
  return db.execute({
    sql: `UPDATE contacts SET role = ? WHERE role = ?`,
    args: [String(toRole), String(fromRole)],
  });
}
