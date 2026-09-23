import db from "@/lib/db";

function normalizeRole(role) {
  const normalizedRole = String(role || "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_");

  if (normalizedRole === "facilitator") return "facilitator";
  if (normalizedRole === "participant") return "participant";
  if (normalizedRole === "program_manager" || normalizedRole === "pm" || normalizedRole === "project_manager") {
    return "program_manager";
  }
  if (normalizedRole === "assistant" || normalizedRole === "program_assistant") return "assistant";
  return "staff";
}

function resolveStatus(program) {
  const archived =
    Number(program.is_archived) === 1 || program.is_archived === true;
  const rawStatus = String(program.status || "").toLowerCase();
  if (
    archived ||
    ["completed", "archived", "closed", "ended", "past", "inactive"].includes(
      rawStatus,
    )
  ) {
    return "completed";
  }
  return "active";
}

/**
 * Derive a person's contextual program history without a new table. A single
 * contact can be a Participant in one program and a Facilitator / Program
 * Manager in another, so the response is a flat list of (program, role,
 * status) rows rather than one global role.
 *
 * Requires `initDb()` to have been called by the caller.
 */
export async function getProgramHistory({ cid, email }) {
  const historyMap = new Map();

  const addProgram = (program, role) => {
    if (!program || !program.id) return;
    const key = `${String(program.id)}::${role}`;

    const existing = historyMap.get(key);
    if (existing) {
      if (!existing.program_name && program.name) {
        existing.program_name = program.name;
      }
      if (!existing.start_date && program.start_date) {
        existing.start_date = program.start_date;
      }
      if (!existing.end_date && program.end_date) {
        existing.end_date = program.end_date;
      }
      return;
    }

    historyMap.set(key, {
      program_id: program.id,
      program_name: program.name || program.id,
      role,
      status: resolveStatus(program),
      start_date: program.start_date || null,
      end_date: program.end_date || null,
    });
  };

  // 1. Modern many-to-many participant assignments.
  try {
    const participantProgramResult = await db.execute({
      sql: `SELECT p.id, p.name, p.status, p.is_archived, p.start_date, p.end_date
            FROM participant_programs pp
            JOIN v2_programs p ON p.id::text = pp.program_id::text
            WHERE pp.participant_id::text = ?`,
      args: [cid],
    });
    participantProgramResult.rows.forEach((row) => addProgram(row, "participant"));
  } catch (_) {}

  // 2. Direct v2 participant enrollments (matched by email or user id).
  try {
    const v2ParticipantResult = await db.execute({
      sql: `SELECT p.id, p.name, p.status, p.is_archived, p.start_date, p.end_date
            FROM v2_participants vp
            JOIN v2_programs p ON p.id::text = vp.program_id::text
            WHERE vp.email = ? OR vp.user_id = ?`,
      args: [email, cid],
    });
    v2ParticipantResult.rows.forEach((row) => addProgram(row, "participant"));
  } catch (_) {}

  // 3. Facilitator / program staff assignments.
  try {
    const programStaffResult = await db.execute({
      sql: `SELECT p.id, p.name, p.status, p.is_archived, p.start_date, p.end_date, ps.role
            FROM v2_program_staff ps
            JOIN v2_programs p ON p.id::text = ps.program_id::text
            WHERE ps.staff_id::text = ?`,
      args: [cid],
    });
    programStaffResult.rows.forEach((row) => addProgram(row, normalizeRole(row.role)));
  } catch (_) {}

  // 4. Program Manager assignment.
  try {
    const programManagerResult = await db.execute({
      sql: `SELECT id, name, status, is_archived, start_date, end_date
            FROM v2_programs
            WHERE assigned_pm_id = ?`,
      args: [cid],
    });
    programManagerResult.rows.forEach((row) => addProgram(row, "program_manager"));
  } catch (_) {}

  // 5. Program Assistant assignment.
  try {
    const assistantResult = await db.execute({
      sql: `SELECT id, name, status, is_archived, start_date, end_date
            FROM v2_programs
            WHERE assigned_assistant_id = ?`,
      args: [cid],
    });
    assistantResult.rows.forEach((row) => addProgram(row, "assistant"));
  } catch (_) {}

  return Array.from(historyMap.values());
}
