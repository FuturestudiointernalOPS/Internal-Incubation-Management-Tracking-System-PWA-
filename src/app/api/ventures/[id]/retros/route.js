import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { notifyVentureFounders } from "@/lib/ventures";
import {
  getRetroForWeek,
  getVentureDbIdForRetros,
  insertVentureRetro,
  listVentureRetrosWithCreators,
} from "@/models/ventureWorkspace";

async function resolveVentureDbId(ventureId) {
  const r = await getVentureDbIdForRetros(ventureId);
  return r.rows?.[0]?.id || null;
}


function getWeekNumber() {
  const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()+3-(d.getDay()+6)%7);
  const w = Math.ceil(((d - new Date(d.getFullYear(),0,4))/86400000+1)/7);
  return { week_number: w, year: new Date().getFullYear() };
}

export async function GET(req, { params }) {
  try { await initDb();
    const { id } = await params;
    const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "view" });
    if (access.error) return access.error;
    const { session } = access;
    const dbId = await resolveVentureDbId(id); if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
    const { week_number, year } = getWeekNumber();
    const cur = await getRetroForWeek(dbId, week_number, year);
    const r = await listVentureRetrosWithCreators(dbId);
    return NextResponse.json({ success: true, retros: r.rows || [], current_week_submitted: cur.rows?.length > 0, current_week: week_number, current_year: year });
  } catch(e) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }); }
}

export async function POST(req, { params }) {
  try { await initDb();
    const { id } = await params;
    const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "edit" });
    if (access.error) return access.error;
    const { session } = access;
    const dbId = await resolveVentureDbId(id); if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
    const { week_number, year, completed_tasks, outstanding_tasks, carry_forward_notes } = await req.json();
    if (!week_number || !year) return NextResponse.json({ success: false, error: "week_number and year required" }, { status: 400 });
    try { await insertVentureRetro({ venture_id: dbId, week_number, year, completed_tasks, outstanding_tasks, carry_forward_notes, created_by: session.cid });
      notifyVentureFounders(dbId, 'Weekly Retro Submitted', `The venture retro for week ${week_number}/${year} has been submitted.`);
    } catch(e) { if (e.message?.includes("UNIQUE")) return NextResponse.json({ success: false, error: "Retro already exists for this week" }, { status: 409 }); throw e; }
    return NextResponse.json({ success: true });
  } catch(e) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }); }
}
