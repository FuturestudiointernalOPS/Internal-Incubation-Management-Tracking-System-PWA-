/**
 * Admin projects — the Super Admin project list and detail reads (SERVICE
 * layer).
 *
 * The work behind `GET /api/admin/projects` and `GET /api/admin/projects/[id]`:
 * the batched task/blocker/timeline aggregation, the timeline-health and
 * completion rates, and the detail assembly (tasks with their blockers, subtasks
 * and resources, the team union and the timeline).
 *
 * HTTP-free: it reads through `@/models/projects` and answers `{ status, body }`.
 * The controller keeps `initDb`, the scope guard and the envelope.
 */

import {
  countDatedTasksByProjectIds,
  countDatedTasksForProject,
  getAdminBlockerStatsByProjectIds,
  getAdminProjectDetails,
  getAdminProjects,
  getAdminTaskStatsByProjectIds,
  getBlockersByTaskIds,
  getProjectBlockers,
  getProjectMembersUnion,
  getProjectTimeline,
  getResourcesByTaskIds,
  getSubtasksByParentTaskIds,
  getTaskStatsForProject,
  getTasksForProject,
} from "@/models/projects";

/** Every project with its aggregated task/blocker stats and totals. */
export async function listProjects({ includeArchived, programId }) {
  const projectsResult = await getAdminProjects(includeArchived, programId);
  const projects = projectsResult.rows;

  // Batched aggregation — 3 grouped queries over ALL project ids instead of
  // 3 queries PER project. Produces identical per-project numbers.
  const projectIds = projects.map((project) => String(project.id));

  const taskStatsResult =
    projectIds.length === 0
      ? { rows: [] }
      : await getAdminTaskStatsByProjectIds(projectIds);

  // Timeline-health dated count: kept in its OWN batched query (with its own
  // resilience) so a missing start_date/end_date column never affects the
  // task/blocker stats.
  if (projectIds.length > 0) {
    try {
      await countDatedTasksByProjectIds(projectIds);
    } catch (_) {}
  }

  const blockerStatsResult =
    projectIds.length === 0
      ? { rows: [] }
      : await getAdminBlockerStatsByProjectIds(projectIds);

  // Index by project id for O(1) lookups.
  const taskMap = new Map();
  for (const row of taskStatsResult.rows || []) taskMap.set(row.pid, row);
  const blockerMap = new Map();
  for (const row of blockerStatsResult.rows || []) blockerMap.set(row.pid, row);

  const enriched = projects.map((project) => {
    const projectId = String(project.id);
    const taskStats = taskMap.get(projectId) || {};
    const blockerStats = blockerMap.get(projectId) || {};

    const tasks = {
      total: taskStats.total || 0,
      completed: taskStats.completed || 0,
      in_progress: taskStats.in_progress || 0,
      blocked: taskStats.blocked || 0,
      carried_over: taskStats.carried_over || 0,
      pending: taskStats.pending || 0,
    };
    const blockers = {
      total: blockerStats.total || 0,
      active: blockerStats.active || 0,
    };

    const datedCount = taskStats.dated || 0;
    const timelineHealth =
      tasks.total > 0 ? Math.round((datedCount / tasks.total) * 100) : 0;

    return {
      ...project,
      taskStats: tasks,
      blockerStats: blockers,
      completionRate:
        tasks.total > 0
          ? Math.round((tasks.completed / tasks.total) * 100)
          : 0,
      timelineHealth,
    };
  });

  const totals = enriched.reduce(
    (accumulator, project) => {
      accumulator.totalTasks += project.taskStats.total;
      accumulator.completedTasks += project.taskStats.completed;
      accumulator.totalBlockers += project.blockerStats.total;
      accumulator.activeBlockers += project.blockerStats.active;
      return accumulator;
    },
    { totalTasks: 0, completedTasks: 0, totalBlockers: 0, activeBlockers: 0 },
  );

  return { status: 200, body: { success: true, projects: enriched, totals } };
}

/** A single project: details, tasks (with blockers/subtasks/resources), team and timeline. */
export async function getProjectDetail(id) {
  // NOTE: v2_projects.program_id is INTEGER, v2_programs.id is UUID
  // Cast both to text for compatibility
  const projectResult = await getAdminProjectDetails(id);

  if (projectResult.rows.length === 0) {
    return {
      status: 404,
      body: { success: false, error: "Project not found" },
    };
  }

  const project = projectResult.rows[0];

  const taskStats = await getTaskStatsForProject(id);
  const tasksResult = await getTasksForProject(id);

  // Resources/attachments — single batched query for all tasks (Ticket 1.8)
  let resourcesByTask = {};
  const allTaskIds = (tasksResult.rows || []).map((task) => task.id);
  if (allTaskIds.length > 0) {
    try {
      const resourceResult = await getResourcesByTaskIds(allTaskIds);
      for (const row of resourceResult.rows || []) {
        if (!resourcesByTask[row.task_id]) resourcesByTask[row.task_id] = [];
        resourcesByTask[row.task_id].push({
          id: row.id,
          name: row.name,
          url: row.url,
          type: row.type,
          file_name: row.file_name,
          file_size: row.file_size,
          uploaded_by: row.uploaded_by,
        });
      }
    } catch (error) {
      console.error("Failed to fetch task_resources:", error.message);
    }
  }

  // Attach blockers and subtasks to each task — batched into two IN queries
  // instead of 2 DB round-trips PER task.
  let blockersByTask = {};
  let subtasksByTask = {};
  if (allTaskIds.length > 0) {
    const [blockerResult, subtaskResult] = await Promise.all([
      getBlockersByTaskIds(allTaskIds),
      getSubtasksByParentTaskIds(allTaskIds),
    ]);
    for (const row of blockerResult.rows || []) {
      const taskId = String(row.task_id);
      if (!blockersByTask[taskId]) blockersByTask[taskId] = [];
      const { task_id: _task_id, ...rest } = row;
      blockersByTask[taskId].push(rest);
    }
    for (const row of subtaskResult.rows || []) {
      const taskId = String(row.task_id);
      if (!subtasksByTask[taskId]) subtasksByTask[taskId] = [];
      const { task_id: _task_id, ...rest } = row;
      subtasksByTask[taskId].push(rest);
    }
  }

  const tasksWithBlockers = (tasksResult.rows || []).map((task) => ({
    ...task,
    blockers: blockersByTask[String(task.id)] || [],
    subtasks: subtasksByTask[String(task.id)] || [],
    resources: resourcesByTask[task.id] || [],
  }));

  const blockersResult = await getProjectBlockers(id);
  const membersResult = await getProjectMembersUnion(id);
  const timelineResult = await getProjectTimeline(id);

  // Count dated tasks for timeline health
  let datedCount = 0;
  try {
    const datedTasks = await countDatedTasksForProject(id);
    datedCount = datedTasks.rows[0]?.count || 0;
  } catch (_) {
    datedCount = 0;
  }

  const taskStatsRow = taskStats.rows[0] || {
    total: 0,
    completed: 0,
    in_progress: 0,
    blocked: 0,
    carried_over: 0,
    pending: 0,
  };
  const total = taskStatsRow.total || 0;
  const completed = taskStatsRow.completed || 0;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const timelineHealth =
    total > 0 ? Math.round((datedCount / total) * 100) : 0;

  return {
    status: 200,
    body: {
      success: true,
      project: {
        ...project,
        taskStats: taskStatsRow,
        tasks: tasksWithBlockers,
        blockers: blockersResult.rows || [],
        members: membersResult.rows || [],
        timeline: timelineResult.rows || [],
        completionRate,
        timelineHealth,
      },
    },
  };
}
