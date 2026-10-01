/**
 * Milestone ordering inside a Journey stage — statements (REPOSITORY layer).
 *
 * The data access behind `@/services/ventures/milestoneOrder`: the ordered stage
 * read and the two writes of an up/down move. The decisions (normalise 1..n,
 * find the neighbour, refuse the edge) live in the service.
 *
 * SQL is byte-identical to what used to sit inline in
 * `src/lib/ventureMilestoneOrder.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";

// ── Transaction control ──────────────────────────────────────────────────────

/** Run a normalise-and-swap inside one transaction. */
export function runInTransaction(fn) {
  return db.transaction(fn);
}

// ── Reads ────────────────────────────────────────────────────────────────────

/** Stage milestones in display order (NULL orders fall back to creation time). */
export function selectStageMilestonesForOrder(dbId, stageId) {
  return db.execute({
    sql: `SELECT id, title, status, progress, target_date, display_order, created_at
          FROM venture_milestones
          WHERE venture_id = ? AND journey_stage_id = ?
          ORDER BY COALESCE(display_order, 0) ASC, created_at ASC`,
    args: [dbId, String(stageId)],
  });
}

/** The ordered id/display_order list (swap input, cursor form). */
export function selectStageMilestoneOrders(query, dbId, stageId) {
  return query(
    `SELECT id, display_order FROM venture_milestones
       WHERE venture_id = ? AND journey_stage_id = ?
       ORDER BY COALESCE(display_order, 0) ASC, created_at ASC`,
    [dbId, String(stageId)],
  );
}

// ── Write ────────────────────────────────────────────────────────────────────

/** Write one milestone's display_order (normalization pass and swap). */
export function setMilestoneDisplayOrder(query, displayOrder, milestoneId) {
  return query("UPDATE venture_milestones SET display_order = ? WHERE id = ?", [displayOrder, milestoneId]);
}
