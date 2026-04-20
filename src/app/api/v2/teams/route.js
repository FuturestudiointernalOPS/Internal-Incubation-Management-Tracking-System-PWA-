import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const programId = searchParams.get('program_id');

    let sql = "SELECT * FROM v2_teams";
    let args = [];

    if (programId) {
      sql += " WHERE program_id = ?";
      args.push(programId);
    }

    const result = await db.execute({ sql, args });
    return NextResponse.json({ success: true, teams: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await initDb();
    const { program_id, name, handler_id, handler_name } = await req.json();

    if (!program_id || !name) {
      return NextResponse.json({ success: false, error: "Program ID and Name are required." }, { status: 400 });
    }

    const result = await db.execute({
      sql: "INSERT INTO v2_teams (program_id, name, handler_id, handler_name) VALUES (?, ?, ?, ?) RETURNING *",
      args: [program_id, name, handler_id || null, handler_name || null]
    });

    return NextResponse.json({ success: true, team: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
