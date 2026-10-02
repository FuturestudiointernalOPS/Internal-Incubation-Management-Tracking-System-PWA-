/**
 * VENTURE TASKS, DEPENDENCIES, COMMENTS AND ATTACHMENTS.
 *
 * The Kanban task layer of a Venture: the task list and row, the create /
 * update / delete, the task-to-task dependency graph (with the cycle guard and
 * the block-state sync), and the comments and attachments.
 *
 * The decisions — which task columns a write may touch and how each is
 * normalized, whether a dependency set would close a loop, and how a task's
 * `blocked` state follows its edges — live here; every statement is in
 * `@/models/ventureTasksStore`. Nothing here runs SQL.
 *
 * This module used to be re-exported through `@/lib/ventures`; that barrel is
 * gone (CH-4) and importers read this module directly. See docs/LAYER_SPLIT.md.
 */

import {
  runInTransaction,
  selectTasks,
  selectTaskById,
  selectTaskStatusById,
  selectNextTaskDisplayOrder,
  insertTask,
  updateTaskColumns,
  deleteTaskRow,
  selectVentureDependencies,
  selectVentureTaskEdges,
  selectUnmetTaskDependencies,
  countTaskBlockersRows,
  selectTasksBlockedByRows,
  deleteTaskDependencyEdges,
  insertTaskDependencyEdge,
  releaseBlockedTaskRow,
  selectTaskComments,
  insertTaskComment,
  softDeleteTaskComment,
  selectTaskAttachments,
  insertTaskAttachment,
  deleteTaskAttachmentRow,
} from "@/models/ventureTasksStore";
import { dateOrNull, textOrNull, cidOrNull } from "@/lib/ventureInput";
import { isTaskComplete, TASK_COMPLETED_STATUSES } from "@/lib/ventureStatuses";

export async function listTasks(ventureId, milestoneId, status, assignedCid) {
  const res = await selectTasks(ventureId, milestoneId, status, assignedCid);
  return (res.rows || []).map((task) => ({
    ...task,
    labels: typeof task.labels === "string" ? JSON.parse(task.labels) : (task.labels || []),
    checklist: typeof task.checklist === "string" ? JSON.parse(task.checklist) : (task.checklist || []),
  }));
}

export async function getTask(taskId) {
  const res = await selectTaskById(taskId);
  if (res.rows.length === 0) return null;
  const task = res.rows[0];
  task.labels = typeof task.labels === "string" ? JSON.parse(task.labels) : (task.labels || []);
  task.checklist = typeof task.checklist === "string" ? JSON.parse(task.checklist) : (task.checklist || []);
  return task;
}

export async function createTask({ ventureId, milestoneId, title, description, priority, startDate, dueDate, estimatedHours, assignedCid, assignedName, reporterCid, reporterName, labels, displayOrder, parentTaskId }) {
  if (!displayOrder) {
    const orderResult = await selectNextTaskDisplayOrder(ventureId);
    displayOrder = orderResult.rows[0]?.n || 1;
  }
  const res = await insertTask({
    ventureId,
    milestoneId: milestoneId || null,
    title: title.trim(),
    description: description?.trim() || null,
    priority: priority || "medium",
    startDate: dateOrNull(startDate) ?? null,
    dueDate: dateOrNull(dueDate) ?? null,
    estimatedHours: estimatedHours || null,
    assignedCid: cidOrNull(assignedCid),
    assignedName: textOrNull(assignedName),
    reporterCid: reporterCid || null,
    reporterName: reporterName || null,
    labelsJson: JSON.stringify(labels || []),
    displayOrder,
    parentTaskId: parentTaskId || null,
  });
  return { id: res.rows[0]?.id || res.lastInsertRowid };
}

/**
 * Task updates, with the two normalizations every form depends on:
 *
 *  - dates: a cleared date field arrives as "", which Postgres rejects outright.
 *  - person halves: `assigned_cid` holds an IDENTITY and `assigned_name` a name.
 *    An empty string in the identity slot is not an identity, so it becomes NULL,
 *    and the write paths agree on what "cleared" means.
 */
export async function updateTask(taskId, updates) {
  const allowed = ["title", "description", "status", "priority", "start_date", "due_date", "estimated_hours", "actual_hours", "assigned_cid", "assigned_name", "labels", "checklist", "display_order"];
  const DATE_COLUMNS = ["start_date", "due_date"];
  const sets = []; const args = [];
  for (const column of allowed) {
    if (updates[column] === undefined) continue;
    if (column === "labels" || column === "checklist") { sets.push(`${column} = ?::jsonb`); args.push(JSON.stringify(updates[column])); }
    else if (DATE_COLUMNS.includes(column)) { sets.push(`${column} = ?`); args.push(dateOrNull(updates[column])); }
    else if (column === "assigned_cid") { sets.push(`${column} = ?`); args.push(cidOrNull(updates[column])); }
    else if (column === "assigned_name") { sets.push(`${column} = ?`); args.push(textOrNull(updates[column])); }
    else { sets.push(`${column} = ?`); args.push(updates[column]); }
  }
  if (sets.length === 0) return { updated: false };
  sets.push("updated_at = NOW()");
  args.push(taskId);
  await updateTaskColumns(sets, args);
  return { updated: true };
}

export async function deleteTask(taskId) {
  await deleteTaskRow(taskId);
  return { success: true };
}

// ─── Task-to-task dependencies ────────────────────────────────────────────
// One edge (source -> target) means the SOURCE task blocks the TARGET: the
// target cannot start or be finished until the source is done. These helpers
// read and write those edges — and keep a task's `blocked` state true to them,
// so an explicit dependency is the ONLY thing that holds a task back.

/** The completed-statuses SQL list, from the ONE vocabulary. */
const TASK_DONE_SQL_LIST = TASK_COMPLETED_STATUSES.map((status) => `'${status}'`).join(", ");

/** A source→targets adjacency of the edges, optionally skipping some rows. */
function buildBlocksMap(rows, shouldIgnore = () => false) {
  const blocks = new Map();
  for (const row of rows || []) {
    if (shouldIgnore(row)) continue;
    const from = `${row.source_type}:${row.source_id}`;
    const list = blocks.get(from) || [];
    list.push(`${row.target_type}:${row.target_id}`);
    blocks.set(from, list);
  }
  return blocks;
}

/** Whether `toKey` is reachable from `fromKey` along the edges (cycle probe). */
function canReach(blocks, fromKey, toKey) {
  const seen = new Set([fromKey]);
  const queue = [fromKey];
  while (queue.length > 0) {
    const node = queue.shift();
    if (node === toKey) return true;
    for (const next of blocks.get(node) || []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return false;
}

/** Every task→task edge of a Venture, as text ids [{ source_id, target_id }]. */
export async function listVentureTaskDependencyEdges(ventureId) {
  const res = await selectVentureTaskEdges(ventureId).catch(() => ({ rows: [] }));
  return (res.rows || []).map((row) => ({ source_id: String(row.source_id), target_id: String(row.target_id) }));
}

/**
 * The blocker tasks of a task that are NOT done yet — empty means nothing
 * holds it back. Ids are compared as text (edges store them that way).
 */
export async function getUnmetTaskDependencies({ ventureId, taskId }) {
  const res = await selectUnmetTaskDependencies(ventureId, taskId, TASK_DONE_SQL_LIST).catch(() => ({ rows: [] }));
  return res.rows || [];
}

/** How many tasks declare this task as their blocker (its inbound edges). */
export async function countTaskBlockers({ ventureId, taskId }) {
  const res = await countTaskBlockersRows(ventureId, taskId).catch(() => ({ rows: [] }));
  return Number(res.rows?.[0]?.n || 0);
}

/** The tasks this task blocks (its dependents) — used when it completes. */
export async function listTasksBlockedBy({ ventureId, blockerTaskId }) {
  const res = await selectTasksBlockedByRows(ventureId, blockerTaskId).catch(() => ({ rows: [] }));
  return (res.rows || []).map((row) => String(row.target_id));
}

/**
 * Replace a task's blockers with EXACTLY `blockedByTaskIds`.
 *
 * Refused AS A WHOLE when the set would close a loop (including a transitive
 * one): nothing is written, so a task never ends up half-wired. The edge shape
 * and the "source blocks target" direction are the ones the milestone layer
 * already uses — one dependency writer, one meaning.
 */
export async function setTaskDependencies({ ventureId, taskId, blockedByTaskIds = [] }) {
  const targetId = String(taskId);
  const existing = await selectVentureDependencies(ventureId).catch(() => ({ rows: [] }));

  // The graph WITHOUT this task's current inbound task edges: they are being
  // replaced. (A milestone edge that targets this task is left in place.)
  const blocks = buildBlocksMap(existing.rows || [], (row) =>
    row.source_type === "task" && row.target_type === "task" && String(row.target_id) === targetId);
  const targetKey = `task:${targetId}`;
  const sources = [...new Set(
    (blockedByTaskIds || [])
      .map((value) => String(value).trim())
      .filter((value) => value && value !== targetId),
  )];

  for (const sourceId of sources) {
    if (canReach(blocks, targetKey, `task:${sourceId}`)) throw new Error("Circular dependency detected.");
  }

  await runInTransaction(async (query) => {
    await deleteTaskDependencyEdges(query, ventureId, targetId);
    for (const sourceId of sources) {
      await insertTaskDependencyEdge(query, ventureId, sourceId, targetId);
    }
  });
  return { success: true, count: sources.length };
}

/**
 * Keep a task's `blocked` state true to its dependencies:
 *   - an unmet blocker forces `blocked` (unless the task is finished/cancelled);
 *   - once every blocker is done, a task that was held by a dependency (it has
 *     inbound edges and reads `blocked`) returns to `todo`.
 * A task with no dependency at all is never touched here, so a manual `blocked`
 * stays the user's own choice.
 */
export async function syncTaskBlockState({ ventureId, taskId }) {
  const numericId = Number.parseInt(String(taskId), 10);
  if (!Number.isFinite(numericId)) return { status: null };
  const res = await selectTaskStatusById(numericId).catch(() => ({ rows: [] }));
  const task = res.rows?.[0];
  if (!task) return { status: null };
  if (isTaskComplete(task.status) || task.status === "cancelled" || task.status === "archived") return { status: task.status };

  const unmet = await getUnmetTaskDependencies({ ventureId, taskId: numericId });
  if (unmet.length > 0) {
    if (task.status !== "blocked") await updateTask(numericId, { status: "blocked" });
    return { status: "blocked", blockers: unmet };
  }
  const inbound = await countTaskBlockers({ ventureId, taskId: numericId });
  if (inbound > 0 && task.status === "blocked") {
    await updateTask(numericId, { status: "todo" });
    return { status: "todo" };
  }
  return { status: task.status };
}

/**
 * Release every task whose ONLY remaining blockers were this completed task:
 * a dependency-held task returns to `todo` the moment nothing holds it back.
 */
export async function releaseTasksBlockedBy({ ventureId, blockerTaskId }) {
  const dependents = await listTasksBlockedBy({ ventureId, blockerTaskId });
  const released = [];
  for (const targetId of dependents) {
    const numericTarget = Number.parseInt(targetId, 10);
    if (!Number.isFinite(numericTarget)) continue;
    const unmet = await getUnmetTaskDependencies({ ventureId, taskId: numericTarget });
    if (unmet.length > 0) continue;
    const res = await releaseBlockedTaskRow(numericTarget).catch(() => ({ rows: [] }));
    if ((res.rows || []).length > 0) released.push(numericTarget);
  }
  return { released };
}

// ─── Task Comments ────────────────────────────────────────────────────────

export async function listTaskComments(taskId) {
  const res = await selectTaskComments(taskId);
  return res.rows || [];
}

export async function addTaskComment({ taskId, parentId, authorCid, authorName, body }) {
  const res = await insertTaskComment(taskId, parentId || null, authorCid, authorName || "System", body.trim());
  return { id: res.rows[0]?.id || res.lastInsertRowid };
}

export async function deleteTaskComment(commentId, ventureId) {
  // Scoped through the venture's tasks: a comment id belonging to another
  // venture matches nothing, so a cross-venture delete is a no-op.
  await softDeleteTaskComment(commentId, ventureId);
  return { success: true };
}

// ─── Task Attachments ─────────────────────────────────────────────────────

export async function listTaskAttachments(taskId) {
  const res = await selectTaskAttachments(taskId);
  return res.rows || [];
}

export async function addTaskAttachment({ taskId, fileName, fileSize, fileType, fileUrl, uploadedBy }) {
  const res = await insertTaskAttachment(taskId, fileName, fileSize || null, fileType || null, fileUrl, uploadedBy || "system");
  return { id: res.rows[0]?.id || res.lastInsertRowid };
}

export async function deleteTaskAttachment(attachmentId, ventureId) {
  // Scoped through the venture's tasks (see deleteTaskComment).
  await deleteTaskAttachmentRow(attachmentId, ventureId);
  return { success: true };
}
