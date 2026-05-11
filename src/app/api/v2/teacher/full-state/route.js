import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const cid = searchParams.get('cid');

    if (!cid) return NextResponse.json({ success: false, error: "Teacher CID required" });

    // Parallel Sub-System Sync
    const [progRes, teamRes, subRes, sesRes] = await Promise.all([
      db.execute({ 
        sql: "SELECT * FROM v2_programs WHERE assigned_assistant_id LIKE ? OR id IN (SELECT program_id FROM v2_teams WHERE handler_id = ?)", 
        args: [`%${cid}%`, cid] 
      }),
      db.execute({ 
        sql: "SELECT * FROM v2_teams WHERE handler_id = ?", 
        args: [cid] 
      }),
      db.execute({ 
        sql: `SELECT s.*, r.title as requirement_title, r.week_number, p.name as program_name
              FROM v2_submissions s 
              JOIN v2_document_requirements r ON s.requirement_id = r.id 
              JOIN v2_programs p ON s.program_id = p.id
              WHERE (p.assigned_assistant_id LIKE ? OR p.id IN (SELECT program_id FROM v2_teams WHERE handler_id = ?)) 
              AND s.status = 'pending'`, 
        args: [`%${cid}%`, cid] 
      }),
      db.execute({ 
        sql: `SELECT s.*, p.name as program_name 
              FROM v2_sessions s
              JOIN v2_programs p ON s.program_id = p.id
              WHERE (s.handler_id = ? OR p.assigned_assistant_id LIKE ? OR p.id IN (SELECT program_id FROM v2_teams WHERE handler_id = ?)) 
              AND s.scheduled_date IS NOT NULL`, 
        args: [cid, `%${cid}%`, cid] 
      })
    ]);

    return NextResponse.json({
      success: true,
      programs: progRes.rows,
      teams: teamRes.rows,
      submissions: subRes.rows,
      sessions: sesRes.rows
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
