import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireVentureAccess } from "@/lib/ventureAuth";
import { notifyVentureFounders } from "@/lib/ventures";
import {
  getStandupForWeek,
  getVentureDbIdForStandups,
  insertVentureStandup,
  listVentureStandupsWithCreators,
} from "@/models/ventureWorkspace";

async function resolveVentureDbId(ventureId) {
  const r = await getVentureDbIdForStandups(ventureId);
  return r.rows?.[0]?.id || null;
}

const ROLES = ["participant","founder","staff","program_manager","super_admin","teacher","developer"];
const ALLOWED = ["participant","founder","staff","program_manager","super_admin","teacher"];

function getWeekNumber() {
  const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()+3-(d.getDay()+6)%7);
  const w = Math.ceil(((d - new Date(d.getFullYear(),0,4))/86400000+1)/7);
  return { week_number: w, year: new Date().getFullYear() };
}

export async function GET(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth(ROLES);
    if (authError) return authError;
    const { id } = await params;
    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
    const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

    const { week_number, year } = getWeekNumber();
    const cur = await getStandupForWeek(dbId, week_number, year);
    const r = await listVentureStandupsWithCreators(dbId);
    return NextResponse.json({ success: true, standups: r.rows || [], current_week_submitted: cur.rows?.length > 0, current_week: week_number, current_year: year });
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
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

    const { week_number, year, top_priorities, expected_deliverables, weekly_priorities } = await req.json();
    if (!week_number || !year) return NextResponse.json({ success: false, error: "week_number and year required" }, { status: 400 });
    try {
      await insertVentureStandup({ venture_id: dbId, week_number, year, top_priorities, expected_deliverables, weekly_priorities, created_by: session.cid });
      notifyVentureFounders(dbId, 'Weekly Standup Submitted', `The venture standup for week ${week_number}/${year} has been submitted.`);
    } catch(e) {
      if (e.message?.includes("UNIQUE") || e.message?.includes("unique")) {
        return NextResponse.json({ success: false, error: "Standup already exists for this week" }, { status: 409 });
      }
      throw e;
    }
    return NextResponse.json({ success: true });
  } catch(e) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }); }
}
