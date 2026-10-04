import db from "@/lib/db";

/**
 * Workspace model — the team task board (REPOSITORY layer).
 *
 * Split verbatim out of `models/workspace.js` — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

/** Tasks of a team with the assignee name, ordered by priority. */
export async function getTeamTasks(teamId) {
  return db.execute({
    sql: `SELECT tt.*, c.name AS assigned_name
            FROM team_tasks tt
            LEFT JOIN contacts c ON tt.assigned_to = c.cid
            WHERE tt.team_id = ?
            ORDER BY
              CASE tt.priority
                WHEN 'critical' THEN 1
                WHEN 'high' THEN 2
                WHEN 'medium' THEN 3
                WHEN 'low' THEN 4
                ELSE 5
              END,
              tt.created_at DESC`,
    args: [teamId],
  });
}

/** The team a task belongs to — used to scope task mutations to their team. */
export async function getTeamTaskTeamId(taskId) {
  return db.execute({
    sql: "SELECT team_id FROM team_tasks WHERE id = ?",
    args: [taskId],
  });
}

/** Create a team task, returning the inserted row. */
export async function createTeamTask(teamId, title, description, status, priority, assignedTo, createdBy) {
  return db.execute({
    sql: `INSERT INTO team_tasks (team_id, title, description, status, priority, assigned_to, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    args: [teamId, title, description, status, priority, assignedTo, createdBy],
  });
}

/**
 * Update a team task with a caller-built set clause list. The generated SQL
 * is identical to the original inline
 * `UPDATE team_tasks SET title = ?, ..., updated_at = NOW() WHERE id = ? RETURNING *`
 * query.
 */
export async function updateTeamTaskFields(taskId, setClauses, setArgs) {
  return db.execute({
    sql: `UPDATE team_tasks SET ${setClauses.join(", ")} WHERE id = ? RETURNING *`,
    args: [...setArgs, taskId],
  });
}

/** Delete a team task. */
export async function deleteTeamTask(taskId) {
  return db.execute({
    sql: "DELETE FROM team_tasks WHERE id = ?",
    args: [taskId],
  });
}
