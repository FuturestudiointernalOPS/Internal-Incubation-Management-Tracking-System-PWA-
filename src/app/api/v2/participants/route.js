import { initDb } from "@/lib/db";
import db from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    await initDb();
    const body = await req.json();
    const { program_id, name, email, phone, screening_status } = body;

    if (!program_id || !name || !email) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const { lastInsertRowid } = await db.execute({
       sql: `INSERT INTO v2_participants (program_id, name, email, phone, screening_status) 
             VALUES (?, ?, ?, ?, ?)`,
       args: [program_id, name, email, phone || null, screening_status || 'applied']
    });

    return NextResponse.json({ 
       success: true, 
       participant: { id: Number(lastInsertRowid), id: Number(lastInsertRowid), program_id, name, email, phone, screening_status } 
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
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
