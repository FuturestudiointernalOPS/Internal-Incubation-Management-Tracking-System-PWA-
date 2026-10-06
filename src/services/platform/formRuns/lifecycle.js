/**
 * Platform — form runs: the run lifecycle (SERVICE layer).
 *
 * The status vocabulary and the transitions of a Run: the valid-status set, the
 * slug-before-launch rule and the launch automation, plus the audience
 * assignment actions (assign one or many targets, unassign one) and the
 * assignment display-name enrichment they return.
 *
 * Split of `services/platform/formRuns.js` (see docs/LAYER_SPLIT.md): this is the
 * `lifecycle` slice; the barrel at the original path re-exports the same
 * surface. The controller owns the `runs.edit` capability and the envelope.
 *
 * Layer: decisions and orchestration, no SQL, no HTTP. It reads and writes
 * through `@/models/**` and `@/lib/**`.
 */

import { onAssignmentAdded, onRunLaunched } from "@/models/platform/automation";
import {
  deleteAssignmentById,
  getAssignmentsAfterAssignByRunId,
  getAssignmentsAfterUnassignByRunId,
  getFullRunAfterAssignById,
  getRunIdByAssignmentId,
  getRunPublicSlugById,
  insertRunAssignmentForAction,
  launchRunById,
  updateRunPublicSlugById,
  updateRunStatusById,
} from "@/models/formRuns";
import { enrichAssignments } from "./detail";

// ── Run lifecycle: status, launch, assignments ───────────────────────────────

/** The only statuses a run may hold. The controller validates against this. */
export const RUN_STATUSES = ["draft", "scheduled", "active", "closed", "cancelled", "archived"];

export function isValidRunStatus(status) {
  return RUN_STATUSES.includes(status);
}

/** Move a run to a new lifecycle status. Returns the updated run row. */
export async function changeRunStatus(id, status) {
  const result = await updateRunStatusById(id, status);
  return result.rows[0];
}

/**
 * Launch (activate) a run. A run created before the share-link feature has no
 * public slug, so make sure one exists first, then activate and fire the
 * launch automation. Returns the updated run row.
 */
export async function launchRun({ id, session }) {
  const existing = await getRunPublicSlugById(id);
  let slug = existing.rows[0]?.public_slug;
  if (!slug) {
    slug = "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    await updateRunPublicSlugById(slug, id);
  }

  const result = await launchRunById(id, slug);
  onRunLaunched(result.rows[0], session);
  return result.rows[0];
}

/** The audiences a run may be assigned to. */
export const ASSIGNMENT_TARGET_TYPES = ["user", "group", "program", "cohort", "team", "organization", "all"];

/**
 * Assign a run to one or more audiences. Accepts either the legacy single
 * target (target_type + target_id) or a list of targets, so one action can
 * assign a run to multiple audiences (e.g. Program AND Group) in one request.
 *
 * Returns { ok: false, error } when no valid target survived the filter, or
 * { ok: true, added, skipped, assignments } with the run's assignments enriched
 * for the UI. The controller owns the `runs.edit` capability and the envelope.
 */
export async function assignRunTargets({ run_id, target_type, target_id, targets, session }) {
  const targetList = Array.isArray(targets)
    ? targets
    : [{ target_type: target_type || "user", target_id }];
  const valid = targetList.filter(
    (target) => target && ASSIGNMENT_TARGET_TYPES.includes(target.target_type) && target.target_id,
  );
  if (valid.length === 0) {
    return { ok: false, error: "run_id and target required" };
  }

  const runId = parseInt(run_id);
  let added = 0;
  let skipped = 0;
  const createdTargets = [];
  for (const target of valid) {
    const insertResult = await insertRunAssignmentForAction({
      runId,
      targetType: target.target_type,
      targetId: target.target_id,
      assignedBy: session.cid,
    });
    if (insertResult.rowsAffected > 0) {
      added++;
      createdTargets.push({ target_type: target.target_type, target_id: target.target_id });
    } else {
      skipped++;
    }
  }

  const assignments = await getAssignmentsAfterAssignByRunId(runId);
  // Fire automation for each newly created assignment.
  const fullRun = await getFullRunAfterAssignById(runId);
  for (const target of createdTargets) {
    onAssignmentAdded(target, fullRun.rows[0] || { id: runId });
  }
  return { ok: true, added, skipped, assignments: await enrichAssignments(assignments.rows) };
}

/**
 * Remove one assignment, then return the run's remaining assignments (enriched
 * for the UI). A missing assignment resolves to no run, which returns an empty
 * list rather than failing.
 */
export async function unassignRun({ assignment_id }) {
  const assignmentResult = await getRunIdByAssignmentId(assignment_id);
  const runId = assignmentResult.rows[0]?.run_id;

  await deleteAssignmentById(assignment_id);

  if (!runId) return { assignments: [] };
  const assignments = await getAssignmentsAfterUnassignByRunId(runId);
  return { assignments: await enrichAssignments(assignments.rows) };
}
