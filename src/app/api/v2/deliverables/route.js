import { initDb } from "@/lib/db";
import db from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    await initDb();
    const body = await req.json();
    const { program_id, title, description, week_number, type } = body;

    if (!program_id || !title) {
       return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const { lastInsertRowid } = await db.execute({
       sql: `INSERT INTO v2_deliverables (program_id, title, description, week_number, type) 
             VALUES (?, ?, ?, ?, ?)`,
       args: [program_id, title, description || null, week_number || 1, type || 'Group']
    });

    return NextResponse.json({ 
       success: true, 
       deliverable: { id: Number(lastInsertRowid), program_id, title, description, week_number, type } 
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const program_id = searchParams.get('program_id');

    let sql = "SELECT * FROM v2_deliverables";
    let args = [];
    
    if (program_id) {
       sql += " WHERE program_id = ?";
       args.push(program_id);
    }
    
    sql += " ORDER BY week_number ASC";

    const { rows } = await db.execute({ sql, args });
    return NextResponse.json({ success: true, deliverables: rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
