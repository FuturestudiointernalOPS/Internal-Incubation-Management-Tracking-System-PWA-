import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ success: false, error: "ID required" });

    // Parallel Database Execution on the EDGE/Cloud
    const [progRes, parRes, teamRes, sesRes, staffRes, eventRes, kpiRes, docRes, folRes] = await Promise.all([
      db.execute({ 
        sql: `SELECT p.*, 
                     k.title as note_title, k.url as note_files, k.description as note_description,
                     c.name as pm_name,
                     (SELECT 
                        ( (COUNT(CASE WHEN s.status = 'completed' THEN 1 END) * 5.0) + 
                          (IFNULL((SELECT SUM(is_completed) * 2.0 FROM v2_document_requirements WHERE program_id = p.id), 0)) +
                          (IFNULL((SELECT COUNT(DISTINCT week_number) * 10.0 FROM v2_weekly_reports WHERE program_id = p.id), 0))
                        ) / 
                        ( (COUNT(s.id) * 5.0 + IFNULL((SELECT COUNT(*) * 2.0 FROM v2_document_requirements WHERE program_id = p.id), 0)) + (p.duration_weeks * 10.0) + 0.0001
                        ) * 100.0
                      FROM v2_sessions s WHERE s.program_id = p.id
                     ) as completion_index
              FROM v2_programs p 
              LEFT JOIN v2_knowledge_bank k ON p.note_id = k.id 
              LEFT JOIN contacts c ON p.assigned_pm_id = c.cid
              WHERE p.id = ?`, 
        args: [id] 
      }),
      db.execute({ sql: "SELECT * FROM v2_participants WHERE program_id = ?", args: [id] }),
      db.execute({ sql: "SELECT * FROM v2_teams WHERE program_id = ?", args: [id] }),
      db.execute({ sql: "SELECT * FROM v2_sessions WHERE program_id = ?", args: [id] }),
      db.execute({ sql: "SELECT cid, name, role FROM contacts WHERE role IN ('teacher', 'staff', 'admin') AND deleted = 0", args: [] }),
      db.execute({ sql: "SELECT * FROM v2_events WHERE program_id = ?", args: [id] }),
      db.execute({ sql: "SELECT * FROM v2_kpis WHERE program_id = ?", args: [id] }),
      db.execute({ sql: "SELECT * FROM v2_document_requirements WHERE program_id = ?", args: [id] }),
      db.execute({ sql: "SELECT * FROM v2_followups WHERE program_id = ? ORDER BY created_at DESC", args: [id] })
    ]);

    const program = progRes.rows[0];
    if (program) {
      try {
        program.materials = JSON.parse(program.materials || '[]');
        program.note_files = JSON.parse(program.note_files || '[]');
      } catch (e) {
        program.materials = [];
        program.note_files = [];
      }
    }

    return NextResponse.json({
      success: true,
      program: program,
      participants: parRes.rows,
      teams: teamRes.rows,
      sessions: sesRes.rows,
      staffList: staffRes.rows,
      events: eventRes.rows,
      kpis: kpiRes.rows,
      documents: docRes.rows,
      followups: folRes.rows
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
