import db from "@/lib/db";

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
