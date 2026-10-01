/**
 * Tasks — listing use cases (SERVICE layer).
 *
 * The read path behind GET /api/tasks: the scoping rules that decide which tasks
 * a caller may see, the single-task lookup with its access check, and the batch
 * enrichment (blockers, subtasks, resources, comment counts) that spares the
 * caller an N+1 storm.
 *
 * The CONTROLLER authenticates and shapes the HTTP answer; everything below is
 * the decision:
 *
 *   - a non-super-admin asking for another user's tasks is refused;
 *   - a non-portfolio caller may only see their own tasks (the user filter is
 *     forced to the session user, and a foreign assignee filter is refused);
 *   - a task looked up by id is still access-checked (owner / assignee /
 *     supervisor / super-admin), so the id path cannot be an IDOR;
 *   - the SQL scope is assembled in `@/models/tasks` (getTasksByFilters); this
 *     service only chooses which scope applies.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and orchestration, no SQL, no HTTP.
 * It reads and writes through `@/models/**`.
 */

import {
  getTaskRowById,
  getBlockersForTask,
  getSubtasksForTask,
  getTasksByFilters,
  getBlockersForTasks,
  getSubtasksForTasks,
  getResourcesForTasks,
  getCommentCountsForTasks,
} from "@/models/tasks";
import { seesWholePortfolio } from "@/services/authorization/listingScope";

/**
 * The tasks a caller may see, enriched unless `brief` is set.
 *
 * @returns {Promise<{status: number, error?: string, body?: Object}>}
 */
export async function listTasks({
  userId,
  assignedTo,
  projectId,
  status,
  weekNumber,
  year,
  id,
  sort,
  limit,
  brief,
  priority,
  role,
  sessionCid,
}) {
  // SECURITY: a non-super-admin explicitly requesting another user's tasks is
  // refused.
  if (role !== "super_admin" && userId && userId !== sessionCid) {
    return { status: 403, error: "You can only access your own tasks." };
  }

  // Non-staff-side roles (participants, …) may only view their own tasks: force
  // the user filter to the session user and reject foreign assignee filters.
  const notStaffSide = !seesWholePortfolio(role);
  const effectiveUserId = userId || (notStaffSide ? sessionCid : null);
  if (notStaffSide && assignedTo && String(assignedTo) !== String(sessionCid)) {
    return { status: 403, error: "You can only view your own tasks." };
  }

  // Single-task lookup by id — the id path must still be authorized.
  if (id) {
    const result = await getTaskRowById(parseInt(id));
    if (result.rows.length === 0) {
      return { status: 404, error: "Task not found" };
    }
    const task = result.rows[0];

    if (
      role !== "super_admin" &&
      String(task.user_id) !== String(sessionCid) &&
      String(task.assigned_to || "") !== String(sessionCid) &&
      String(task.supervisor_id || "") !== String(sessionCid)
    ) {
      return { status: 403, error: "You do not have access to this task." };
    }

    const blockersResult = await getBlockersForTask(parseInt(id));
    const subtasksResult = await getSubtasksForTask(parseInt(id));
    return {
      status: 200,
      body: {
        success: true,
        tasks: [
          {
            ...task,
            blockers: blockersResult.rows || [],
            subtasks: subtasksResult.rows || [],
          },
        ],
      },
    };
  }

  // SECURITY: for a non-SA caller, scope to owned / assigned / supervised tasks.
  // The SQL for each scope is assembled in getTasksByFilters; here we only pick
  // the scope.
  let scope;
  if (role !== "super_admin") {
    if (!userId && !assignedTo) {
      // No user/assignee filter given: scope to the session user.
      scope = "self";
    } else if (effectiveUserId) {
      // An explicit user_id filter (pre-authorized above): scope to that user.
      scope = "user";
    } else if (assignedTo) {
      // A non-SA requesting by assigned_to: only their own assignments.
      if (assignedTo !== sessionCid) {
        return {
          status: 403,
          error: "You can only view tasks assigned to yourself.",
        };
      }
      scope = "assigned";
    }
  }

  const result = await getTasksByFilters({
    isSuperAdmin: role === "super_admin",
    scope,
    sessionCid,
    effectiveUserId,
    assignedTo,
    projectId,
    status,
    priority,
    week: weekNumber,
    year,
    sort,
    limit,
  });

  // For brief fetches (tasks tab), skip blockers/subtasks to avoid an N+1 hit.
  if (brief) {
    return { status: 200, body: { success: true, tasks: result.rows } };
  }

  // Batch fetch blockers for all tasks (one query instead of N+1).
  const taskIds = result.rows.map((task) => task.id);
  const blockersByTask = {};
  const subtasksByTask = {};
  const resourcesByTask = {};
  const commentCountByTask = {};
  const allTaskIds = [...taskIds];

  if (taskIds.length > 0) {
    const blockersResult = await getBlockersForTasks(taskIds);
    for (const blocker of blockersResult.rows || []) {
      const taskId = blocker.task_id;
      if (!blockersByTask[taskId]) blockersByTask[taskId] = [];
      blockersByTask[taskId].push({
        id: blocker.id,
        title: blocker.title,
        status: blocker.status,
        severity: blocker.severity,
        description: blocker.description,
        reference_url: blocker.reference_url,
        notes: blocker.notes,
      });
    }

    // Subtasks — full field set (Ticket 1.3). The column may not exist yet.
    try {
      const subtasksResult = await getSubtasksForTasks(taskIds);
      for (const subtask of subtasksResult.rows || []) {
        const parentTaskId = subtask.parent_task_id;
        if (!subtasksByTask[parentTaskId]) subtasksByTask[parentTaskId] = [];
        subtasksByTask[parentTaskId].push(subtask);
        allTaskIds.push(subtask.id);
      }
    } catch {
      // parent_task_id column may not exist yet
    }

    // Resources for tasks + subtasks (the table may not exist yet).
    try {
      const resourcesResult = await getResourcesForTasks(allTaskIds);
      for (const resource of resourcesResult.rows || []) {
        const taskId = resource.task_id;
        if (!resourcesByTask[taskId]) resourcesByTask[taskId] = [];
        resourcesByTask[taskId].push({
          id: resource.id,
          name: resource.name,
          url: resource.url,
          type: resource.type,
          file_name: resource.file_name,
          file_size: resource.file_size,
          uploaded_by: resource.uploaded_by,
        });
      }
    } catch {
      // task_resources table may not exist yet in some environments
    }

    // Comment counts (tasks + subtasks) — the thread is fetched on demand.
    try {
      const commentCountsResult = await getCommentCountsForTasks(allTaskIds);
      for (const commentRow of commentCountsResult.rows || []) {
        commentCountByTask[commentRow.task_id] = parseInt(commentRow.cnt) || 0;
      }
    } catch {
      // v2_task_comments table may not exist yet in some environments
    }
  }

  // Attach resources/comment counts onto subtasks now that we have them.
  for (const parentTaskId of Object.keys(subtasksByTask)) {
    subtasksByTask[parentTaskId] = subtasksByTask[parentTaskId].map((subtask) => ({
      ...subtask,
      resources: resourcesByTask[subtask.id] || [],
      commentCount: commentCountByTask[subtask.id] || 0,
    }));
  }

  const tasksWithBlockers = result.rows.map((task) => ({
    ...task,
    blockers: blockersByTask[task.id] || [],
    subtasks: subtasksByTask[task.id] || [],
    resources: resourcesByTask[task.id] || [],
    commentCount: commentCountByTask[task.id] || 0,
  }));

  return { status: 200, body: { success: true, tasks: tasksWithBlockers } };
}
