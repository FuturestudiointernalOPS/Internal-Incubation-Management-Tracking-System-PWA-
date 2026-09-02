import db from "@/lib/db";

/**
 * Standup model — data access for the standup controllers
 * (`src/app/api/standups/current/route.js`, `src/app/api/standups/submit/route.js`).
 *
 * Each function wraps exactly one SQL statement. SQL is byte-identical to the
 * queries that used to live inline in the controller, so behavior is unchanged.
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 */

// ── GET /api/standups/current ────────────────────────────────────────────────

/** Existing standup report row (SELECT *) for a user/week, scoped by context. */
export async function getStandupReportByWeek(
  userId,
  weekNumber,
  year,
  contextId,
  contextType,
) {
  let sql =
    "SELECT * FROM v2_op_reports WHERE user_id = ? AND week_number = ? AND year = ? AND report_type = 'standup'";
  const args = [userId, weekNumber, year];

  if (contextId) {
    sql += " AND context_id = ?";
    args.push(contextId);
  } else {
    sql += " AND context_type = ?";
    args.push(contextType);
  }

  sql += " LIMIT 1";
  return db.execute({ sql, args });
}

/** Tasks created in the target week (owned OR assigned to the user). */
export async function getStandupWeekTasks(
  userId,
  weekNumber,
  year,
  contextType,
  contextId,
  showAll,
) {
  let sql = `SELECT * FROM tasks
      WHERE (user_id = ? OR assigned_to = ?)
      AND created_week = ? AND created_year = ?
      AND context_type = ?`;

  const args = [userId, userId, weekNumber, year, contextType];
  if (contextId) {
    sql += " AND context_id = ?";
    args.push(contextId);
  }

  // Archived tasks are soft-deleted and must not appear in the active
  // dashboard view unless explicitly requested for historical reference.
  if (!showAll) {
    sql += " AND status != 'archived'";
  }

  sql += ` ORDER BY CASE priority
        WHEN 'critical' THEN 0 WHEN 'high' THEN 1
        WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4
      END, created_at ASC`;

  return db.execute({ sql, args });
}

/**
 * Uncompleted tasks from earlier weeks that still need work (carry-over).
 * If show_all is true, include ALL tasks. Otherwise only active ones.
 */
export async function getStandupCarryoverTasks(
  userId,
  weekNumber,
  year,
  contextType,
  contextId,
  showAll,
) {
  const carryStatuses = showAll
    ? [] // Include everything
    : ["in_progress", "blocked", "carried_over"];
  let sql = `SELECT * FROM tasks
        WHERE (user_id = ? OR assigned_to = ?)
        AND (created_week < ? OR (created_year < ? AND created_year = ?))
        AND context_type = ?`;

  const args = [userId, userId, weekNumber, year, year, contextType];

  if (contextId) {
    sql += " AND context_id = ?";
    args.push(contextId);
  }

  if (!showAll) {
    sql += ` AND status IN (${carryStatuses.map(() => "?").join(",")})`;
    args.push(...carryStatuses);
  }

  sql += ` ORDER BY CASE priority
        WHEN 'critical' THEN 0 WHEN 'high' THEN 1
        WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4
      END, created_at ASC`;

  return db.execute({ sql, args });
}

/** Blockers (id/title/status/severity) for a set of task ids, newest first. */
export async function getBlockersByTaskIds(taskIds) {
  return db.execute({
    sql: `SELECT id, title, status, severity, task_id FROM blockers WHERE task_id IN (${taskIds.map(() => "?").join(",")}) ORDER BY created_at DESC`,
    args: taskIds,
  });
}

// ── POST /api/standups/submit ────────────────────────────────────────────────

/** Existing standup report id (upsert lookup, scoped by context). */
export async function findStandupReportId(
  userId,
  weekNumber,
  year,
  contextId,
  contextType,
) {
  let sql =
    "SELECT id FROM v2_op_reports WHERE user_id = ? AND week_number = ? AND year = ? AND report_type = 'standup'";
  const args = [userId, weekNumber, year];
  if (contextId) {
    sql += " AND context_id = ?";
    args.push(contextId);
  } else {
    sql += " AND context_type = ?";
    args.push(contextType || "staff");
  }
  return db.execute({ sql, args });
}

/** Update an existing standup report with the submitted content. */
export async function updateStandupReport({
  reportId,
  top_priorities,
  expected_deliverables,
  projects_tasks,
  has_dependencies,
  dependency_note,
  has_blockers,
  blocker_description,
  needs_support,
  support_note,
  additional_notes,
  context_type,
  context_id,
}) {
  return db.execute({
    sql: `UPDATE v2_op_reports SET
          top_priorities = ?, expected_deliverables = ?, projects_tasks = ?,
          has_dependencies = ?, dependency_note = ?,
          has_blockers = ?, blocker_description = ?,
          needs_support = ?, support_note = ?, additional_notes = ?,
          context_type = ?, context_id = ?,
          status = 'submitted', updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
    args: [
      JSON.stringify(top_priorities || []),
      JSON.stringify(expected_deliverables || []),
      projects_tasks || null,
      has_dependencies != null ? (has_dependencies ? 1 : 0) : null,
      dependency_note || null,
      has_blockers != null ? (has_blockers ? 1 : 0) : null,
      blocker_description || null,
      needs_support != null ? (needs_support ? 1 : 0) : null,
      support_note || null,
      additional_notes || null,
      context_type || "staff",
      context_id || null,
      reportId,
    ],
  });
}

/** Insert a new standup report, returning the created row id. */
export async function createStandupReport({
  user_id,
  user_name,
  user_role,
  workspace,
  week_number,
  year,
  top_priorities,
  expected_deliverables,
  projects_tasks,
  has_dependencies,
  dependency_note,
  has_blockers,
  blocker_description,
  needs_support,
  support_note,
  additional_notes,
  context_type,
  context_id,
}) {
  return db.execute({
    sql: `INSERT INTO v2_op_reports
          (user_id, user_name, user_role, workspace, report_type, week_number, year, status,
           top_priorities, expected_deliverables, projects_tasks,
           has_dependencies, dependency_note, has_blockers, blocker_description,
           needs_support, support_note, additional_notes, context_type, context_id)
          VALUES (?, ?, ?, ?, 'standup', ?, ?, 'submitted',
           ?, ?, ?,
           ?, ?, ?, ?,
           ?, ?, ?, ?, ?) RETURNING id`,
    args: [
      user_id,
      user_name || "",
      user_role || "staff",
      workspace,
      week_number,
      year,
      JSON.stringify(top_priorities || []),
      JSON.stringify(expected_deliverables || []),
      projects_tasks || null,
      has_dependencies != null ? (has_dependencies ? 1 : 0) : null,
      dependency_note || null,
      has_blockers != null ? (has_blockers ? 1 : 0) : null,
      blocker_description || null,
      needs_support != null ? (needs_support ? 1 : 0) : null,
      support_note || null,
      additional_notes || null,
      context_type || "staff",
      context_id || null,
    ],
  });
}

/** Create an inline task submitted with the standup report. */
export async function createStandupTask({
  user_id,
  user_name,
  task,
  week_number,
  year,
  context_type,
  context_id,
}) {
  return db.execute({
    sql: `INSERT INTO tasks
              (user_id, user_name, title, description, status, project_id,
               created_week, created_year, start_date, end_date,
               context_type, context_id)
              VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    args: [
      user_id,
      user_name || "",
      task.title,
      task.description || null,
      task.project_id || null,
      week_number,
      year,
      task.start_date || null,
      task.end_date || null,
      context_type || "staff",
      context_id || null,
    ],
  });
}
