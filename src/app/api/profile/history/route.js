import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

function normalizeRole(role) {
  const r = String(role || "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_");

  if (r === "facilitator") return "facilitator";
  if (r === "participant") return "participant";
  if (r === "program_manager" || r === "pm" || r === "project_manager") {
    return "program_manager";
  }
  if (r === "assistant" || r === "program_assistant") return "assistant";
  return "staff";
}

function resolveStatus(program) {
  const archived =
    Number(program.is_archived) === 1 || program.is_archived === true;
  const raw = String(program.status || "").toLowerCase();
  if (
    archived ||
    ["completed", "archived", "closed", "ended", "past", "inactive"].includes(
      raw,
    )
  ) {
    return "completed";
  }
  return "active";
}

/**
 * GET /api/profile/history
 *
 * Derives a person's contextual program history without a new table. A single
 * contact can be a Participant in one program and a Facilitator / Program
 * Manager in another, so the response is a flat list of (program, role,
 * status) rows rather than one global role.
 */
export async function GET() {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
      );
    }

    const cid = session.cid;
    const email = session.email;

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
      const res = await db.execute({
        sql: `SELECT p.id, p.name, p.status, p.is_archived, p.start_date, p.end_date
              FROM participant_programs pp
              JOIN v2_programs p ON p.id::text = pp.program_id::text
              WHERE pp.participant_id::text = ?`,
        args: [cid],
      });
      res.rows.forEach((r) => addProgram(r, "participant"));
    } catch (_) {}

    // 2. Direct v2 participant enrollments (matched by email or user id).
    try {
      const res = await db.execute({
        sql: `SELECT p.id, p.name, p.status, p.is_archived, p.start_date, p.end_date
              FROM v2_participants vp
              JOIN v2_programs p ON p.id::text = vp.program_id::text
              WHERE vp.email = ? OR vp.user_id = ?`,
        args: [email, cid],
      });
      res.rows.forEach((r) => addProgram(r, "participant"));
    } catch (_) {}

    // 3. Facilitator / program staff assignments.
    try {
      const res = await db.execute({
        sql: `SELECT p.id, p.name, p.status, p.is_archived, p.start_date, p.end_date, ps.role
              FROM v2_program_staff ps
              JOIN v2_programs p ON p.id::text = ps.program_id::text
              WHERE ps.staff_id::text = ?`,
        args: [cid],
      });
      res.rows.forEach((r) => addProgram(r, normalizeRole(r.role)));
    } catch (_) {}

    // 4. Program Manager assignment.
    try {
      const res = await db.execute({
        sql: `SELECT id, name, status, is_archived, start_date, end_date
              FROM v2_programs
              WHERE assigned_pm_id = ?`,
        args: [cid],
      });
      res.rows.forEach((r) => addProgram(r, "program_manager"));
    } catch (_) {}

    // 5. Program Assistant assignment.
    try {
      const res = await db.execute({
        sql: `SELECT id, name, status, is_archived, start_date, end_date
              FROM v2_programs
              WHERE assigned_assistant_id = ?`,
        args: [cid],
      });
      res.rows.forEach((r) => addProgram(r, "assistant"));
    } catch (_) {}

    const history = Array.from(historyMap.values());

    return NextResponse.json({ success: true, history });
  } catch (error) {
    console.error("[Profile history] error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
