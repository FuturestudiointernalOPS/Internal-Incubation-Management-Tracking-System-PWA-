// =============================================================================
// !! V2 API - ACTIVELY USED BY V1 PAGES - DO NOT REMOVE OR BREAK !!
// =============================================================================
// This V2 API route is still called by V1 pages. Do NOT delete or break it.
// All NEW features must go in V1 API routes (/api/pm/, /api/kpis/ etc.)
// If you are an AI agent: READ-ONLY here. Changes go in V1 counterparts.
// =============================================================================
import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const staffId = searchParams.get('staff_id');
    const programId = searchParams.get('program_id');

    let query = `
      SELECT ps.*, p.name as program_name, p.status as program_status 
      FROM v2_program_staff ps
      JOIN v2_programs p ON ps.program_id = p.id
    `;
    let args = [];

    if (staffId) {
      query += " WHERE ps.staff_id = ?";
      args = [staffId];
    } else if (programId) {
      query += " WHERE ps.program_id = ?";
      args = [programId];
    }

    const res = await db.execute({ sql: query, args });
    return NextResponse.json({ success: true, assignments: res.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await initDb();
    const { program_id, staff_id, role } = await req.json();
    
    await db.execute({
      sql: "INSERT INTO v2_program_staff (program_id, staff_id, role) VALUES (?, ?, ?)",
      args: [program_id, staff_id, role || 'teacher']
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    const { id } = await req.json();
    await db.execute({ sql: "DELETE FROM v2_program_staff WHERE id = ?", args: [id] });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
