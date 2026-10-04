import db from "@/lib/db";

/**
 * Workspace model — program progress metrics, document requirements and work
 * categories (REPOSITORY layer).
 *
 * Split verbatim out of `models/workspace.js` — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

/** Total deliverables count for a program. */
export async function countDeliverablesForProgram(programId) {
  return db.execute({
    sql: "SELECT COUNT(*) as count FROM v2_deliverables WHERE program_id = ?",
    args: [programId],
  });
}

/**
 * Approved submissions count for a program, optionally narrowed to one
 * group or one participant. The generated SQL is identical to the original
 * inline `AND group_id = ?` / `AND participant_id = ?` variants.
 */
export async function countApprovedSubmissions(programId, groupId, participantId) {
  let sql =
    "SELECT COUNT(*) as count FROM v2_submissions WHERE program_id = ? AND status = 'approved'";
  const args = [programId];

  if (groupId) {
    sql += " AND group_id = ?";
    args.push(groupId);
  } else if (participantId) {
    sql += " AND participant_id = ?";
    args.push(participantId);
  }

  return db.execute({ sql, args });
}

/**
 * Highest approved week number for a program, optionally narrowed to one
 * group or one participant. The generated SQL is identical to the original
 * inline `AND s.group_id = ?` / `AND s.participant_id = ?` variants.
 */
export async function getMaxApprovedWeek(programId, groupId, participantId) {
  return db.execute({
    sql: `SELECT MAX(d.week_number) as max_week
           FROM v2_deliverables d
           JOIN v2_submissions s ON d.id = s.deliverable_id
           WHERE s.program_id = ? AND s.status = 'approved'
           ${groupId ? "AND s.group_id = ?" : participantId ? "AND s.participant_id = ?" : ""}`,
    args: groupId
      ? [programId, groupId]
      : participantId
        ? [programId, participantId]
        : [programId],
  });
}

/** Best-effort schema guard: v2_document_requirements.resource_url column. */
export async function ensureDocumentRequirementsResourceUrlColumn() {
  return db.execute({ sql: "ALTER TABLE v2_document_requirements ADD COLUMN IF NOT EXISTS resource_url TEXT", args: [] });
}

/** Best-effort schema guard: v2_document_requirements.resource_label column. */
export async function ensureDocumentRequirementsResourceLabelColumn() {
  return db.execute({ sql: "ALTER TABLE v2_document_requirements ADD COLUMN IF NOT EXISTS resource_label TEXT", args: [] });
}

/** Document requirements of a program. */
export async function getDocumentRequirementsByProgram(programId) {
  return db.execute({
    sql: "SELECT * FROM v2_document_requirements WHERE program_id = ?",
    args: [programId],
  });
}

/** Create a document requirement, returning the inserted row. */
export async function createDocumentRequirement(programId, title, description, resourceUrl, resourceLabel) {
  return db.execute({
    sql: "INSERT INTO v2_document_requirements (program_id, title, description, resource_url, resource_label) VALUES (?, ?, ?, ?, ?) RETURNING *",
    args: [programId, title, description, resourceUrl, resourceLabel],
  });
}

/** Active work categories in display order. */
export async function listActiveWorkCategories() {
  return db.execute({
    sql: "SELECT * FROM work_categories WHERE is_active = true ORDER BY sort_order ASC",
  });
}
