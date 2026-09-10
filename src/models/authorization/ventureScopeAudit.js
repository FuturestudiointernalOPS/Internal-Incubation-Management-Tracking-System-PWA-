/**
 * ImpactOS — Venture scope audit (read-only).
 *
 * Answers the question the migration needs: "with the old gate gone, WHO would
 * lose access, and which key are they missing?" It reads real assignment data
 * (who is attached to which venture) and, for each person, reports whether the
 * canonical gate would admit them — capability AND scope — without ever
 * changing anything.
 *
 * Used by GET /api/engineering/permissions/venture-strict-audit.
 */

import db from "@/lib/db";

/** Every (person, venture) relationship the scope policy considers. */
export async function listVentureRelationships() {
  const r = await db.execute({
    sql: `SELECT DISTINCT CAST(venture_id AS TEXT) AS venture_id,
                 COALESCE(NULLIF(contact_id, ''), user_cid) AS cid
          FROM venture_members
          WHERE removed_at IS NULL
            AND (contact_id IS NOT NULL OR user_cid IS NOT NULL)
          UNION
          SELECT DISTINCT CAST(venture_id AS TEXT) AS venture_id,
                 staff_contact_id AS cid
          FROM venture_staff_assignments
          WHERE status = 'active' AND staff_contact_id IS NOT NULL`,
    args: [],
  });
  return r.rows.filter((row) => row.cid && row.venture_id);
}

/** Contact rows for the given cids (name/role/email for the report). */
export async function listAuditContacts(cids) {
  const ids = [...new Set((cids || []).map((c) => String(c)).filter(Boolean))];
  if (ids.length === 0) return [];
  const r = await db.execute({
    sql: `SELECT cid, name, email, role FROM contacts
          WHERE cid IN (${ids.map(() => "?").join(",")})`,
    args: ids,
  });
  return r.rows;
}

/**
 * Pure aggregation of the audit rows (unit-tested).
 *
 * @param {Array<{cid, name?, role?, ventures: Array<string>,
 *                viewAllowed: boolean, editAllowed: boolean,
 *                scopeCount: number}>} people
 */
export function summarizeVentureStrictAudit(people = []) {
  const rows = (people || []).map((p) => ({
    cid: p.cid,
    name: p.name || null,
    role: p.role || null,
    ventures: (p.ventures || []).length,
    scopeCount: Number(p.scopeCount || 0),
    viewAllowed: Boolean(p.viewAllowed),
    editAllowed: Boolean(p.editAllowed),
    // A person attached to ventures who cannot read them is the signal that a
    // grant (or an assignment) is missing.
    missing: !p.viewAllowed
      ? ["ventures.view"]
      : !p.editAllowed
        ? ["ventures.edit"]
        : [],
  }));
  const viewMissing = rows.filter((r) => !r.viewAllowed);
  const editMissing = rows.filter((r) => r.viewAllowed && !r.editAllowed);
  return {
    total: rows.length,
    viewAllowed: rows.length - viewMissing.length,
    viewMissing,
    editMissing,
    rows,
  };
}
