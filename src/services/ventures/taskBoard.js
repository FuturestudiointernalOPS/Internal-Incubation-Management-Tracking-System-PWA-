/**
 * services/ventures/taskBoard — the decisions of the Venture task board.
 *
 * Moved verbatim out of `src/app/api/ventures/[id]/tasks/route.js` (lane L2):
 * how the board is built (columns + dependency edges), when a task may move
 * into progress or be completed, and what follows a status change (blocked
 * tasks released, the milestone synced with its work). The controller keeps
 * the scoped access gate, object-level ownership, request validation, the
 * writes and every response. A refusal is answered as `{ error, status, ... }`
 * with the exact former message, status and extra fields.
 *
 * Same facades as the controller used, so route-level test mocks still apply.
 * No SQL, no HTTP.
 */
import { getUnmetTaskDependencies, syncTaskBlockState, releaseTasksBlockedBy } from "@/services/ventures/tasks";
import {
  TASK_BOARD_COLUMNS,
  TASK_REVIEW_GATED_COMPLETION_STATUSES,
  isTaskComplete,
  TASK_COMPLETED_STATUSES,
} from "@/lib/ventureStatuses";
import { isStaffActorForVenture } from "@/lib/ventureAuth";
import { canManageMilestones, syncMilestoneFromWork } from "@/services/ventures/milestoneEngine";
import { hasApprovedTaskSubmission } from "@/models/ventureWorkspace";

/**
 * A task may not move INTO one of these while a dependency it declares is
 * unmet. `backlog`/`todo`/`blocked`/`cancelled` are not progress, so they are
 * always allowed (a task can be parked, and it can be marked blocked by hand).
 */
export const TASK_PROCEED_STATUSES = ["in_progress", "review", ...TASK_COMPLETED_STATUSES];

/**
 * After a task's STATUS changes, the milestone it sits under follows — through
 * the same sync the deliverable route runs, so the work and the evidence can
 * never give a milestone two different answers.
 *
 * Only a status change calls this: renaming a task, moving its dates or
 * reassigning it is not progress. Completion authority is resolved once, here,
 * because it is the authority — not the tasks — that decides whether finished
 * work may close a milestone.
 */
export async function syncMilestoneForTask(task, { id, dbId, session }) {
  if (!task?.milestone_id) return { changed: false, status: null };
  const canComplete = await canManageMilestones({ id, cid: session?.cid, role: session?.role });
  return syncMilestoneFromWork({
    dbId,
    milestoneId: String(task.milestone_id),
    cid: session?.cid || null,
    canComplete,
  });
}

/**
 * The Kanban board: archived tasks hidden unless asked for, the columns from
 * lib/ventureStatuses, and each task decorated with its dependency edges
 * (blocked_by_ids, blocks_ids, dependency_blocked, blocked_by_titles).
 *
 * @param {Array} tasks the venture's tasks
 * @param {Array} edges the dependency edges ({ source_id, target_id })
 * @param {boolean} includeArchived
 * @returns {{ tasks: Array, byStatus: object }}
 */
export function buildTaskBoard(tasks, edges, includeArchived) {
  // Archived (soft-deleted) tasks stay in the database (history is kept) but
  // are hidden from default lists. Row-level filter: environments whose
  // schema predates the is_archived column keep working (field is undefined).
  const visibleTasks = tasks.filter((task) => includeArchived || task.is_archived !== true);

  // Group by status for Kanban (column vocabulary from lib/ventureStatuses)
  const byStatus = {};
  for (const status of TASK_BOARD_COLUMNS) {
    byStatus[status] = [];
  }

  // Dependency edges, applied in one pass: each task carries the ids it is
  // blocked by, the ids it blocks, and whether a declared dependency is still
  // unmet. One read for the whole board, never one per task.
  const statusById = new Map(visibleTasks.map((task) => [String(task.id), task.status]));
  const titleById = new Map(visibleTasks.map((task) => [String(task.id), task.title]));
  const blockedBy = new Map();
  const blocks = new Map();
  const push = (map, key, value) => {
    const list = map.get(key) || [];
    list.push(value);
    map.set(key, list);
  };
  for (const edge of edges) {
    push(blockedBy, edge.target_id, edge.source_id);
    push(blocks, edge.source_id, edge.target_id);
  }

  const decorated = visibleTasks.map((task) => {
    const blockedByIds = blockedBy.get(String(task.id)) || [];
    const unmetIds = blockedByIds.filter((id) => {
      const status = statusById.get(id);
      return status === undefined ? true : !isTaskComplete(status);
    });
    const decoratedTask = {
      ...task,
      blocked_by_ids: blockedByIds,
      blocks_ids: blocks.get(String(task.id)) || [],
      dependency_blocked: unmetIds.length > 0,
      blocked_by_titles: unmetIds.map((id) => titleById.get(id)).filter(Boolean),
    };
    if (byStatus[decoratedTask.status]) byStatus[decoratedTask.status].push(decoratedTask);
    return decoratedTask;
  });

  return { tasks: decorated, byStatus };
}

/**
 * The gates a status change must pass, in the former order:
 *  1. HARD dependency gate: a Venture-side actor may not move a task into real
 *     progress while a dependency it declares is unmet. Future Studio staff
 *     plan ahead and are exempt (the same rule as booking a session against a
 *     milestone), so the block bites where it should: on the Venture's own work.
 *  2. Completion authority (D5): a review_required task cannot be completed
 *     without an approved submission; only the review flow marks it complete.
 *
 * @returns {Promise<null | { error: string, status: number, blocked_by?: string[] }>}
 */
export async function checkTaskStatusChange({ id, dbId, session, existingTask, taskId, numericTaskId, status }) {
  if (status !== undefined && TASK_PROCEED_STATUSES.includes(status)) {
    const staffActor = await isStaffActorForVenture(id, session);
    if (!staffActor) {
      const blockers = await getUnmetTaskDependencies({ ventureId: dbId, taskId: numericTaskId });
      if (blockers.length > 0) {
        const names = blockers.map((blocker) => `"${blocker.title || blocker.id}"`).join(", ");
        return {
          error: `This task is blocked by ${names}, which is not completed yet.`,
          blocked_by: blockers.map((blocker) => blocker.title || blocker.id),
          status: 409,
        };
      }
    }
  }

  if (status && TASK_REVIEW_GATED_COMPLETION_STATUSES.includes(status) && existingTask.review_required) {
    const submissionResult = await hasApprovedTaskSubmission(parseInt(taskId)).catch(() => ({ rows: [] }));
    if (!(submissionResult.rows || []).length) {
      return { error: "This task requires an approved submission before it can be completed.", status: 403 };
    }
  }
  return null;
}

/**
 * What follows a task update: a completed task frees the tasks it was holding
 * back, the task's own `blocked` state follows the dependencies just set, and
 * the milestone follows a STATUS change — and nothing else (the "execution
 * half" of the milestone; closing it stays with the completion authority).
 *
 * @returns {Promise<object|null>} the milestone sync result, or null
 */
export async function afterTaskUpdate({ id, dbId, session, existingTask, numericTaskId, body }) {
  // A completed task frees the tasks it was holding back, right away.
  if (body.status !== undefined && isTaskComplete(body.status)) {
    await releaseTasksBlockedBy({ ventureId: dbId, blockerTaskId: numericTaskId });
  }
  // Keep this task's own `blocked` state true to the dependencies just set.
  if (body.blocked_by !== undefined) {
    await syncTaskBlockState({ ventureId: dbId, taskId: numericTaskId });
  }

  let milestone = null;
  if (body.status !== undefined) {
    milestone = await syncMilestoneForTask(existingTask, { id, dbId, session });
  }
  return milestone;
}
