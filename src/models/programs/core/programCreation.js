import db from "@/lib/db";

/** Ensure v2_programs has the slug column. Used by POST /api/pm/programs. */
export async function addProgramSlugColumn() {
  return db.execute({
    sql: "ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS slug TEXT",
    args: [],
  });
}

/** Ensure v2_programs has the expected_outcomes column. Used by POST. */
export async function addProgramExpectedOutcomesColumn() {
  return db.execute({
    sql: "ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS expected_outcomes TEXT",
    args: [],
  });
}

/** Ensure v2_programs has the success_metrics column. Used by POST. */
export async function addProgramSuccessMetricsColumn() {
  return db.execute({
    sql: "ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS success_metrics TEXT",
    args: [],
  });
}

/** Non-archived program with an exactly matching (case-insensitive) name. Used by POST. */
export async function findProgramByExactName(name) {
  return db.execute({
    sql: "SELECT id FROM v2_programs WHERE LOWER(name) = LOWER(?) AND is_archived = 0",
    args: [name],
  });
}

/**
 * Full program create (id/slug supplied by the controller) with all lifecycle
 * columns, status 'Planned'. Used by POST /api/pm/programs.
 */
export async function createProgram({
  id,
  name,
  slug,
  description,
  concept_note,
  vision,
  objectives,
  expected_outcomes,
  success_metrics,
  program_type,
  visibility,
  language,
  note_id,
  assigned_pm_id,
  assigned_assistant_id,
  duration_weeks,
  materials,
  start_date,
  end_date,
}) {
  return db.execute({
    sql: `INSERT INTO v2_programs (id, name, slug, description, concept_note, vision, objectives, expected_outcomes, success_metrics, program_type, visibility, language, note_id, assigned_pm_id, assigned_assistant_id, duration_weeks, status, is_archived, materials, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      name,
      slug,
      description || null,
      concept_note || null,
      vision || null,
      objectives || null,
      expected_outcomes || null,
      success_metrics || null,
      program_type || "incubation",
      visibility || "private",
      language || "en",
      note_id || null,
      assigned_pm_id || null,
      assigned_assistant_id || null,
      parseInt(duration_weeks) || 4,
      "Planned",
      0,
      materials ? JSON.stringify(materials) : null,
      start_date || null,
      end_date || null,
    ],
  });
}

/**
 * Auto-create the system-defined Facilitators group for a new program.
 * Used by POST /api/pm/programs.
 */
export async function createSystemFacilitatorsGroup(programId) {
  return db.execute({
    sql: `INSERT INTO v2_groups (program_id, name, type, is_system)
                SELECT ?, 'Facilitators', 'facilitators', 1
                WHERE NOT EXISTS (
                  SELECT 1 FROM v2_groups WHERE program_id = ? AND UPPER(TRIM(name)) = 'FACILITATORS'
                )`,
    args: [programId, programId],
  });
}

/** Link a numeric-id family/segment to a program. Used by POST /api/pm/programs. */
export async function assignSegmentById(programId, segmentId) {
  return db.execute({
    sql: "UPDATE families SET program_id = ? WHERE id = ?",
    args: [programId, segmentId],
  });
}

/** Link a name-matched family/segment to a program. Used by POST /api/pm/programs. */
export async function assignSegmentByName(programId, segmentName) {
  return db.execute({
    sql: "UPDATE families SET program_id = ? WHERE UPPER(TRIM(name)) = UPPER(TRIM(?))",
    args: [programId, segmentName],
  });
}

/** Insert one KPI for a program. Used by POST /api/pm/programs. */
export async function createProgramKpi(programId, title, targetValue) {
  return db.execute({
    sql: "INSERT INTO v2_kpis (program_id, title, target_value) VALUES (?, ?, ?)",
    args: [programId, title, targetValue || 80],
  });
}

/** Program row (id + assigned_pm_id) — existence + previous-PM probe. Used by PUT. */
export async function getProgramWithAssignedPm(id) {
  return db.execute({
    sql: "SELECT id, assigned_pm_id FROM v2_programs WHERE id = ?",
    args: [id],
  });
}

/** Quick archive/unarchive toggle (is_archived + status) by id. Used by PUT. */
export async function setProgramArchiveState(isArchived, status, id) {
  return db.execute({
    sql: "UPDATE v2_programs SET is_archived = ?, status = ? WHERE id = ?",
    args: [isArchived, status, id],
  });
}
