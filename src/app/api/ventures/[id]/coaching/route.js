import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireVentureAccess } from "@/lib/ventureAuth";

const ROLES = ["participant","staff","program_manager","super_admin","teacher","developer"];
const ALLOWED = ["participant","staff","program_manager","super_admin","teacher"];

async function resolveVentureDbId(ventureId) {
  const r = await db.execute({ sql: "SELECT id FROM ventures WHERE venture_id = ?", args: [ventureId] });
  return r.rows?.[0]?.id || null;
}

export async function GET(req, { params }) {
  try { await initDb(); const authError = await requireAuth(ROLES); if (authError) return authError;
    const { id } = await params; const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
    const r = await db.execute({ sql: "SELECT vcs.*, c.name as advisor_name FROM venture_coaching_sessions vcs LEFT JOIN contacts c ON vcs.advisor_contact_id = c.cid WHERE vcs.venture_id = ? ORDER BY vcs.session_date DESC", args: [dbId] });
    return NextResponse.json({ success: true, sessions: r.rows || [] });
  } catch(e) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }); }
}

export async function POST(req, { params }) {
  try { await initDb(); const authError = await requireAuth(ALLOWED); if (authError) return authError;
    const { id } = await params; const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
    const { advisor_contact_id, session_date, start_time, location, meeting_link, notes, observations, recommendations, follow_up_date } = await req.json();
    // Ensure columns exist (dev migration)
    try { await db.execute({ sql: "ALTER TABLE venture_coaching_sessions ADD COLUMN IF NOT EXISTS follow_up_date DATE" }); } catch(e){}
    try { await db.execute({ sql: "ALTER TABLE venture_coaching_sessions ADD COLUMN IF NOT EXISTS start_time VARCHAR" }); } catch(e){}
    try { await db.execute({ sql: "ALTER TABLE venture_coaching_sessions ADD COLUMN IF NOT EXISTS location VARCHAR" }); } catch(e){}
    try { await db.execute({ sql: "ALTER TABLE venture_coaching_sessions ADD COLUMN IF NOT EXISTS meeting_link TEXT" }); } catch(e){}
    await db.execute({ sql: "INSERT INTO venture_coaching_sessions (venture_id, advisor_contact_id, session_date, start_time, location, meeting_link, notes, observations, recommendations, follow_up_date) VALUES (?,?,?,?,?,?,?,?,?,?)", args: [dbId, advisor_contact_id||null, session_date||null, start_time||null, location||null, meeting_link||null, notes||null, observations||null, recommendations||null, follow_up_date||null] });
    return NextResponse.json({ success: true });
  } catch(e) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }); }
}

export async function PATCH(req, { params }) {
  try { await initDb(); const authError = await requireAuth(ALLOWED); if (authError) return authError;
    const { id } = await params; const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
    const coachingId = new URL(req.url).searchParams.get("id");
    if (!coachingId) return NextResponse.json({ success: false, error: "id required" }, { status: 400 });
    const { session_date, start_time, location, meeting_link, notes, observations, recommendations, follow_up_date } = await req.json();
    const updates = []; const args = [];
    if (session_date !== undefined) { updates.push("session_date = ?"); args.push(session_date); }
    if (start_time !== undefined) { updates.push("start_time = ?"); args.push(start_time); }
    if (location !== undefined) { updates.push("location = ?"); args.push(location); }
    if (meeting_link !== undefined) { updates.push("meeting_link = ?"); args.push(meeting_link); }
    if (notes !== undefined) { updates.push("notes = ?"); args.push(notes); }
    if (observations !== undefined) { updates.push("observations = ?"); args.push(observations); }
    if (recommendations !== undefined) { updates.push("recommendations = ?"); args.push(recommendations); }
    if (follow_up_date !== undefined) { updates.push("follow_up_date = ?"); args.push(follow_up_date); }
    if (!updates.length) return NextResponse.json({ success: false, error: "No fields to update" }, { status: 400 });
    args.push(coachingId);
    await db.execute({ sql: `UPDATE venture_coaching_sessions SET ${updates.join(", ")} WHERE id = ?`, args });
    return NextResponse.json({ success: true });
  } catch(e) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }); }
}
