/**
 * VENTURE REPORTS AND PROJECT ANALYTICS.
 *
 * The analytics roll-up of a Venture (summary, KPIs, chart data), the milestone
 * and task report queries, the team-productivity report and the CSV-friendly
 * export rows.
 *
 * The decisions — the weighted completion, the health penalty, the productivity
 * score, the trend aggregation and the per-row percentages — live here; every
 * statement is in `@/models/ventureAnalyticsStore`. Nothing here runs SQL.
 *
 * Re-exported unchanged through `@/lib/ventures` (the module it came from) —
 * see docs/LAYER_SPLIT.md.
 */

import {
  selectAnalyticsMilestoneCounts,
  selectAnalyticsTaskCounts,
  selectAnalyticsDeliverableCounts,
  selectAvgTaskCompletionDays,
  selectOnTimeTaskCounts,
  selectTaskStatusDistribution,
  selectMilestoneStatusDistribution,
  selectActivityTrend,
  selectWorkloadDistribution,
  selectMilestonesReport,
  selectTasksReport,
  selectTeamProductivity,
} from "@/models/ventureAnalyticsStore";

/**
 * Compute full project analytics for a venture.
 */
export async function getVentureAnalytics(ventureId) {
  // ── Project Summary ──
  const [mRes, tRes, dRes] = await Promise.all([
    selectAnalyticsMilestoneCounts(ventureId),
    selectAnalyticsTaskCounts(ventureId),
    selectAnalyticsDeliverableCounts(ventureId),
  ]);

  const milestoneCounts = mRes.rows[0] || { t: 0, done: 0, delayed: 0 };
  const taskCounts = tRes.rows[0] || { t: 0, done: 0, blocked: 0, overdue: 0 };
  const deliverableCounts = dRes.rows[0] || { t: 0, done: 0 };

  const milestones = { total: parseInt(milestoneCounts.t)||0, done: parseInt(milestoneCounts.done)||0, delayed: parseInt(milestoneCounts.delayed)||0 };
  const tasks = { total: parseInt(taskCounts.t)||0, done: parseInt(taskCounts.done)||0, blocked: parseInt(taskCounts.blocked)||0, overdue: parseInt(taskCounts.overdue)||0 };
  const deliverables = { total: parseInt(deliverableCounts.t)||0, done: parseInt(deliverableCounts.done)||0 };

  // ── Overall completion ──
  const totalWeight = (milestones.total > 0 ? 40 : 0) + (tasks.total > 0 ? 40 : 0) + (deliverables.total > 0 ? 20 : 0);
  const overall = totalWeight > 0 ? Math.round(
    ((milestones.total > 0 ? milestones.done/milestones.total*40 : 0) +
     (tasks.total > 0 ? tasks.done/tasks.total*40 : 0) +
     (deliverables.total > 0 ? deliverables.done/deliverables.total*20 : 0)) / totalWeight * 100
  ) : 0;

  // ── Health score ──
  const healthPenalty = (tasks.overdue * 5) + (milestones.delayed * 10) + (tasks.blocked * 8);
  const healthScore = Math.max(0, Math.min(100, overall - healthPenalty));

  // ── Average completion time (tasks) ──
  const avgTime = await selectAvgTaskCompletionDays(ventureId);
  const avgCompletionDays = Math.round((avgTime.rows[0]?.avg_days || 0) * 10) / 10;

  // ── On-time delivery % ──
  const onTime = await selectOnTimeTaskCounts(ventureId);
  const onTimeCounts = onTime.rows[0] || { total: 0, on_time: 0 };
  const onTimeDelivery = parseInt(onTimeCounts.total) > 0 ? Math.round((parseInt(onTimeCounts.on_time)/parseInt(onTimeCounts.total))*100) : 0;

  // ── Status distribution ──
  const statusDist = await selectTaskStatusDistribution(ventureId);
  const taskStatusDist = {};
  for (const row of statusDist.rows || []) taskStatusDist[row.status] = parseInt(row.cnt);

  const msStatusDist = await selectMilestoneStatusDistribution(ventureId);
  const milestoneStatusDist = {};
  for (const row of msStatusDist.rows || []) milestoneStatusDist[row.status] = parseInt(row.cnt);

  // ── Trend (last 30 days activity) ──
  const trend = await selectActivityTrend(ventureId);

  const activityTrend = [];
  const dayMap = {};
  for (const row of trend.rows || []) {
    const day = row.day;
    if (!dayMap[day]) { dayMap[day] = { date: day, total: 0, completed: 0, created: 0 }; activityTrend.push(dayMap[day]); }
    dayMap[day].total += parseInt(row.cnt);
    if (row.action?.includes('COMPLETED') || row.action?.includes('APPROVED')) dayMap[day].completed += parseInt(row.cnt);
    if (row.action?.includes('CREATED')) dayMap[day].created += parseInt(row.cnt);
  }

  // ── Workload distribution ──
  const workload = await selectWorkloadDistribution(ventureId);

  // ── Productivity score ──
  const totalTasks = tasks.total || 1;
  const productivityScore = Math.round(((tasks.done / totalTasks) * 50) + (onTimeDelivery * 0.3) + (Math.max(0, 100 - tasks.blocked * 10) * 0.2));

  return {
    summary: { milestones, tasks, deliverables, overall, health_score: healthScore },
    kpis: {
      overall_completion: overall,
      tasks_completed: tasks.done,
      tasks_pending: tasks.total - tasks.done,
      tasks_overdue: tasks.overdue,
      milestones_completed: milestones.done,
      avg_completion_days: avgCompletionDays,
      on_time_delivery: onTimeDelivery,
      productivity_score: productivityScore,
      health_score: healthScore,
      blocked_count: tasks.blocked,
      delayed_count: milestones.delayed,
    },
    charts: {
      task_status_distribution: taskStatusDist,
      milestone_status_distribution: milestoneStatusDist,
      activity_trend_30d: activityTrend,
      workload_distribution: workload.rows || [],
      completion_breakdown: {
        milestones: milestones.total > 0 ? Math.round((milestones.done/milestones.total)*100) : 0,
        tasks: tasks.total > 0 ? Math.round((tasks.done/tasks.total)*100) : 0,
        deliverables: deliverables.total > 0 ? Math.round((deliverables.done/deliverables.total)*100) : 0,
      },
    },
  };
}

/**
 * Get all milestones for a venture with progress data (report).
 */
export async function getMilestonesReport(ventureId) {
  const res = await selectMilestonesReport(ventureId);
  return (res.rows || []).map((milestone) => ({
    ...milestone,
    deliverables_progress: milestone.del_total > 0 ? Math.round((milestone.del_done/milestone.del_total)*100) : 0,
    tasks_progress: milestone.task_total > 0 ? Math.round((milestone.task_done/milestone.task_total)*100) : 0,
  }));
}

/**
 * Get all tasks for a venture (report).
 */
export async function getTasksReport(ventureId, filters = {}) {
  const res = await selectTasksReport(ventureId, filters);
  return res.rows || [];
}

/**
 * Get team productivity report.
 */
export async function getTeamProductivity(ventureId) {
  const members = await selectTeamProductivity(ventureId);

  return (members.rows || []).map((member) => ({
    ...member,
    total_tasks: parseInt(member.total_tasks)||0,
    completed: parseInt(member.completed)||0,
    blocked: parseInt(member.blocked)||0,
    overdue: parseInt(member.overdue)||0,
    total_estimated: parseFloat(member.total_estimated)||0,
    completed_estimated: parseFloat(member.completed_estimated)||0,
    completion_rate: parseInt(member.total_tasks) > 0 ? Math.round((parseInt(member.completed)/parseInt(member.total_tasks))*100) : 0,
  }));
}

/**
 * Generate export data (CSV-friendly array).
 */
export async function getExportData(ventureId, type = "tasks") {
  if (type === "tasks") {
    const tasks = await getTasksReport(ventureId);
    return tasks.map((task) => ({
      Title: task.title, Status: task.status, Priority: task.priority,
      Assignee: task.assigned_name || "", Milestone: task.milestone_title || "",
      "Due Date": task.due_date ? new Date(task.due_date).toLocaleDateString() : "",
      "Est. Hours": task.estimated_hours || "",
      "Created At": new Date(task.created_at).toLocaleDateString(),
    }));
  }
  if (type === "milestones") {
    const ms = await getMilestonesReport(ventureId);
    return ms.map((milestone) => ({
      Title: milestone.title, Status: milestone.status, Priority: milestone.priority,
      "Due Date": milestone.target_date ? new Date(milestone.target_date).toLocaleDateString() : "",
      "Completion %": milestone.progress,
      Deliverables: `${milestone.del_done||0}/${milestone.del_total||0}`,
      Tasks: `${milestone.task_done||0}/${milestone.task_total||0}`,
    }));
  }
  return [];
}
