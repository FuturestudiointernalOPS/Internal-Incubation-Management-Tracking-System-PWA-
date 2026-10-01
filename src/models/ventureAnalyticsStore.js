/**
 * Venture reports and project analytics — statements (REPOSITORY layer).
 *
 * The data access behind `@/services/ventures/analytics`: the summary counts,
 * the average completion time, the on-time counts, the status distributions, the
 * 30-day activity trend, the workload rows, the milestone/task report queries and
 * the team-productivity grouping.
 *
 * SQL is byte-identical to what used to sit inline in `src/lib/ventures.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";

// ── Summary counts ───────────────────────────────────────────────────────────

/** Analytics milestones count for a Venture. */
export function selectAnalyticsMilestoneCounts(ventureId) {
  return db.execute({ sql: "SELECT COUNT(*) as t, SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as done, SUM(CASE WHEN status='delayed' THEN 1 ELSE 0 END) as delayed FROM venture_milestones WHERE venture_id=?", args: [ventureId] });
}

/** Analytics tasks count for a Venture. */
export function selectAnalyticsTaskCounts(ventureId) {
  return db.execute({ sql: "SELECT COUNT(*) as t, SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done, SUM(CASE WHEN status='blocked' THEN 1 ELSE 0 END) as blocked, SUM(CASE WHEN due_date<NOW() AND status NOT IN ('done','cancelled') THEN 1 ELSE 0 END) as overdue FROM venture_tasks WHERE venture_id=?", args: [ventureId] });
}

/** Analytics deliverables count for a Venture. */
export function selectAnalyticsDeliverableCounts(ventureId) {
  return db.execute({ sql: "SELECT COUNT(*) as t, SUM(CASE WHEN status IN ('approved','completed') THEN 1 ELSE 0 END) as done FROM venture_deliverables WHERE venture_id=?", args: [ventureId] });
}

/** Average days to completion of a Venture's done tasks. */
export function selectAvgTaskCompletionDays(ventureId) {
  return db.execute({
    sql: `SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/86400) as avg_days
          FROM venture_tasks WHERE venture_id=? AND status='done' AND updated_at > created_at`,
    args: [ventureId],
  });
}

/** On-time/total counts of a Venture's done tasks. */
export function selectOnTimeTaskCounts(ventureId) {
  return db.execute({
    sql: `SELECT COUNT(*) as total,
       SUM(CASE WHEN due_date IS NOT NULL AND updated_at <= due_date THEN 1 ELSE 0 END) as on_time
       FROM venture_tasks WHERE venture_id=? AND status='done' AND due_date IS NOT NULL`,
    args: [ventureId],
  });
}

/** Task status distribution of a Venture. */
export function selectTaskStatusDistribution(ventureId) {
  return db.execute({
    sql: `SELECT status, COUNT(*) as cnt FROM venture_tasks WHERE venture_id=? GROUP BY status ORDER BY cnt DESC`,
    args: [ventureId],
  });
}

/** Milestone status distribution of a Venture. */
export function selectMilestoneStatusDistribution(ventureId) {
  return db.execute({
    sql: `SELECT status, COUNT(*) as cnt FROM venture_milestones WHERE venture_id=? GROUP BY status ORDER BY cnt DESC`,
    args: [ventureId],
  });
}

/** 30-day milestone-activity trend of a Venture. */
export function selectActivityTrend(ventureId) {
  return db.execute({
    sql: `SELECT DATE(created_at) as day, action, COUNT(*) as cnt
          FROM venture_milestone_activity WHERE venture_id=? AND created_at > NOW() - INTERVAL '30 days'
          GROUP BY day, action ORDER BY day ASC`,
    args: [ventureId],
  });
}

/** Workload distribution by assignee for a Venture. */
export function selectWorkloadDistribution(ventureId) {
  return db.execute({
    sql: `SELECT assigned_name, COUNT(*) as task_count,
       SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done_count,
       SUM(CASE WHEN status='blocked' THEN 1 ELSE 0 END) as blocked_count
       FROM venture_tasks WHERE venture_id=? AND assigned_name IS NOT NULL
       GROUP BY assigned_name ORDER BY task_count DESC`,
    args: [ventureId],
  });
}

// ── Report queries ───────────────────────────────────────────────────────────

/** Milestones of a Venture with their deliverable/task roll-ups. */
export function selectMilestonesReport(ventureId) {
  return db.execute({
    sql: `SELECT vm.*,
       (SELECT COUNT(*) FROM venture_deliverables vd WHERE vd.milestone_id=vm.id) as del_total,
       (SELECT COUNT(*) FROM venture_deliverables vd WHERE vd.milestone_id=vm.id AND vd.status IN ('approved','completed')) as del_done,
       (SELECT COUNT(*) FROM venture_tasks vt WHERE vt.milestone_id=vm.id) as task_total,
       (SELECT COUNT(*) FROM venture_tasks vt WHERE vt.milestone_id=vm.id AND vt.status='done') as task_done
       FROM venture_milestones vm WHERE vm.venture_id=? ORDER BY vm.created_at DESC`,
    args: [ventureId],
  });
}

/** Tasks of a Venture (optional filters), newest first. */
export function selectTasksReport(ventureId, filters = {}) {
  let sql = `SELECT vt.*, vm.title as milestone_title
             FROM venture_tasks vt
             LEFT JOIN venture_milestones vm ON vt.milestone_id=vm.id
             WHERE vt.venture_id=?`;
  const args = [ventureId];

  if (filters.status) { sql += " AND vt.status=?"; args.push(filters.status); }
  if (filters.priority) { sql += " AND vt.priority=?"; args.push(filters.priority); }
  if (filters.assigned_cid) { sql += " AND vt.assigned_cid=?"; args.push(filters.assigned_cid); }
  if (filters.due_before) { sql += " AND vt.due_date<=?"; args.push(filters.due_before); }
  if (filters.due_after) { sql += " AND vt.due_date>=?"; args.push(filters.due_after); }

  sql += " ORDER BY vt.created_at DESC";
  if (filters.limit) { sql += " LIMIT ?"; args.push(parseInt(filters.limit)); }

  return db.execute({ sql, args });
}

/** Team-productivity grouping by assignee for a Venture. */
export function selectTeamProductivity(ventureId) {
  return db.execute({
    sql: `SELECT assigned_name as name, assigned_cid as cid,
       COUNT(*) as total_tasks,
       SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as completed,
       SUM(CASE WHEN status='blocked' THEN 1 ELSE 0 END) as blocked,
       SUM(CASE WHEN due_date<NOW() AND status NOT IN ('done','cancelled') THEN 1 ELSE 0 END) as overdue,
       SUM(estimated_hours) as total_estimated,
       SUM(CASE WHEN status='done' THEN estimated_hours ELSE 0 END) as completed_estimated
       FROM venture_tasks WHERE venture_id=? AND assigned_name IS NOT NULL
       GROUP BY assigned_name, assigned_cid ORDER BY completed DESC`,
    args: [ventureId],
  });
}
