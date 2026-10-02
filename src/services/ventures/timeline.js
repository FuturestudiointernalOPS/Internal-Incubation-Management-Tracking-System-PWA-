/**
 * VENTURE PROJECT TIMELINE, PROGRESS AND DEPENDENCIES.
 *
 * The project progress roll-up (weighted milestones/tasks/deliverables), the
 * timeline rows and their Gantt arrangement, the delay detection summary, and
 * the generic dependency edges (add with a transitive cycle refusal, scoped
 * remove).
 *
 * The decisions — the progress weighting, the per-status progress mapping, the
 * overdue detection, the cycle walk and the delete scope — live here; every
 * statement is in `@/models/ventureTimelineStore`. Nothing here runs SQL.
 *
 * This module used to be re-exported through `@/lib/ventures`; that barrel is
 * gone (CH-4) and importers read this module directly. See docs/LAYER_SPLIT.md.
 */

import {
  selectMilestoneProgressCounts,
  selectTaskProgressCounts,
  selectDeliverableProgressCounts,
  selectTimelineMilestones,
  selectTimelineTasks,
  selectTimelineDeliverables,
  selectTimelineDependencies,
  selectOverdueTasks,
  selectDelayedMilestones,
  selectUpcomingDeadlines,
  selectDependencyGraph,
  insertDependencyEdge,
  deleteDependencyScoped,
} from "@/models/ventureTimelineStore";

/**
 * Calculate overall project progress based on milestones, tasks, and deliverables.
 */
export async function calculateProjectProgress(ventureId) {
  const result = { milestones: 0, tasks: 0, deliverables: 0, overall: 0, delayed: 0, blocked: 0 };

  // Milestones
  const ms = await selectMilestoneProgressCounts(ventureId);
  const milestoneCounts = ms.rows[0] || { total: 0, done: 0, delayed: 0, cancelled: 0 };
  result.milestones = { total: parseInt(milestoneCounts.total) || 0, done: parseInt(milestoneCounts.done) || 0, delayed: parseInt(milestoneCounts.delayed) || 0, cancelled: parseInt(milestoneCounts.cancelled) || 0 };
  result.delayed += parseInt(milestoneCounts.delayed) || 0;

  // Tasks
  const ts = await selectTaskProgressCounts(ventureId);
  const taskCounts = ts.rows[0] || { total: 0, done: 0, blocked: 0 };
  result.tasks = { total: parseInt(taskCounts.total) || 0, done: parseInt(taskCounts.done) || 0, blocked: parseInt(taskCounts.blocked) || 0 };
  result.blocked += parseInt(taskCounts.blocked) || 0;

  // Deliverables
  const ds = await selectDeliverableProgressCounts(ventureId);
  const deliverableCounts = ds.rows[0] || { total: 0, done: 0 };
  result.deliverables = { total: parseInt(deliverableCounts.total) || 0, done: parseInt(deliverableCounts.done) || 0 };

  // Overall progress: weighted average (milestones 40%, tasks 40%, deliverables 20%)
  const totalWeight =
    (result.milestones.total > 0 ? 40 : 0) +
    (result.tasks.total > 0 ? 40 : 0) +
    (result.deliverables.total > 0 ? 20 : 0);

  if (totalWeight === 0) {
    result.overall = 0;
  } else {
    const weighted =
      (result.milestones.total > 0 ? (result.milestones.done / result.milestones.total) * 40 : 0) +
      (result.tasks.total > 0 ? (result.tasks.done / result.tasks.total) * 40 : 0) +
      (result.deliverables.total > 0 ? (result.deliverables.done / result.deliverables.total) * 20 : 0);
    result.overall = Math.round(weighted);
  }

  return result;
}

/**
 * Get timeline events for Gantt chart rendering.
 */
export async function getProjectTimeline(ventureId) {
  const events = [];

  // Milestones as timeline rows
  const milestones = await selectTimelineMilestones(ventureId);
  for (const milestone of milestones.rows || []) {
    events.push({
      id: `milestone-${milestone.id}`,
      type: "milestone",
      reference_type: "milestone",
      reference_id: milestone.id,
      title: milestone.title,
      status: milestone.status,
      progress: milestone.progress || 0,
      start_date: milestone.created_at,
      end_date: milestone.target_date,
      parent_id: null,
    });
  }

  // Tasks as timeline rows (under their milestone if applicable)
  const tasks = await selectTimelineTasks(ventureId);
  for (const task of tasks.rows || []) {
    const progressMap = { backlog: 0, todo: 0, in_progress: 50, review: 80, done: 100, blocked: 0, cancelled: 0 };
    events.push({
      id: `task-${task.id}`,
      type: "task",
      reference_type: "task",
      reference_id: task.id,
      title: task.title,
      status: task.status,
      progress: progressMap[task.status] || 0,
      start_date: task.created_at,
      end_date: task.due_date,
      parent_id: task.milestone_id ? `milestone-${task.milestone_id}` : null,
    });
  }

  // Deliverables as timeline rows
  const deliverables = await selectTimelineDeliverables(ventureId);
  for (const deliverable of deliverables.rows || []) {
    const progressMap = { pending: 0, in_progress: 30, submitted: 70, approved: 100, rejected: 0, completed: 100 };
    events.push({
      id: `deliverable-${deliverable.id}`,
      type: "deliverable",
      reference_type: "deliverable",
      reference_id: deliverable.id,
      title: deliverable.title,
      status: deliverable.status,
      progress: progressMap[deliverable.status] || 0,
      start_date: deliverable.created_at,
      end_date: deliverable.due_date,
      parent_id: deliverable.milestone_id ? `milestone-${deliverable.milestone_id}` : null,
    });
  }

  // Dependencies
  const deps = await selectTimelineDependencies(ventureId);

  // Overdue detection
  const now = new Date();
  const overdue = events.filter((event) => event.end_date && new Date(event.end_date) < now && event.progress < 100);

  return {
    events,
    dependencies: deps.rows || [],
    overdue: overdue.map((event) => ({ id: event.id, title: event.title, type: event.type, due_date: event.end_date, progress: event.progress })),
  };
}

/**
 * Get Gantt chart data (events sorted and structured for rendering).
 */
export async function getGanttData(ventureId) {
  const timeline = await getProjectTimeline(ventureId);
  const progress = await calculateProjectProgress(ventureId);

  // Sort: milestones first, then by parent grouping
  const sorted = [...timeline.events].sort((first, second) => {
    if (first.type === "milestone" && second.type !== "milestone") return -1;
    if (first.type !== "milestone" && second.type === "milestone") return 1;
    if (first.parent_id && second.parent_id && first.parent_id !== second.parent_id) {
      return first.parent_id.localeCompare(second.parent_id);
    }
    if (first.start_date && second.start_date) return new Date(first.start_date) - new Date(second.start_date);
    return 0;
  });

  return {
    rows: sorted,
    dependencies: timeline.dependencies,
    overdue: timeline.overdue,
    progress,
  };
}

/**
 * Get delay detection summary.
 */
export async function getDelaySummary(ventureId) {
  const overdueTasks = await selectOverdueTasks(ventureId);

  // `target_date` is the canonical milestone date column. It is aliased to
  // `due_date` on purpose: the callers (timeline page, delay panel) read that
  // key, and the JSON contract must not change with the column fix.
  const delayedMilestones = await selectDelayedMilestones(ventureId);

  const upcomingDeadlines = await selectUpcomingDeadlines(ventureId);

  return {
    overdue_tasks: overdueTasks.rows || [],
    delayed_milestones: delayedMilestones.rows || [],
    upcoming_deadlines: upcomingDeadlines.rows || [],
  };
}

// ─── Dependencies ──────────────────────────────────────────────────────────

/**
 * Add a dependency edge: the SOURCE blocks the TARGET (finish_to_start — the
 * target only frees up once the source is completed). Entity ids are stored as
 * TEXT on purpose: milestones are UUIDs and tasks are integers, and one edge
 * shape has to hold both. `ventureId` is the ventures(id) UUID.
 *
 * A cycle is refused, including a TRANSITIVE one (A blocks B, B blocks C,
 * then C blocks A): the legacy check compared one hop back, which let longer
 * loops through. The walk follows the edges the rows already describe.
 */
export async function addDependency({ ventureId, sourceType, sourceId, targetType, targetId }) {
  const existing = await selectDependencyGraph(ventureId);

  const keyOf = (type, id) => `${type}:${id}`;
  const blocks = new Map();
  for (const row of existing.rows || []) {
    const from = keyOf(row.source_type, row.source_id);
    const list = blocks.get(from) || [];
    list.push(keyOf(row.target_type, row.target_id));
    blocks.set(from, list);
  }

  const start = keyOf(targetType, String(targetId));
  const goal = keyOf(sourceType, String(sourceId));
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length > 0) {
    const node = queue.shift();
    if (node === goal) throw new Error("Circular dependency detected.");
    for (const next of blocks.get(node) || []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }

  await insertDependencyEdge(ventureId, sourceType, String(sourceId), targetType, String(targetId));
  return { success: true };
}

export async function removeDependency(dependencyId, ventureIds = []) {
  const ids = (Array.isArray(ventureIds) ? ventureIds : [ventureIds]).filter(
    (ventureId) => ventureId !== null && ventureId !== undefined,
  );
  if (ids.length === 0) return { success: false };
  // The dependency id comes from the request: the DELETE is scoped to the
  // accepted venture ids (the resolved ventures(id) UUID), so it can never
  // reach another Venture's rows. Ids are compared as text — they are UUIDs.
  const scope = ids.map(() => "venture_id::text = ?::text").join(" OR ");
  await deleteDependencyScoped(dependencyId, scope, ids.map((ventureId) => String(ventureId)));
  return { success: true };
}
