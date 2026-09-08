/**
 * Venture milestone/task ARCHIVE engine (soft delete).
 *
 * Rules:
 *   - Archive is a SOFT delete: rows keep their history and can be restored.
 *   - A milestone or task that already has FILED work (task submissions,
 *     task reviews or milestone deliverables) can NEVER be archived/deleted —
 *     it is part of the Venture's record.
 *   - Archiving a milestone cascades to its tasks (same guard per task).
 *
 * Column additions live in ensureVentureSchema (ventures.js): is_archived,
 * archived_at, archived_by on venture_milestones + venture_tasks.
 */

function rowsOf(result) {
  return (result && result.rows) || [];
}

/** True when a task has any filed work (submissions or staff reviews). */
export async function taskHasFiledWork(db, taskId) {
  if (taskId == null) return false;
  try {
    const r = await db.execute({
      sql: `SELECT 1 FROM venture_task_submissions WHERE task_id = ? LIMIT 1`,
      args: [String(taskId)],
    }).catch(() => ({ rows: [] }));
    if (rowsOf(r).length > 0) return true;
    const rev = await db.execute({
      sql: `SELECT 1 FROM venture_task_reviews WHERE task_id = ? LIMIT 1`,
      args: [String(taskId)],
    }).catch(() => ({ rows: [] }));
    return rowsOf(rev).length > 0;
  } catch (_) {
    // Fail safe on the conservative side: treat as filed.
    return true;
  }
}

/** True when a milestone has filed work (deliverables or task submissions/reviews). */
export async function milestoneHasFiledWork(db, milestoneId) {
  if (milestoneId == null) return false;
  try {
    const del = await db.execute({
      sql: "SELECT 1 FROM venture_deliverables WHERE milestone_id = ? LIMIT 1",
      args: [String(milestoneId)],
    }).catch(() => ({ rows: [] }));
    if (rowsOf(del).length > 0) return true;
    const sub = await db.execute({
      sql: `SELECT 1 FROM venture_task_submissions s
            JOIN venture_tasks t ON t.id = s.task_id
            WHERE t.milestone_id = ? LIMIT 1`,
      args: [String(milestoneId)],
    }).catch(() => ({ rows: [] }));
    if (rowsOf(sub).length > 0) return true;
    const rev = await db.execute({
      sql: `SELECT 1 FROM venture_task_reviews vr
            JOIN venture_tasks t ON t.id = vr.task_id
            WHERE t.milestone_id = ? LIMIT 1`,
      args: [String(milestoneId)],
    }).catch(() => ({ rows: [] }));
    return rowsOf(rev).length > 0;
  } catch (_) {
    return true; // conservative
  }
}

/** Mark one task archived (soft delete). Returns { archived } or { error }. */
export async function archiveTask(db, { taskId, actorCid = null }) {
  if (taskId == null) return { error: "Task ID required." };
  if (await taskHasFiledWork(db, taskId)) {
    return { error: "This task already has submitted work — it cannot be deleted. Archive is only available before work is filed." };
  }
  await db.execute({
    sql: "UPDATE venture_tasks SET is_archived = TRUE, archived_at = COALESCE(archived_at, NOW()), archived_by = COALESCE(archived_by, ?) WHERE id = ? AND (is_archived = FALSE OR is_archived IS NULL)",
    args: [actorCid, String(taskId)],
  });
  return { archived: true };
}

/** Restore one archived task. */
export async function restoreTask(db, { taskId }) {
  if (taskId == null) return { error: "Task ID required." };
  await db.execute({
    sql: "UPDATE venture_tasks SET is_archived = FALSE, archived_at = NULL, archived_by = NULL WHERE id = ?",
    args: [String(taskId)],
  });
  return { restored: true };
}

/** Archive a milestone + every task bound to it (same filed-work guard). */
export async function archiveMilestone(db, { milestoneId, actorCid = null }) {
  if (milestoneId == null) return { error: "Milestone ID required." };
  if (await milestoneHasFiledWork(db, milestoneId)) {
    return { error: "This milestone already has submitted work — it cannot be deleted. Archive is only available before work is filed." };
  }
  // Cascade: archive the milestone and its (still clean) tasks.
  await db.execute({
    sql: "UPDATE venture_milestones SET is_archived = TRUE, archived_at = COALESCE(archived_at, NOW()), archived_by = COALESCE(archived_by, ?) WHERE id = ? AND (is_archived = FALSE OR is_archived IS NULL)",
    args: [actorCid, String(milestoneId)],
  });
  const tasks = await db.execute({
    sql: "SELECT id FROM venture_tasks WHERE milestone_id = ? AND (is_archived = FALSE OR is_archived IS NULL)",
    args: [String(milestoneId)],
  }).catch(() => ({ rows: [] }));
  for (const t of rowsOf(tasks)) {
    await archiveTask(db, { taskId: t.id, actorCid }).catch(() => {});
  }
  return { archived: true };
}

/** Restore a milestone + its archived tasks. */
export async function restoreMilestone(db, { milestoneId }) {
  if (milestoneId == null) return { error: "Milestone ID required." };
  await db.execute({
    sql: "UPDATE venture_milestones SET is_archived = FALSE, archived_at = NULL, archived_by = NULL WHERE id = ?",
    args: [String(milestoneId)],
  });
  await db.execute({
    sql: "UPDATE venture_tasks SET is_archived = FALSE, archived_at = NULL, archived_by = NULL WHERE milestone_id = ?",
    args: [String(milestoneId)],
  }).catch(() => {});
  return { restored: true };
}

/**
 * Bulk archive/restore helper used by the admin endpoints. Returns a summary
 * so the UI can report exactly what happened and what was blocked.
 *
 * @param rows [{ id, title, kind }] target rows
 * @param fn   (row) => archive/restore result
 */
export async function applyBulk(db, { rows, actorCid = null, action = "archive", kind = "milestone" }) {
  const archived = [];
  const restored = [];
  const blocked = [];
  for (const row of rows || []) {
    try {
      const out =
        kind === "milestone"
          ? action === "restore"
            ? await restoreMilestone(db, { milestoneId: row.id })
            : await archiveMilestone(db, { milestoneId: row.id, actorCid })
          : action === "restore"
            ? await restoreTask(db, { taskId: row.id })
            : await archiveTask(db, { taskId: row.id, actorCid });
      if (out?.error) blocked.push({ id: row.id, title: row.title || row.id, reason: out.error });
      else if (out?.restored) restored.push(row);
      else if (out?.archived) archived.push(row);
    } catch (_) {
      blocked.push({ id: row.id, title: row.title || row.id, reason: "Could not process this item." });
    }
  }
  return { archived, restored, blocked };
}

export default {
  taskHasFiledWork,
  milestoneHasFiledWork,
  archiveTask,
  restoreTask,
  archiveMilestone,
  restoreMilestone,
  applyBulk,
};
