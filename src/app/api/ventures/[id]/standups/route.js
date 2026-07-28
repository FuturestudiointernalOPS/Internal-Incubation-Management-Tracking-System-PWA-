import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireVentureAccess } from "@/lib/ventureAuth";

async function resolveVentureDbId(ventureId) {
  const r = await db.execute({ sql: "SELECT id FROM ventures WHERE venture_id = ?", args: [ventureId] });
  return r.rows?.[0]?.id || null;
}

const ROLES = ["participant","staff","program_manager","super_admin","teacher","developer"];
const ALLOWED = ["participant","staff","program_manager","super_admin","teacher"];

export async function GET(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth(ROLES);
    if (authError) return authError;
    const { id } = await params;
    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
    const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    const r = await db.execute({
      sql: `SELECT vs.*, c.name as creator_name FROM venture_standups vs LEFT JOIN contacts c ON vs.created_by = c.cid WHERE vs.venture_id = ? ORDER BY vs.year DESC, vs.week_number DESC`,
      args: [dbId],
    });
    return NextResponse.json({ success: true, standups: r.rows || [] });
  } catch(e) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }); }
}

export async function POST(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth(ALLOWED);
    if (authError) return authError;
    const { id } = await params;
    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
    const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    const { week_number, year, top_priorities, expected_deliverables, weekly_priorities } = await req.json();
    if (!week_number || !year) return NextResponse.json({ success: false, error: "week_number and year required" }, { status: 400 });
    try {
      await db.execute({
        sql: "INSERT INTO venture_standups (venture_id, week_number, year, top_priorities, expected_deliverables, weekly_priorities, created_by) VALUES (?,?,?,?,?,?,?)",
        args: [dbId, week_number, year, top_priorities||null, expected_deliverables||null, weekly_priorities||null, session.cid],
      });
    } catch(e) {
      if (e.message?.includes("UNIQUE") || e.message?.includes("unique")) {
        return NextResponse.json({ success: false, error: "Standup already exists for this week" }, { status: 409 });
      }
      throw e;
    }
    return NextResponse.json({ success: true });
  } catch(e) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }); }
}
