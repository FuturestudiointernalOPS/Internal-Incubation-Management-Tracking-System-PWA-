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
 *
 * This model holds the two SQL reads only. The pure aggregation it used to
 * carry (`summarizeVentureStrictAudit`) is a decision and now lives in
 * `src/services/authorization/ventureStrictAudit.js` — models hold data access,
 * not decisions (see docs/LAYER_SPLIT.md).
 */

import db from "@/lib/db";

/** Every (person, venture) relationship the scope policy considers. */
export async function listVentureRelationships() {
  const result = await db.execute({
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
  return result.rows.filter((row) => row.cid && row.venture_id);
}

/** Contact rows for the given cids (name/role/email for the report). */
export async function listAuditContacts(cids) {
  const ids = [...new Set((cids || []).map((cid) => String(cid)).filter(Boolean))];
  if (ids.length === 0) return [];
  const result = await db.execute({
    sql: `SELECT cid, name, email, role FROM contacts
          WHERE cid IN (${ids.map(() => "?").join(",")})`,
    args: ids,
  });
  return result.rows;
}
