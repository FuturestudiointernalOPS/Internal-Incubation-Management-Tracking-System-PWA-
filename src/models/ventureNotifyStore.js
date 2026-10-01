/**
 * Venture notifications + email — statements (REPOSITORY layer).
 *
 * The data access behind `@/services/ventures/notify`: the Venture-code lookup,
 * the founder recipients, one contact by id, and the Venture's active Lead
 * Managers. The audience shaping, the delivery loops and the email rendering
 * live in the service.
 *
 * SQL is byte-identical to what used to sit inline in `src/lib/ventureNotify.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";

/** The VNT code of a Venture from its internal id. */
export function selectNotifyVentureCode(dbId) {
  return db.execute({ sql: "SELECT venture_id FROM ventures WHERE id = ?", args: [dbId] });
}

/** The Venture's founder recipients (contact id, email, name). */
export function selectFounderRecipients(code) {
  return db.execute({
    sql: `SELECT DISTINCT c.cid, c.email, c.name
            FROM venture_members vm
            JOIN contacts c ON (c.cid = vm.contact_id OR c.cid = vm.user_cid)
            WHERE vm.venture_id = ? AND vm.member_type = 'founder'
              AND vm.removed_at IS NULL AND c.email IS NOT NULL`,
    args: [code],
  });
}

/** One live contact by id (id, name, email). */
export function selectNotifyContact(cid) {
  return db.execute({
    sql: "SELECT cid, name, email FROM contacts WHERE cid = ? AND (deleted = 0 OR deleted IS NULL) LIMIT 1",
    args: [String(cid)],
  });
}

/** The Venture's active Lead Manager contact ids. */
export function selectLeadManagerContactIds(code) {
  return db.execute({
    sql: `SELECT staff_contact_id FROM venture_staff_assignments
            WHERE venture_id = ? AND responsibility_code = 'lead_manager' AND status = 'active'`,
    args: [code],
  });
}
