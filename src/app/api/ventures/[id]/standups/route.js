import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { notifyVentureFounders } from "@/lib/ventures";
import {
  getStandupForWeek,
  getVentureDbIdForStandups,
  insertVentureStandup,
  listVentureStandupsWithCreators,
} from "@/models/ventureWorkspace";

async function resolveVentureDbId(ventureId) {
  const ventureResult = await getVentureDbIdForStandups(ventureId);
  return ventureResult.rows?.[0]?.id || null;
}


function getWeekNumber() {
  const date = new Date(); date.setHours(0,0,0,0); date.setDate(date.getDate()+3-(date.getDay()+6)%7);
  const weekNumber = Math.ceil(((date - new Date(date.getFullYear(),0,4))/86400000+1)/7);
  return { week_number: weekNumber, year: new Date().getFullYear() };
}

export async function GET(req, { params }) {
  try {
    await initDb();
    const { id } = await params;
    const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "view" });
    if (access.error) return access.error;
    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });


    const { week_number, year } = getWeekNumber();
    const currentStandup = await getStandupForWeek(dbId, week_number, year);
    const standupsResult = await listVentureStandupsWithCreators(dbId);
    return NextResponse.json({ success: true, standups: standupsResult.rows || [], current_week_submitted: currentStandup.rows?.length > 0, current_week: week_number, current_year: year });
  } catch(error) { return NextResponse.json({ success: false, error: error.message }, { status: 500 }); }
}

export async function POST(req, { params }) {
  try {
    await initDb();
    const { id } = await params;
    const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "edit" });
    if (access.error) return access.error;
    const { session } = access;
    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });


    const { week_number, year, top_priorities, expected_deliverables, weekly_priorities } = await req.json();
    if (!week_number || !year) return NextResponse.json({ success: false, error: "week_number and year required" }, { status: 400 });
    try {
      await insertVentureStandup({ venture_id: dbId, week_number, year, top_priorities, expected_deliverables, weekly_priorities, created_by: session.cid });
      notifyVentureFounders(dbId, 'Weekly Standup Submitted', `The venture standup for week ${week_number}/${year} has been submitted.`);
    } catch(error) {
      if (error.message?.includes("UNIQUE") || error.message?.includes("unique")) {
        return NextResponse.json({ success: false, error: "Standup already exists for this week" }, { status: 409 });
      }
      throw error;
    }
    return NextResponse.json({ success: true });
  } catch(error) { return NextResponse.json({ success: false, error: error.message }, { status: 500 }); }
}
