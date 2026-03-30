import { initDb } from "@/lib/db";
import db from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    await initDb();
    const body = await req.json();
    const { program_id, name, project_description } = body;

    if (!program_id || !name) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const { lastInsertRowid } = await db.execute({
       sql: `INSERT INTO v2_groups (program_id, name, project_description) 
             VALUES (?, ?, ?)`,
       args: [program_id, name, project_description || null]
    });

    return NextResponse.json({ 
       success: true, 
       group: { id: Number(lastInsertRowid), program_id, name, project_description } 
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

    let sql = "SELECT * FROM v2_groups";
    let args = [];
    
    if (program_id) {
       sql += " WHERE program_id = ?";
       args.push(program_id);
    }
    
    sql += " ORDER BY created_at DESC";

    const { rows } = await db.execute({ sql, args });
    return NextResponse.json({ success: true, groups: rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
