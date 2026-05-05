import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    const groupName = searchParams.get('group_name');

    if (!email || !groupName) return NextResponse.json({ success: false, error: "Email and Group Name required" });

    // Parallel Cluster Fetch
    const [progRes, subRes, sesRes, notRes, kpiRes, docRes, folRes, teamRes] = await Promise.all([
      db.execute({ sql: "SELECT * FROM v2_programs WHERE name = ?", args: [groupName] }),
      db.execute({ sql: "SELECT * FROM v2_submissions WHERE participant_id = ?", args: [email] }),
      db.execute({ sql: "SELECT * FROM v2_sessions WHERE program_id = ?", args: [groupName] }),
      db.execute({ sql: "SELECT * FROM v2_notifications WHERE recipient_id = ? ORDER BY created_at DESC", args: [email] }),
      db.execute({ sql: "SELECT * FROM v2_kpis WHERE program_id = ?", args: [groupName] }),
      db.execute({ sql: "SELECT * FROM v2_document_requirements WHERE program_id = ?", args: [groupName] }),
      db.execute({ sql: "SELECT * FROM v2_followups WHERE program_id = ? ORDER BY created_at DESC LIMIT 3", args: [groupName] }),
      db.execute({ 
         sql: "SELECT t.* FROM v2_teams t JOIN contacts c ON c.cid = t.handler_id WHERE c.group_name = ? LIMIT 1", 
         args: [groupName] 
      }) // Mock team link logic
    ]);

    return NextResponse.json({
      success: true,
      program: progRes.rows[0],
      submissions: subRes.rows,
      sessions: sesRes.rows,
      notifications: notRes.rows,
      kpis: kpiRes.rows,
      documents: docRes.rows,
      followups: folRes.rows,
      team: teamRes.rows[0]
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
