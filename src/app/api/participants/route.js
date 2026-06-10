import { initDb } from "@/lib/db";
import db from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

/**
 * PARTICIPANTS API — ENROLLMENT ENGINE
 * Handles direct participant registration and contact credential sync.
 */

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["staff", "super_admin"]);
    if (authError) return authError;
    const body = await req.json();
    const { program_id, name, email, phone, screening_status } = body;

    if (!program_id || !name || !email) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    // 1. Fetch Program Details
    const progRes = await db.execute({
      sql: "SELECT name FROM v2_programs WHERE id = ?",
      args: [program_id],
    });
    const programName = progRes.rows[0]?.name || "Unassigned Program";

    // 2. Insert into V2 Participants (Standardized for Postgres)
    const result = await db.execute({
      sql: `INSERT INTO v2_participants (program_id, name, email, phone, screening_status)
             VALUES (?, ?, ?, ?, ?) RETURNING id`,
      args: [
        program_id,
        name,
        email,
        phone || null,
        screening_status || "applied",
      ],
    });

    const participantId = result.lastInsertRowid;

    // 3. FLEXIBLE SYNC: Upsert into V1 Contacts
    const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();
    const generatedPassword = `FSP${randomStr}`;

    await db.execute({
      sql: `INSERT INTO contacts (cid, name, email, phone, program_id, program_name, role, password)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(email) DO UPDATE SET
              name = EXCLUDED.name,
              phone = EXCLUDED.phone,
              program_id = EXCLUDED.program_id,
              program_name = EXCLUDED.program_name,
              role = EXCLUDED.role`,
      args: [
        `c-${Math.random().toString(36).substr(2, 9)}`,
        name,
        email,
        phone || null,
        program_id,
        programName,
        "participant",
        generatedPassword,
      ],
    });

    return NextResponse.json({
      success: true,
      participant: {
        id: participantId,
        program_id,
        name,
        email,
        phone,
        screening_status,
      },
    });
  } catch (error) {
    console.error("Participant POST Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(["staff", "super_admin"]);
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const program_id = searchParams.get("program_id");

    let sql = "SELECT * FROM v2_participants";
    let args = [];

    if (program_id) {
      sql += " WHERE program_id = ?";
      args.push(program_id);
    }

    sql += " ORDER BY created_at DESC";

    const { rows } = await db.execute({ sql, args });
    return NextResponse.json({ success: true, participants: rows });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
