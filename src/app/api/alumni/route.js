import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

/**
 * ALUMNI API (Ticket 6.5 — Alumni Engagement)
 *
 * GET  /api/alumni
 *   - Returns all alumni records
 *
 * GET  /api/alumni?participant_id=X
 *   - Returns a specific alumni record
 *
 * POST /api/alumni
 *   - Creates or updates an alumni record
 *   - Body: { participant_id, participant_name, participant_email,
 *             graduated_program_id, graduated_program_name, status, notes }
 */

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth([
      "staff",
      "super_admin",
      "program_manager",
      "teacher",
      "participant",
    ]);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const participantId = searchParams.get("participant_id");

    let sql = "SELECT * FROM alumni_records";
    const args = [];

    if (participantId) {
      sql += " WHERE participant_id = ?";
      args.push(participantId);
    }
    sql += " ORDER BY alumni_since DESC";

    const result = await db.execute({ sql, args });
    return NextResponse.json({ success: true, alumni: result.rows });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["staff", "super_admin", "program_manager"]);
    if (authError) return authError;

    const {
      participant_id,
      participant_name,
      participant_email,
      graduated_program_id,
      graduated_program_name,
      status,
      notes,
    } = await req.json();

    if (!participant_id) {
      return NextResponse.json(
        { success: false, error: "participant_id is required" },
        { status: 400 },
      );
    }

    const result = await db.execute({
      sql: `INSERT INTO alumni_records
            (participant_id, participant_name, participant_email,
             graduated_program_id, graduated_program_name, status, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (participant_id)
            DO UPDATE SET
              participant_name = EXCLUDED.participant_name,
              participant_email = EXCLUDED.participant_email,
              graduated_program_id = EXCLUDED.graduated_program_id,
              graduated_program_name = EXCLUDED.graduated_program_name,
              status = EXCLUDED.status,
              notes = EXCLUDED.notes
            RETURNING *`,
      args: [
        participant_id,
        participant_name || null,
        participant_email || null,
        graduated_program_id || null,
        graduated_program_name || null,
        status || "active",
        notes || null,
      ],
    });

    return NextResponse.json({ success: true, alumni: result.rows[0] });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
