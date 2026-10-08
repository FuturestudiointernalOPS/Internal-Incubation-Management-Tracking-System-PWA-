import db from "@/lib/db";

/**
 * Projects model — project lifecycle writes (REPOSITORY layer).
 *
 * Creation, mutable-field updates (and their SET-clause shaping), deletion and
 * the lead-member sync used by the project controllers, split verbatim out of
 * `models/projects.js` — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

/**
 * Create a project row, returning the new id.
 * Used by POST /api/projects.
 */
export async function createProject(
  program_id,
  name,
  status,
  start_date,
  end_date,
  priority,
  meta,
  primaryOwnerId,
) {
  return db.execute({
    sql: "INSERT INTO v2_projects (program_id, name, status, start_date, end_date, priority, meta, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
    args: [
      program_id || null,
      name,
      status || "Active",
      start_date || null,
      end_date || null,
      ["critical", "high", "medium", "low"].includes(priority)
        ? priority
        : "medium",
      meta,
      primaryOwnerId,
    ],
  });
}

/** Add a lead PM as a project member (POST /api/projects lead loop). */
export async function upsertProjectLeadMember(projectId, leadId) {
  return db.execute({
    sql: "INSERT INTO project_members (project_id, user_cid, role) VALUES (?, ?, 'lead') ON CONFLICT (project_id, user_cid) DO UPDATE SET role = 'lead'",
    args: [String(projectId), leadId],
  });
}

/** Notify a lead PM of a new project assignment (POST /api/projects). */
export async function createProjectAssignmentNotification(
  recipient_id,
  title,
  message,
  type,
) {
  return db.execute({
    sql: "INSERT INTO v2_notifications (recipient_id, title, message, type, is_read) VALUES (?, ?, ?, ?, 0)",
    args: [recipient_id, title, message, type],
  });
}
/** Update the mutable fields of a project (dynamic SET built by caller). */
export async function updateProject(updateFields, updateArgs) {
  return db.execute({
    sql: `UPDATE v2_projects SET ${updateFields.join(", ")} WHERE id::text = ?`,
    args: updateArgs,
  });
}

/**
 * Repository shaping: turn an ordered `{ column: value }` map into the SET
 * fragments and args that `updateProject` joins. Key order is kept, so the SQL
 * stays byte-identical to the previous inline assembly.
 *
 * It lives here, not in the service that decides which columns change, so no
 * SQL text crosses back into the service layer (docs/LAYER_SPLIT.md §5).
 */
export function projectUpdateClause(columnValues) {
  const entries = Object.entries(columnValues);
  return {
    fields: entries.map(([column]) => `${column} = ?`),
    args: entries.map(([, value]) => value),
  };
}

/** Remove all lead members of a project (PUT /api/projects lead sync). */
export async function deleteProjectLeads(id) {
  return db.execute({
    sql: "DELETE FROM project_members WHERE project_id::text = ? AND role = 'lead'",
    args: [String(id)],
  });
}

/**
 * Re-add a lead PM as a project member (PUT /api/projects lead loop).
 * Byte-identical query to upsertProjectLeadMember; extracted separately so
 * each original inline call site maps 1:1 to a model function.
 */
export async function upsertProjectLeadMemberOnUpdate(id, leadId) {
  return db.execute({
    sql: "INSERT INTO project_members (project_id, user_cid, role) VALUES (?, ?, 'lead') ON CONFLICT (project_id, user_cid) DO UPDATE SET role = 'lead'",
    args: [String(id), leadId],
  });
}

/** Remove all project members before deleting a project (DELETE handler). */
export async function deleteProjectMembersByProjectId(id) {
  return db.execute({
    sql: "DELETE FROM project_members WHERE project_id::text = ?",
    args: [id],
  });
}

/** Delete a project row (DELETE /api/projects). */
export async function deleteProjectById(id) {
  return db.execute({
    sql: "DELETE FROM v2_projects WHERE id::text = ?",
    args: [id],
  });
}
