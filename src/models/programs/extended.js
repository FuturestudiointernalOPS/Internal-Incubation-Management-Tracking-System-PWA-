import db from "@/lib/db";

// ─────────────────────────────────────────────────────────────────────────────
// /api/pm/programs/[id] — program detail (3 queries)
// ─────────────────────────────────────────────────────────────────────────────

/** Full program row joined to PM/assistant/note titles. Used by GET [id]. */
export async function getProgramDetailById(id) {
  return db.execute({
    sql: `SELECT p.*, c1.name as pm_name, c2.name as assistant_name, k.title as note_title
          FROM v2_programs p
          LEFT JOIN contacts c1 ON p.assigned_pm_id = c1.cid
          LEFT JOIN contacts c2 ON p.assigned_assistant_id = c2.cid
          LEFT JOIN v2_knowledge_bank k ON p.note_id = CAST(k.id AS TEXT)
          WHERE p.id = ?`,
    args: [id],
  });
}

/**
 * Lazy-ensure the program-level Facilitators group exists (system-defined,
 * non-participant representation of the people in v2_program_staff).
 * Used by GET /api/pm/programs/[id].
 */
export async function ensureProgramFacilitatorsGroup(programId) {
  return db.execute({
    sql: `INSERT INTO v2_groups (program_id, name, type, is_system)
              SELECT ?, 'Facilitators', 'facilitators', 1
              WHERE NOT EXISTS (
                SELECT 1 FROM v2_groups
                WHERE program_id = ? AND UPPER(TRIM(name)) = 'FACILITATORS'
              )`,
    args: [String(programId), String(programId)],
  });
}

/** Facilitators (v2_program_staff role='facilitator') of one program. Used by GET [id]. */
export async function getFacilitatorsForProgram(programId) {
  return db.execute({
    sql: `SELECT ps.id, ps.staff_id, ps.role, ps.permissions, c.name, c.email
              FROM v2_program_staff ps
              LEFT JOIN contacts c ON ps.staff_id = c.cid OR LOWER(TRIM(c.email)) = LOWER(TRIM(ps.staff_id))
              WHERE CAST(ps.program_id AS TEXT) = ? AND ps.role = 'facilitator'`,
    args: [String(programId)],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// /api/pm/programs/assignment — PM/assistant assignment (1 query)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Assign/reassign a contact to the program's PM or assistant column; the
 * column name (whitelisted by the controller) is interpolated as in the
 * original handler. Used by PATCH /api/pm/programs/assignment.
 */
export async function updateProgramAssignmentColumn(column, contactCid, programId) {
  return db.execute({
    sql: `UPDATE v2_programs SET ${column} = ? WHERE id = ?`,
    args: [contactCid, programId],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// /api/pm/programs/templates — save / apply templates (6 queries)
// ─────────────────────────────────────────────────────────────────────────────

/** Template list (id/name/description/type/duration/created). Used by GET templates. */
export async function listProgramTemplates() {
  return db.execute({
    sql: "SELECT id, name, description, program_type, duration_weeks, created_at FROM v2_programs WHERE is_template = 1 ORDER BY name ASC",
    args: [],
  });
}

/** Full program row by id — source of a template save. Used by POST templates. */
export async function getProgramSourceById(programId) {
  return db.execute({
    sql: "SELECT * FROM v2_programs WHERE id = ?",
    args: [programId],
  });
}

/** Copy a program row into an is_template=1 program. Used by POST templates (save). */
export async function saveProgramAsTemplate(templateId, templateName, sourceProgram) {
  return db.execute({
    sql: `INSERT INTO v2_programs
          (id, name, description, concept_note, vision, objectives, program_type, visibility,
           language, duration_weeks, grading_mode,
           feedback_enabled, materials, is_template, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'template')`,
    args: [
      templateId,
      templateName,
      sourceProgram.description,
      sourceProgram.concept_note,
      sourceProgram.vision,
      sourceProgram.objectives,
      sourceProgram.program_type || "incubation",
      sourceProgram.visibility || "private",
      sourceProgram.language || "en",
      sourceProgram.duration_weeks || 4,
      sourceProgram.grading_mode || "graded",
      sourceProgram.feedback_enabled != null ? sourceProgram.feedback_enabled : 1,
      sourceProgram.materials,
    ],
  });
}

/** Template row lookup (is_template=1). Used by POST templates (apply). */
export async function getProgramTemplateById(templateId) {
  return db.execute({
    sql: "SELECT * FROM v2_programs WHERE id = ? AND is_template = 1",
    args: [templateId],
  });
}

/** Instantiate a 'Planned' program from a template row. Used by POST templates (apply). */
export async function createProgramFromTemplate(
  newId,
  name,
  startDate,
  endDate,
  assignedPmId,
  sourceProgram,
) {
  return db.execute({
    sql: `INSERT INTO v2_programs
          (id, name, description, concept_note, vision, objectives, program_type, visibility,
           language, duration_weeks, grading_mode,
           feedback_enabled, materials, start_date, end_date, assigned_pm_id, status, template_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Planned', ?)`,
    args: [
      newId,
      name,
      sourceProgram.description,
      sourceProgram.concept_note,
      sourceProgram.vision,
      sourceProgram.objectives,
      sourceProgram.program_type || "incubation",
      sourceProgram.visibility || "private",
      sourceProgram.language || "en",
      sourceProgram.duration_weeks || 4,
      sourceProgram.grading_mode || "graded",
      sourceProgram.feedback_enabled != null ? sourceProgram.feedback_enabled : 1,
      sourceProgram.materials,
      startDate || null,
      endDate || null,
      assignedPmId || null,
      sourceProgram.id,
    ],
  });
}

/**
 * Auto-create the system-defined Facilitators group for a program created
 * from a template. Used by POST templates (apply).
 */
export async function createFacilitatorsGroupForNewProgram(programId) {
  return db.execute({
    sql: `INSERT INTO v2_groups (program_id, name, type, is_system)
                SELECT ?, 'Facilitators', 'facilitators', 1
                WHERE NOT EXISTS (
                  SELECT 1 FROM v2_groups WHERE program_id = ? AND UPPER(TRIM(name)) = 'FACILITATORS'
                )`,
    args: [programId, programId],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// /api/program-types — custom program type options (4 queries)
// ─────────────────────────────────────────────────────────────────────────────

/** All custom type_keys, oldest first. Used by GET /api/program-types. */
export async function listProgramTypeKeys() {
  return db.execute({
    sql: "SELECT type_key FROM program_type_options ORDER BY created_at ASC",
    args: [],
  });
}

/** Ensure program_type_options exists (POST path). Used by POST /api/program-types. */
export async function createProgramTypeOptionsTable() {
  return db.execute(
    "CREATE TABLE IF NOT EXISTS program_type_options (id SERIAL PRIMARY KEY, type_key TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"
  );
}

/** Insert one custom type option (no-op on duplicate key). Used by POST /api/program-types. */
export async function createProgramTypeOption(typeKey) {
  return db.execute({
    sql: "INSERT INTO program_type_options (type_key, display_name) VALUES (?, ?) ON CONFLICT (type_key) DO NOTHING",
    args: [typeKey, typeKey.replace(/_/g, " ")],
  });
}

