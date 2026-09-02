import db from "@/lib/db";

/**
 * Retro model — data access for the retro controllers
 * (`src/app/api/retros/current/route.js`, `src/app/api/retros/submit/route.js`).
 *
 * Each function wraps exactly one SQL statement. SQL is byte-identical to the
 * queries that used to live inline in the controller, so behavior is unchanged.
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 */

// ── GET /api/retros/current ──────────────────────────────────────────────────

/** Existing retro report row (SELECT *) for a user/week, scoped by context. */
export async function getRetroReportByWeek(
  userId,
  weekNumber,
  year,
  contextId,
  contextType,
) {
  let sql = "SELECT * FROM v2_op_reports WHERE user_id = ? AND week_number = ? AND year = ? AND report_type = 'retro'";
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

/** Active (open) tasks for the user (own or assigned), newest first. */
export async function getRetroActiveTasks(userId) {
  return db.execute({
    sql: "SELECT * FROM tasks WHERE (user_id = ? OR assigned_to = ?) AND status IN ('pending', 'in_progress', 'blocked', 'carried_over') ORDER BY created_at DESC",
    args: [userId, userId],
  });
}

/** Blockers (id/title/status/severity) for a set of task ids, newest first. */
export async function getBlockersByTaskIds(taskIds) {
  return db.execute({
    sql: `SELECT id, title, status, severity, task_id FROM blockers WHERE task_id IN (${taskIds.map(() => "?").join(",")}) ORDER BY created_at DESC`,
    args: taskIds,
  });
}

// ── POST /api/retros/submit ──────────────────────────────────────────────────

/** Existing retro report id (upsert lookup, scoped by context). */
export async function findRetroReportId(
  userId,
  weekNumber,
  year,
  contextId,
  contextType,
) {
  let sql =
    "SELECT id FROM v2_op_reports WHERE user_id = ? AND week_number = ? AND year = ? AND report_type = 'retro'";
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

/** Update an existing retro report with the submitted content. */
export async function updateRetroReport({
  reportData,
  context_type,
  context_id,
  reportId,
}) {
  return db.execute({
    sql: `UPDATE v2_op_reports SET
          completed_work = ?, unfinished_tasks = ?, challenges = ?, wins = ?,
          carryover_items = ?, week_status = ?, retro_notes = ?,
          had_blockers = ?, blocker_type = ?, blocker_desc = ?, major_achievement = ?,
          context_type = ?, context_id = ?,
          status = 'submitted', updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
    args: [
      reportData.completed_work,
      reportData.unfinished_tasks,
      reportData.challenges,
      reportData.wins,
      reportData.carryover_items,
      reportData.week_status,
      reportData.retro_notes,
      reportData.had_blockers,
      reportData.blocker_type,
      reportData.blocker_desc,
      reportData.major_achievement,
      context_type || "staff",
      context_id || null,
      reportId,
    ],
  });
}

/** Insert a new retro report, returning the created row id. */
export async function createRetroReport({
  reportData,
  user_id,
  user_name,
  user_role,
  week_number,
  year,
  context_type,
  context_id,
}) {
  return db.execute({
    sql: `INSERT INTO v2_op_reports
          (user_id, user_name, user_role, report_type, week_number, year, status,
           completed_work, unfinished_tasks, challenges, wins,
           carryover_items, week_status, retro_notes,
           had_blockers, blocker_type, blocker_desc, major_achievement,
           context_type, context_id)
          VALUES (?, ?, ?, 'retro', ?, ?, 'submitted',
           ?, ?, ?, ?,
           ?, ?, ?,
           ?, ?, ?, ?,
           ?, ?) RETURNING id`,
    args: [
      user_id,
      user_name || "",
      user_role || "staff",
      week_number,
      year,
      reportData.completed_work,
      reportData.unfinished_tasks,
      reportData.challenges,
      reportData.wins,
      reportData.carryover_items,
      reportData.week_status,
      reportData.retro_notes,
      reportData.had_blockers,
      reportData.blocker_type,
      reportData.blocker_desc,
      reportData.major_achievement,
      context_type || "staff",
      context_id || null,
    ],
  });
}

/** Set a task's status during retro reconciliation (records completed_at when done). */
export async function reconcileTaskStatus(status, taskId) {
  const updateFields = ["status = ?", "updated_at = CURRENT_TIMESTAMP"];
  const updateArgs = [status, parseInt(taskId)];

  if (status === "completed") {
    updateFields.push("completed_at = CURRENT_TIMESTAMP");
  }

  return db.execute({
    sql: `UPDATE tasks SET ${updateFields.join(", ")} WHERE id = ?`,
    args: updateArgs,
  });
}
