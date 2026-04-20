import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const cid = searchParams.get('cid');

    if (!cid) return NextResponse.json({ success: false, error: "Teacher CID required" });

    // Parallel Sub-System Sync
    const [teamRes, subRes, sesRes] = await Promise.all([
      db.execute({ sql: "SELECT * FROM v2_teams WHERE handler_id = ?", args: [cid] }),
      db.execute({ 
        sql: `SELECT s.*, r.title as requirement_title, r.week_number 
              FROM v2_submissions s 
              JOIN v2_document_requirements r ON s.requirement_id = r.id 
              JOIN v2_teams t ON s.program_id = t.program_id
              WHERE t.handler_id = ? AND s.status = 'pending'`, 
        args: [cid] 
      }),
      db.execute({ sql: "SELECT * FROM v2_events WHERE created_by = ? OR location LIKE ?", args: [cid, `%${cid}%`] })
    ]);

    return NextResponse.json({
      success: true,
      teams: teamRes.rows,
      submissions: subRes.rows,
      sessions: sesRes.rows
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
