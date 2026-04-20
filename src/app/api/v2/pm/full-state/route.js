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
      db.execute({ sql: "SELECT * FROM v2_programs WHERE id = ?", args: [id] }),
      db.execute({ sql: "SELECT * FROM v2_participants WHERE program_id = ?", args: [id] }),
      db.execute({ sql: "SELECT * FROM v2_teams WHERE program_id = ?", args: [id] }),
      db.execute({ sql: "SELECT * FROM v2_sessions WHERE program_id = ?", args: [id] }),
      db.execute({ sql: "SELECT cid, name, role FROM contacts WHERE role IN ('teacher', 'staff', 'admin') AND deleted = 0", args: [] }),
      db.execute({ sql: "SELECT * FROM v2_events WHERE program_id = ?", args: [id] }),
      db.execute({ sql: "SELECT * FROM v2_kpis WHERE program_id = ?", args: [id] }),
      db.execute({ sql: "SELECT * FROM v2_document_requirements WHERE program_id = ?", args: [id] }),
      db.execute({ sql: "SELECT * FROM v2_followups WHERE program_id = ? ORDER BY created_at DESC", args: [id] })
    ]);

    return NextResponse.json({
      success: true,
      program: progRes.rows[0],
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
