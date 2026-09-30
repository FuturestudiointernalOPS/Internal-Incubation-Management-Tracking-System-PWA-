/**
 * VENTURE ARCHIVE — the milestone/task soft-delete engine.
 *
 * Archive is a SOFT delete: rows keep their history and can be restored. A
 * milestone or task that already has FILED work (task submissions, task reviews
 * or milestone deliverables) can NEVER be archived/deleted — it is part of the
 * Venture's record. Archiving a milestone cascades to its tasks (same guard per
 * task).
 *
 * This service holds the DECISIONS (the filed-work guard, the cascade, the
 * per-row archived/restored/blocked classification); every statement lives in
 * `@/models/ventureArchiveStore`. Nothing here runs SQL.
 *
 * Re-exported unchanged through the compatibility facade `@/lib/ventureArchive`
 * — see docs/LAYER_SPLIT.md. Column additions (is_archived, archived_at,
 * archived_by) live in ensureVentureSchema (ventures.js).
 */

import {
  selectTaskSubmissionProbe,
  selectTaskReviewProbe,
  selectMilestoneDeliverableProbe,
  selectMilestoneSubmissionProbe,
  selectMilestoneReviewProbe,
  archiveTaskRow,
  restoreTaskRow,
  archiveMilestoneRow,
  restoreMilestoneRow,
  restoreMilestoneTasks,
  selectActiveTaskIdsForMilestone,
} from "@/models/ventureArchiveStore";

function rowsOf(result) {
  return (result && result.rows) || [];
}

/** True when a task has any filed work (submissions or staff reviews). */
export async function taskHasFiledWork(taskId) {
  if (taskId == null) return false;
  try {
    const result = await selectTaskSubmissionProbe(taskId).catch(() => ({ rows: [] }));
    if (rowsOf(result).length > 0) return true;
    const reviewResult = await selectTaskReviewProbe(taskId).catch(() => ({ rows: [] }));
    return rowsOf(reviewResult).length > 0;
  } catch (_) {
    // Fail safe on the conservative side: treat as filed.
    return true;
  }
}

/** True when a milestone has filed work (deliverables or task submissions/reviews). */
export async function milestoneHasFiledWork(milestoneId) {
  if (milestoneId == null) return false;
  try {
    const deliverableResult = await selectMilestoneDeliverableProbe(milestoneId).catch(() => ({ rows: [] }));
    if (rowsOf(deliverableResult).length > 0) return true;
    const submissionResult = await selectMilestoneSubmissionProbe(milestoneId).catch(() => ({ rows: [] }));
    if (rowsOf(submissionResult).length > 0) return true;
    const reviewResult = await selectMilestoneReviewProbe(milestoneId).catch(() => ({ rows: [] }));
    return rowsOf(reviewResult).length > 0;
  } catch (_) {
    return true; // conservative
  }
}

/** Mark one task archived (soft delete). Returns { archived } or { error }. */
export async function archiveTask({ taskId, actorCid = null }) {
  if (taskId == null) return { error: "Task ID required." };
  if (await taskHasFiledWork(taskId)) {
    return { error: "This task already has submitted work — it cannot be deleted. Archive is only available before work is filed." };
  }
  await archiveTaskRow(actorCid, taskId);
  return { archived: true };
}

/** Restore one archived task. */
export async function restoreTask({ taskId }) {
  if (taskId == null) return { error: "Task ID required." };
  await restoreTaskRow(taskId);
  return { restored: true };
}

/** Archive a milestone + every task bound to it (same filed-work guard). */
export async function archiveMilestone({ milestoneId, actorCid = null }) {
  if (milestoneId == null) return { error: "Milestone ID required." };
  if (await milestoneHasFiledWork(milestoneId)) {
    return { error: "This milestone already has submitted work — it cannot be deleted. Archive is only available before work is filed." };
  }
  // Cascade: archive the milestone and its (still clean) tasks.
  await archiveMilestoneRow(actorCid, milestoneId);
  const tasks = await selectActiveTaskIdsForMilestone(milestoneId).catch(() => ({ rows: [] }));
  for (const task of rowsOf(tasks)) {
    await archiveTask({ taskId: task.id, actorCid }).catch(() => {});
  }
  return { archived: true };
}

/** Restore a milestone + its archived tasks. */
export async function restoreMilestone({ milestoneId }) {
  if (milestoneId == null) return { error: "Milestone ID required." };
  await restoreMilestoneRow(milestoneId);
  await restoreMilestoneTasks(milestoneId).catch(() => {});
  return { restored: true };
}

/**
 * Bulk archive/restore helper used by the admin endpoints. Returns a summary
 * so the UI can report exactly what happened and what was blocked.
 *
 * @param rows [{ id, title, kind }] target rows
 */
export async function applyBulk({ rows, actorCid = null, action = "archive", kind = "milestone" }) {
  const archived = [];
  const restored = [];
  const blocked = [];
  for (const row of rows || []) {
    try {
      const outcome =
        kind === "milestone"
          ? action === "restore"
            ? await restoreMilestone({ milestoneId: row.id })
            : await archiveMilestone({ milestoneId: row.id, actorCid })
          : action === "restore"
            ? await restoreTask({ taskId: row.id })
            : await archiveTask({ taskId: row.id, actorCid });
      if (outcome?.error) blocked.push({ id: row.id, title: row.title || row.id, reason: outcome.error });
      else if (outcome?.restored) restored.push(row);
      else if (outcome?.archived) archived.push(row);
    } catch (_) {
      blocked.push({ id: row.id, title: row.title || row.id, reason: "Could not process this item." });
    }
  }
  return { archived, restored, blocked };
}
