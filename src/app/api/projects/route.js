import { NextResponse } from "next/server";
import db, { initDb } from "@/lib/db";

export async function POST(req) {
  try {
    await initDb();
    const body = await req.json();
    const { 
      program_id, 
      name, 
      status, 
      type, 
      concept_note, 
      assigned_pm_id 
    } = body;

    if (!program_id || !name) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const meta = JSON.stringify({ type, concept_note, assigned_pm_id });
    
    const result = await db.execute({
      sql: 'INSERT INTO v2_projects (program_id, name, status, meta) VALUES (?, ?, ?, ?)',
      args: [program_id, name, status || 'Active', meta]
    });

    return NextResponse.json({ success: true, project_id: result.lastInsertRowid });
  } catch (error) {
    console.error("Project Save Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const program_id = searchParams.get('program_id');

    let query = `
      SELECT p.*, pr.name as program_name 
      FROM v2_projects p
      LEFT JOIN v2_programs pr ON p.program_id = pr.id
    `;
    let args = [];

    if (program_id) {
       query += " WHERE p.program_id = ?";
       args.push(program_id);
    }

    query += " ORDER BY p.created_at DESC";

    const result = await db.execute({ sql: query, args });

    // Parse meta JSON for each project
    const projects = result.rows.map(row => ({
      ...row,
      meta: row.meta ? JSON.parse(row.meta) : {}
    }));

    return NextResponse.json({ success: true, projects });
  } catch (error) {
    console.error("Project Fetch Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
