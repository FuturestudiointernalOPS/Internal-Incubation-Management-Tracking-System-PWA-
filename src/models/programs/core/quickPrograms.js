import db from "@/lib/db";

// ─────────────────────────────────────────────────────────────────────────────
// /api/programs — quick program create / list / update (11 queries)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a v2 program row (staff quick-create), returning the new id.
 * Used by POST /api/programs.
 */
export async function createV2Program({
  programId,
  name,
  description,
  duration_weeks,
  duration_days,
  topics,
  outcomes,
  deliverables,
  resources,
  assigned_pm_id,
  feedback_enabled,
  grading_mode,
  evaluation_config,
}) {
  return db.execute({
    sql: `INSERT INTO v2_programs (
        id, name, description, duration_weeks, duration_days,
        topics, outcomes, deliverables, resources, assigned_pm_id, feedback_enabled,
        grading_mode, evaluation_config
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    args: [
      programId,
      name,
      description,
      duration_weeks || 13,
      duration_days || 0,
      JSON.stringify(topics || []),
      JSON.stringify(outcomes || []),
      JSON.stringify(deliverables || []),
      JSON.stringify(resources || []),
      assigned_pm_id || null,
      feedback_enabled !== undefined ? (feedback_enabled ? 1 : 0) : 1,
      grading_mode || 'graded',
      evaluation_config ? JSON.stringify(evaluation_config) : '{}',
    ],
  });
}

/**
 * Auto-create the system-defined Facilitators group for a new program.
 * Used by POST /api/programs.
 */
export async function ensureSystemFacilitatorsGroup(programId) {
  return db.execute({
    sql: `INSERT INTO v2_groups (program_id, name, type, is_system)
                SELECT ?, 'Facilitators', 'facilitators', 1
                WHERE NOT EXISTS (
                  SELECT 1 FROM v2_groups WHERE program_id = ? AND UPPER(TRIM(name)) = 'FACILITATORS'
                )`,
    args: [programId, programId],
  });
}

/** Every v2 program, newest first. Used by GET /api/programs. */
export async function getAllPrograms() {
  return db.execute("SELECT * FROM v2_programs ORDER BY created_at DESC");
}

/** Program existence probe (SELECT id). Used by PUT /api/programs. */
export async function getProgramExists(id) {
  return db.execute({
    sql: "SELECT id FROM v2_programs WHERE id = ?",
    args: [id],
  });
}

/**
 * Dynamic field update — fieldsToUpdate/args are built by the controller
 * (whitelisted updatable columns), mirroring the original inline UPDATE.
 * Used by PUT /api/programs.
 */
export async function updateProgramFields(fieldsToUpdate, args) {
  return db.execute({
    sql: `UPDATE v2_programs SET ${fieldsToUpdate.join(", ")} WHERE id = ?`,
    args: args,
  });
}
