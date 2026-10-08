import db from "@/lib/db";

/**
 * Projects model — weekly project updates (REPOSITORY layer).
 *
 * The weekly update list, upsert check, update and insert used by the admin
 * project-updates view, split verbatim out of `models/projects.js` — see
 * docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

/** Weekly project updates, newest first (admin project-updates view). */
export async function getProjectUpdates(id) {
  return db.execute({
    sql: "SELECT * FROM v2_project_updates WHERE project_id::text = ? ORDER BY year DESC, week_number DESC",
    args: [id],
  });
}

/** Id of an existing weekly update for a project/week/year (upsert check). */
export async function findProjectUpdateId(id, currentWeek, currentYear) {
  return db.execute({
    sql: "SELECT id FROM v2_project_updates WHERE project_id::text = ? AND week_number = ? AND year = ?",
    args: [id, currentWeek, currentYear],
  });
}

/** Update an existing weekly update (dynamic SET built by caller). */
export async function updateProjectUpdate(updateFields, updateArgs) {
  return db.execute({
    sql: `UPDATE v2_project_updates SET ${updateFields.join(", ")} WHERE id = ?`,
    args: updateArgs,
  });
}

/** Insert a new weekly project update, returning the new id. */
export async function createProjectUpdate(
  project_id,
  user_id,
  user_name,
  week_number,
  year,
  status,
  accomplishments,
  current_focus,
  blockers,
  next_steps,
  overall_status,
  notes,
) {
  return db.execute({
    sql: `INSERT INTO v2_project_updates
        (project_id, user_id, user_name, week_number, year, status,
         accomplishments, current_focus, blockers, next_steps,
         overall_status, notes)
        VALUES (?, ?, ?, ?, ?, ?,
         ?, ?, ?, ?,
         ?, ?) RETURNING id`,
    args: [
      project_id,
      user_id,
      user_name || "",
      week_number,
      year,
      status || "draft",
      accomplishments || null,
      current_focus || null,
      blockers || null,
      next_steps || null,
      overall_status || "on_track",
      notes || null,
    ],
  });
}
