import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
export const dynamic = "force-dynamic";

/**
 * PARTICIPANT-PROGRAMS API
 * Manages many-to-many relationship between participants and programs.
 *
 * GET    /api/participant-programs?participant_id=X  — Get all programs for a participant
 * POST   /api/participant-programs                   — Add participant to program(s)
 * DELETE /api/participant-programs                   — Remove participant from a program
 */

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth([
      "staff",
      "super_admin",
      "program_manager",
      "teacher",
    ]);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const participantId = searchParams.get("participant_id");
    const programId = searchParams.get("program_id");

    let sql = `
      SELECT pp.*, p.name AS program_name, p.status AS program_status
      FROM participant_programs pp
      LEFT JOIN v2_programs p ON pp.program_id = p.id
      WHERE 1=1
    `;
    const args = [];

    if (participantId) {
      sql += " AND pp.participant_id = ?";
      args.push(participantId);
    }

    if (programId) {
      sql += " AND pp.program_id = ?";
      args.push(programId);
    }

    sql += " ORDER BY pp.assigned_at DESC";

    const result = await db.execute({ sql, args });
    return NextResponse.json({ success: true, assignments: result.rows });
  } catch (error) {
    console.error("GET participant-programs error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth([
      "staff",
      "super_admin",
      "program_manager",
    ]);
    if (authError) return authError;

    const body = await req.json();
    const { participant_id, program_ids, assigned_by, source } = body;

    if (
      !participant_id ||
      !program_ids ||
      !Array.isArray(program_ids) ||
      program_ids.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "participant_id and program_ids (non-empty array) are required.",
        },
        { status: 400 },
      );
    }

    // Verify all programs exist before assigning
    for (const pid of program_ids) {
      const check = await db.execute({
        sql: "SELECT id FROM v2_programs WHERE id = ?",
        args: [pid],
      });
      if (check.rows.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Program "${pid}" not found. Create it first before assigning.`,
          },
          { status: 404 },
        );
      }
    }

    const results = [];
    const errors = [];

    for (const program_id of program_ids) {
      try {
        await db.execute({
          sql: `INSERT INTO participant_programs (participant_id, program_id, assigned_by, source)
                VALUES (?, ?, ?, ?)
                ON CONFLICT (participant_id, program_id) DO NOTHING`,
          args: [
            participant_id,
            program_id,
            assigned_by || null,
            source || "manual",
          ],
        });

        // Audit log
        await db.execute({
          sql: `INSERT INTO participant_program_audit (participant_id, program_id, action, performed_by, source)
                VALUES (?, ?, 'assigned', ?, ?)`,
          args: [
            participant_id,
            program_id,
            assigned_by || null,
            source || "manual",
          ],
        });

        results.push(program_id);
      } catch (err) {
        console.error(
          `Error assigning participant ${participant_id} to program ${program_id}:`,
          err.message,
        );
        errors.push({ program_id, error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      assigned: results,
      errors,
    });
  } catch (error) {
    console.error("POST participant-programs error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    const authError = await requireAuth([
      "staff",
      "super_admin",
      "program_manager",
    ]);
    if (authError) return authError;

    const body = await req.json();
    const { participant_id, program_id } = body;

    if (!participant_id || !program_id) {
      return NextResponse.json(
        {
          success: false,
          error: "participant_id and program_id are required.",
        },
        { status: 400 },
      );
    }

    const result = await db.execute({
      sql: "DELETE FROM participant_programs WHERE participant_id = ? AND program_id = ?",
      args: [participant_id, program_id],
    });

    // Audit log
    await db.execute({
      sql: `INSERT INTO participant_program_audit (participant_id, program_id, action, performed_by, source)
            VALUES (?, ?, 'removed', ?, 'manual')`,
      args: [participant_id, program_id, body.assigned_by || null],
    });

    return NextResponse.json({
      success: true,
      rowsAffected: result.rowsAffected,
    });
  } catch (error) {
    console.error("DELETE participant-programs error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
