import db from "@/lib/db";

/**
 * Projects model — list and lookup reads (REPOSITORY layer).
 *
 * The project list, its member rows and the task-summary/meta lookups, split
 * verbatim out of `models/projects.js` — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

/** Project list with program name, optional program / member filters. */
export async function getProjectsList(program_id, filterCid, include_archived) {
  let query = `
      SELECT p.*, pr.name as program_name
      FROM v2_projects p
      LEFT JOIN v2_programs pr ON p.program_id::text = pr.id::text
    `;
  const conditions = [];
  const args = [];

  // Filter by program
  if (program_id) {
    conditions.push("p.program_id = ?");
    args.push(program_id);
  }

  // Filter by user membership (project_members OR owner_id)
  if (filterCid) {
    conditions.push(
      "(EXISTS (SELECT 1 FROM project_members WHERE project_id::text = p.id::text AND user_cid = ?) OR p.owner_id = ?)",
    );
    args.push(filterCid, filterCid);
  }

  // Exclude archived unless explicitly requested
  if (include_archived !== "true") {
    conditions.push("p.status != 'Archived'");
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += " ORDER BY p.created_at DESC";

  return db.execute({ sql: query, args });
}

/** Member rows (project_id, user_cid, role) for a set of project ids. */
export async function getProjectMembersForProjects(projectIds) {
  const placeholders = projectIds.map(() => "?").join(",");
  return db.execute({
    sql: `SELECT project_id, user_cid, role FROM project_members WHERE project_id::text IN (${placeholders})`,
    args: projectIds,
  });
}

/** Aggregated task counts per project id for a set of project ids. */
export async function getTaskSummaryByProjectIds(projectIds) {
  const idsPh = projectIds.map(() => "?").join(",");
  return db.execute({
    sql: `SELECT project_id::text AS pid,
              COUNT(*) AS total,
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed
              FROM tasks WHERE project_id::text IN (${idsPh})
              GROUP BY project_id::text`,
    args: projectIds,
  });
}

/** Current meta JSON of a project (used before a meta update). */
export async function getProjectMetaById(id) {
  return db.execute({
    sql: "SELECT meta FROM v2_projects WHERE id::text = ?",
    args: [id],
  });
}
