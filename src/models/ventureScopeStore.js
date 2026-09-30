/**
 * Venture assignment scope — statements (REPOSITORY layer).
 *
 * The data access behind `@/services/ventures/scope`: the Venture-code lookup,
 * the actor's active assignment scopes, the milestone → stage link and the
 * Venture's task scope contexts. The scope matching and the failure postures
 * (fail-closed on writes, allow-on-error on reads) live in the service.
 *
 * SQL is byte-identical to what used to sit inline in `src/lib/ventureScope.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";

/** The VNT code of a Venture from its internal UUID. */
export function selectVentureCodeById(ventureId) {
  return db.execute({
    sql: "SELECT venture_id FROM ventures WHERE id = ?",
    args: [ventureId],
  });
}

/** The actor's active assignment scopes on one Venture (code-keyed). */
export function selectAssignmentScopes(ventureCode, cid) {
  return db.execute({
    sql: `SELECT scope_type, scope_ref_type, scope_ref_id, responsibility_code
            FROM venture_staff_assignments
            WHERE venture_id = ? AND staff_contact_id = ? AND status = 'active'
            ORDER BY id ASC`,
    args: [ventureCode, cid],
  });
}

/** The Journey stage a milestone is bound to. */
export function selectJourneyStageIdForMilestone(milestoneId) {
  return db.execute({
    sql: "SELECT journey_stage_id FROM venture_milestones WHERE id::text = ?",
    args: [String(milestoneId)],
  });
}

/** Every task of a Venture with its milestone → stage linkage. */
export function selectTaskScopeContexts(ventureDbId) {
  return db.execute({
    sql: `SELECT t.id, t.milestone_id, m.journey_stage_id
            FROM venture_tasks t
            LEFT JOIN venture_milestones m ON m.id::text = t.milestone_id::text
            WHERE t.venture_id = ?`,
    args: [ventureDbId],
  });
}
