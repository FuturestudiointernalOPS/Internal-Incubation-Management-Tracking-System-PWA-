import db from "@/lib/db";

/**
 * Segments store — the saved-segment reads/writes and the campaign/status
 * filter query (retired endpoints, kept for re-enable).
 *
 * Split out of `src/models/groups.js` (see docs/MVC_REFACTOR.md). SQL is
 * byte-identical to the statements that used to live there, so behavior is
 * unchanged; the barrel `@/models/groups` re-exports every name.
 *
 * Model-layer rules:
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 */

// ── GET / POST /api/segments (retired — kept for re-enable) ──────────────────

/** All saved segments, newest first (retired GET /api/segments). */
export async function listSegments() {
  return db.execute(
    "SELECT * FROM segments ORDER BY created_at DESC",
  );
}

/** Save a segment definition, returning the new id (retired POST /api/segments). */
export async function createSegment(name, criteria) {
  return db.execute({
    sql: "INSERT INTO segments (name, criteria) VALUES (?, ?) RETURNING id",
    args: [name, criteria],
  });
}

// ── POST /api/segments/run (retired — kept for re-enable) ────────────────────

/** Contacts matching a segment's campaign/status filters (retired run endpoint). */
export async function querySegmentContacts(filters) {
  let sql = `SELECT c.* FROM contacts c`;
  let conditions = [];
  let args = [];

  if (filters.campaign_id || filters.status) {
    sql += ` JOIN campaign_contacts cc ON c.cid = cc.cid`;
    if (filters.campaign_id) {
      conditions.push(`cc.campaign_id = ?`);
      args.push(filters.campaign_id);
    }
    if (filters.status) {
      if (filters.status === "NOT_RESPONDED") {
        conditions.push(`cc.status IN ('sent', 'pending')`);
      } else {
        conditions.push(`cc.status = ?`);
        args.push(filters.status.toLowerCase());
      }
    }
  }
  if (conditions.length > 0) sql += ` WHERE ` + conditions.join(" AND ");
  sql += ` GROUP BY c.id`;

  return db.execute({ sql, args });
}
