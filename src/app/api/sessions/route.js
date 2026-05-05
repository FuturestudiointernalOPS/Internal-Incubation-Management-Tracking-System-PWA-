import { initDb } from "@/lib/db";
import db from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    await initDb();
    const body = await req.json();
    const { program_id, title, week_number, type, teacher_id, start_at } = body;

    if (!program_id || !title) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const res = await db.execute({
      sql: `INSERT INTO v2_sessions (program_id, title, week_number, type, teacher_id, start_at) 
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        program_id, 
        title, 
        week_number || 1, 
        type || 'Masterclass', 
        teacher_id || null, 
        start_at || null
      ]
    });

    return NextResponse.json({ 
      success: true, 
      session: { id: Number(res.lastInsertRowid), program_id, title, week_number, type, teacher_id } 
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const program_id = searchParams.get('program_id');

    let sql = "SELECT * FROM v2_sessions";
    let args = [];
    
    if (program_id) {
       sql += " WHERE program_id = ?";
       args.push(program_id);
    }
    
    sql += " ORDER BY week_number ASC";

    const { rows } = await db.execute({ sql, args });
    return NextResponse.json({ success: true, sessions: rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
