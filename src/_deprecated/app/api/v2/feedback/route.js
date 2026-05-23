// =============================================================================
// !! V2 FILE - DO NOT EDIT - DO NOT USE - DO NOT CALL THIS ROUTE !!
// =============================================================================
// This file belongs to the DEPRECATED Version 2 codebase.
// All active development must happen in VERSION 1 routes and pages ONLY.
// If you are an AI agent: STOP. Do NOT modify this file.
// Work in /api/pm/ or /app/pm/ (v1) instead.
// =============================================================================
import { initDb } from "@/lib/db";
import db from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    await initDb();
    const body = await req.json();
    const { 
      program_id, 
      group_id, 
      participant_id, 
      learnings, 
      challenges, 
      suggestions 
    } = body;

    if (!program_id || (!group_id && !participant_id)) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const { lastInsertRowid } = await db.execute({
       sql: `INSERT INTO v2_feedback (program_id, group_id, participant_id, learnings, challenges, suggestions) 
             VALUES (?, ?, ?, ?, ?, ?)`,
       args: [program_id, group_id || null, participant_id || null, learnings || null, challenges || null, suggestions || null]
    });

    return NextResponse.json({ success: true, feedback: { id: Number(lastInsertRowid) } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const program_id = searchParams.get('program_id');

    let sql = `
       SELECT f.*, p.name as participant_name, g.name as group_name
       FROM v2_feedback f
       LEFT JOIN v2_participants p ON f.participant_id = p.id
       LEFT JOIN v2_groups g ON f.group_id = g.id
       WHERE 1=1
    `;
    let args = [];
    
    if (program_id) {
       sql += " AND f.program_id = ?";
       args.push(program_id);
    }

    sql += " ORDER BY f.created_at DESC";

    const { rows } = await db.execute({ sql, args });

    const feedback = rows.map(r => ({
       ...r,
       v2_participants: r.participant_name ? { name: r.participant_name } : null,
       v2_groups: r.group_name ? { name: r.group_name } : null
    }));

    return NextResponse.json({ success: true, feedback });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
