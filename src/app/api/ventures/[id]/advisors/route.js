import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireVentureAccess } from "@/lib/ventureAuth";

const ROLES = ["participant","staff","program_manager","super_admin","teacher","developer"];
const ALLOWED = ["participant","staff","program_manager","super_admin","teacher"];

export async function GET(req, { params }) {
  try { await initDb(); const authError = await requireAuth(ROLES); if (authError) return authError;
    const { id } = await params; const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    const r = await db.execute({ sql: "SELECT * FROM venture_advisors WHERE venture_id = ? AND removed_at IS NULL ORDER BY is_primary DESC", args: [id] });
    return NextResponse.json({ success: true, advisors: r.rows || [] });
  } catch(e) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }); }
}

export async function POST(req, { params }) {
  try { await initDb(); const authError = await requireAuth(ALLOWED); if (authError) return authError;
    const { id } = await params; const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    const { advisor_contact_id, is_primary } = await req.json();
    if (!advisor_contact_id) return NextResponse.json({ success: false, error: "advisor_contact_id required" }, { status: 400 });
    try { await db.execute({ sql: "INSERT INTO venture_advisors (venture_id, advisor_contact_id, is_primary, assigned_by) VALUES (?,?,?,?)", args: [id, advisor_contact_id, is_primary||false, session.cid] });
    } catch(e) { if (e.message?.includes("UNIQUE")) return NextResponse.json({ success: false, error: "Advisor already assigned" }, { status: 409 }); throw e; }
    return NextResponse.json({ success: true });
  } catch(e) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }); }
}

export async function PATCH(req, { params }) {
  try { await initDb(); const authError = await requireAuth(ALLOWED); if (authError) return authError;
    const { id } = await params; const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    const { advisor_id, action } = await req.json();
    if (action === "remove") { await db.execute({ sql: "UPDATE venture_advisors SET removed_at = NOW() WHERE id = ? AND venture_id = ?", args: [advisor_id, id] }); }
    return NextResponse.json({ success: true });
  } catch(e) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }); }
}
