import db from "@/lib/db";

/**
 * Programs model — data access for the program-domain controllers:
 * `src/app/api/programs/route.js`,
 * `src/app/api/pm/programs/route.js`,
 * `src/app/api/pm/programs/[id]/route.js`,
 * `src/app/api/pm/programs/assignment/route.js`,
 * `src/app/api/pm/programs/templates/route.js`, and
 * `src/app/api/program-types/route.js`.
 *
 * Each function wraps exactly one SQL statement. SQL is byte-identical to the
 * queries that used to live inline in the controllers, so behavior is unchanged.
 * Where the original handlers ran the same query at multiple call sites, the
 * model keeps one function per call site (1:1 extraction — see the duplicated
 * facilitators-group/segment-sync helpers below, and docs/MVC_REFACTOR.md §4).
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 */

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

/**
 * Un-assign every family currently linked to the program except the ones still
 * in assignedSegments (placeholder list derived from the segment count).
 * Used by PUT /api/programs.
 */
export async function unassignFamiliesNotInList(programId, assignedSegments) {
  const placeholders = assignedSegments.map(() => "?").join(",");
  return db.execute({
    sql: `UPDATE families SET program_id = NULL WHERE program_id = ? AND id NOT IN (${placeholders})`,
    args: [programId, ...assignedSegments],
  });
}

/** Un-assign all families from a program. Used by PUT /api/programs. */
export async function unassignAllFamilies(programId) {
  return db.execute({
    sql: `UPDATE families SET program_id = NULL WHERE program_id = ?`,
    args: [programId],
  });
}

/** Link one family (by id) to a program. Used by PUT /api/programs. */
export async function assignFamilyToProgram(programId, familyId) {
  return db.execute({
    sql: `UPDATE families SET program_id = ? WHERE id = ?`,
    args: [programId, familyId],
  });
}

/** Family name lookup by id. Used by PUT /api/programs. */
export async function getFamilyNameById(familyId) {
  return db.execute({
    sql: `SELECT name FROM families WHERE id = ?`,
    args: [familyId],
  });
}

/** Contacts whose family group_name matches (case-insensitive). Used by PUT /api/programs. */
export async function getContactsByFamilyName(familyName) {
  return db.execute({
    sql: `SELECT cid, email FROM contacts WHERE UPPER(TRIM(group_name)) = UPPER(TRIM(?))`,
    args: [familyName],
  });
}

/** Enroll a contact in a program via participant_programs. Used by PUT /api/programs. */
export async function addParticipantProgramMembership(participantId, programId) {
  return db.execute({
    sql: `INSERT INTO participant_programs (participant_id, program_id, status, accepted_at)
                      VALUES (?, ?, 'active', NOW())
                      ON CONFLICT (participant_id, program_id) DO NOTHING`,
    args: [participantId, programId],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// /api/pm/programs — operational-intelligence list, full lifecycle (29 queries)
// ─────────────────────────────────────────────────────────────────────────────

/** Auto-activate planned programs whose start_date has passed. Used by GET. */
export async function autoActivatePlannedPrograms() {
  return db.execute({
    sql: "UPDATE v2_programs SET status = 'Active' WHERE status = 'Planned' AND start_date IS NOT NULL AND start_date <= CURRENT_DATE",
    args: [],
  });
}

/**
 * Basic program list scoped by archive/status filters, assigned-PM/assistant
 * membership and (for facilitators) program-staff assignment. Filter assembly
 * mirrors the original controller logic, so the executed SQL is byte-identical.
 * Used by GET /api/pm/programs.
 */
export async function listProgramsByManagementFilters({
  showAll,
  showArchived,
  status,
  assignedPmId,
  session,
}) {
  const args = [];

  // 1. Fetch Basic Programs
  let baseQuery = `
      SELECT p.*,
             c1.name as pm_name,
             c2.name as assistant_name,
             k.title as note_title
      FROM v2_programs p
      LEFT JOIN contacts c1 ON p.assigned_pm_id = c1.cid
      LEFT JOIN contacts c2 ON p.assigned_assistant_id = c2.cid
      LEFT JOIN v2_knowledge_bank k ON CAST(p.note_id AS TEXT) = CAST(k.id AS TEXT)
    `;

  if (showAll) {
    // No archive filter — show everything
    baseQuery += " WHERE 1=1";
  } else {
    const archiveVal = showArchived ? 1 : 0;
    args.push(archiveVal, archiveVal);
    baseQuery +=
      " WHERE (p.is_archived = ? OR (p.is_archived IS NULL AND ? = 0))";
  }

  if (status && status.toLowerCase() !== "all") {
    if (status.toLowerCase() === "active") {
      baseQuery += " AND (p.status ILIKE ? OR p.status IS NULL)";
    } else {
      baseQuery += " AND p.status ILIKE ?";
    }
    args.push(status);
  }
  if (assignedPmId) {
    baseQuery +=
      " AND (" +
      "p.assigned_pm_id = ?" +
      " OR p.assigned_assistant_id LIKE ?" +
      " OR p.id IN (SELECT program_id FROM v2_teams WHERE handler_id = ?)" +
      " OR p.id IN (SELECT program_id FROM v2_program_staff WHERE role = 'program_manager' AND (staff_id = ? OR LOWER(TRIM(staff_id)) = LOWER(?)))" +
      " OR p.id::text IN (SELECT context_id FROM contact_roles WHERE role = 'program_manager' AND context_type = 'program' AND is_current = true AND contact_cid = ?)" +
      ")";
    args.push(
      assignedPmId,
      `%${assignedPmId}%`,
      assignedPmId,
      session.cid,
      session.email || "",
      session.cid,
    );
  }
  // Facilitators only see programs they are assigned to (matched by cid or
  // email so legacy rows that stored the email still resolve correctly).
  if (session?.role === "facilitator") {
    baseQuery +=
      " AND p.id IN (SELECT program_id FROM v2_program_staff WHERE (staff_id = ? OR LOWER(TRIM(staff_id)) = LOWER(?)) AND role = 'facilitator')";
    args.push(session.cid, session.email || "");
  }
  baseQuery += " ORDER BY p.created_at DESC";

  return db.execute({ sql: baseQuery, args });
}

/** Sessions per program (count). Used by GET /api/pm/programs metrics. */
export async function countSessionsByProgram() {
  return db.execute(
    "SELECT program_id, COUNT(*) as count, 0 as completed FROM v2_sessions GROUP BY program_id",
  );
}

/** Active (deduped, non-facilitator) participants per program. Used by GET metrics. */
export async function countActiveParticipantsByProgram() {
  return db.execute(
    `SELECT program_id, COUNT(*) as count FROM (
             SELECT CAST(pp.program_id AS TEXT) AS program_id,
                    LOWER(COALESCE(c.email, pp.participant_id, '')) AS dedupe_key
             FROM participant_programs pp
             JOIN contacts c ON pp.participant_id = c.cid
             WHERE LOWER(COALESCE(c.status, '')) = 'active'
               AND c.deleted = 0 AND c.deleted_at IS NULL AND c.archived_at IS NULL
               AND NOT EXISTS (
                 SELECT 1 FROM v2_program_staff ps
                 WHERE CAST(ps.program_id AS TEXT) = CAST(pp.program_id AS TEXT)
                   AND ps.role = 'facilitator'
                   AND (ps.staff_id = c.cid OR LOWER(TRIM(ps.staff_id)) = LOWER(TRIM(c.email)))
               )
           ) t GROUP BY program_id`,
  );
}

/** Document requirements per program (count + completed). Used by GET metrics. */
export async function countDocumentRequirementsByProgram() {
  return db.execute(
    "SELECT program_id, COUNT(*) as count, SUM(is_completed) as completed FROM v2_document_requirements GROUP BY program_id",
  );
}

/** Weekly-report weeks per program (distinct). Used by GET metrics. */
export async function countReportWeeksByProgram() {
  return db.execute(
    "SELECT program_id, COUNT(DISTINCT week_number) as weeks FROM v2_weekly_reports GROUP BY program_id",
  );
}

/** Families linked to a program (id, program_id). Used by GET metrics. */
export async function getAssignedFamiliesByProgram() {
  return db.execute(
    "SELECT id, program_id FROM families WHERE program_id IS NOT NULL",
  );
}

/** Submissions per program (total + approved/completed). Used by GET metrics. */
export async function countSubmissionsByProgram() {
  return db.execute(
    "SELECT program_id, COUNT(*) as total, COUNT(CASE WHEN status = 'approved' OR status = 'completed' THEN 1 END) as approved FROM v2_submissions GROUP BY program_id",
  );
}

/** Facilitators (v2_program_staff role='facilitator') of one program. Used by GET. */
export async function getProgramFacilitators(programId) {
  return db.execute({
    sql: `SELECT ps.id, ps.staff_id, ps.role, ps.permissions, c.name, c.email
                FROM v2_program_staff ps
                LEFT JOIN contacts c ON ps.staff_id = c.cid OR LOWER(TRIM(c.email)) = LOWER(TRIM(ps.staff_id))
                WHERE CAST(ps.program_id AS TEXT) = ? AND ps.role = 'facilitator'`,
    args: [String(programId)],
  });
}

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
    sql: `INSERT INTO v2_programs (id, name, slug, description, concept_note, vision, objectives, expected_outcomes, success_metrics, program_type, visibility, language, note_id, assigned_pm_id, assigned_assistant_id, duration_weeks, status, is_archived, materials, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

/**
 * Full program update — all lifecycle/visibility columns plus materials,
 * grading config and facilitator defaults, keyed by id. Used by PUT /api/pm/programs.
 */
export async function updateProgram({
  id,
  name,
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
  status,
  is_archived,
  materials,
  start_date,
  end_date,
  grading_mode,
  facilitator_default_permissions,
  facilitator_scope,
}) {
  return db.execute({
    sql: `UPDATE v2_programs
                SET name = ?, description = ?, concept_note = ?, vision = ?, objectives = ?, expected_outcomes = ?, success_metrics = ?, program_type = ?, visibility = ?, language = ?, note_id = ?, assigned_pm_id = ?, assigned_assistant_id = ?, duration_weeks = ?, status = ?, is_archived = ?, materials = ?, start_date = ?, end_date = ?, grading_mode = ?, facilitator_default_permissions = ?, facilitator_scope = ?
                WHERE id = ?`,
    args: [
      name,
      description,
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
      duration_weeks || 4,
      status,
      is_archived,
      JSON.stringify(typeof materials === "string" ? JSON.parse(materials || "[]") : (materials || [])),
      start_date || null,
      end_date || null,
      grading_mode || "graded",
      JSON.stringify(facilitator_default_permissions || {}),
      facilitator_scope || "assigned_groups",
      id,
    ],
  });
}

/** Unlink every family currently assigned to a program (text-compared id). Used by PUT. */
export async function unlinkSegmentsFromProgram(programId) {
  return db.execute({
    sql: "UPDATE families SET program_id = NULL WHERE program_id IS NOT NULL AND program_id::text = ?",
    args: [String(programId)],
  });
}

/** Link a numeric-id family/segment to a program via a uuid cast. Used by PUT. */
export async function linkSegmentById(programId, segmentId) {
  return db.execute({
    sql: "UPDATE families SET program_id = ?::uuid WHERE id = ?",
    args: [String(programId), segmentId],
  });
}

/** Family name lookup by segment id. Used by PUT /api/pm/programs. */
export async function getSegmentFamilyName(segmentId) {
  return db.execute({
    sql: "SELECT name FROM families WHERE id = ?",
    args: [segmentId],
  });
}

/** Link a name-matched family/segment to a program via a uuid cast. Used by PUT. */
export async function linkSegmentByName(programId, segmentName) {
  return db.execute({
    sql: "UPDATE families SET program_id = ?::uuid WHERE UPPER(TRIM(name)) = UPPER(TRIM(?))",
    args: [String(programId), segmentName],
  });
}

/** Contacts whose family group_name matches (case-insensitive). Used by PUT. */
export async function getContactsByFamilyGroupName(familyName) {
  return db.execute({
    sql: "SELECT cid, email FROM contacts WHERE UPPER(TRIM(group_name)) = UPPER(TRIM(?))",
    args: [familyName],
  });
}

/** Enroll a contact in a program via participant_programs. Used by PUT. */
export async function addParticipantToProgram(participantId, programId) {
  return db.execute({
    sql: `INSERT INTO participant_programs (participant_id, program_id, status, accepted_at)
                          VALUES (?, ?, 'active', NOW())
                          ON CONFLICT (participant_id, program_id) DO NOTHING`,
    args: [participantId, programId],
  });
}

/** Protected-data count (participants/sessions/submissions/deliverables). Used by DELETE. */
export async function countProtectedProgramData(programId) {
  return db.execute({
    sql: `SELECT
              (SELECT COUNT(*) FROM participant_programs WHERE CAST(program_id AS TEXT) = ?) +
              (SELECT COUNT(*) FROM v2_sessions WHERE CAST(program_id AS TEXT) = ?) +
              (SELECT COUNT(*) FROM v2_submissions WHERE CAST(program_id AS TEXT) = ?) +
              (SELECT COUNT(*) FROM v2_deliverables WHERE CAST(program_id AS TEXT) = ?)
            AS protected_count`,
    args: [programId, programId, programId, programId],
  });
}

/** Permanent delete of an (unprotected) program. Used by DELETE /api/pm/programs. */
export async function deleteProgramById(id) {
  return db.execute({
    sql: "DELETE FROM v2_programs WHERE id = ?",
    args: [id],
  });
}

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

/** Ensure program_type_options exists (GET path). Used by GET /api/program-types. */
export async function ensureProgramTypeOptionsTable() {
  return db.execute(
    "CREATE TABLE IF NOT EXISTS program_type_options (id SERIAL PRIMARY KEY, type_key TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"
  );
}

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
