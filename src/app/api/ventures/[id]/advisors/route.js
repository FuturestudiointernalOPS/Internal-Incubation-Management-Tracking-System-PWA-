import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireVentureAccess } from "@/lib/ventureAuth";

const ROLES = ["participant","founder","staff","program_manager","super_admin","teacher","developer"];
const ALLOWED = ["participant","founder","staff","program_manager","super_admin","teacher"];

async function resolveVentureDbId(ventureId) {
  const r = await db.execute({ sql: "SELECT id FROM ventures WHERE venture_id = ?", args: [ventureId] });
  return r.rows?.[0]?.id || null;
}

export async function GET(req, { params }) {
  try { await initDb(); const authError = await requireAuth(ROLES); if (authError) return authError;
    const { id } = await params; const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
    const r = await db.execute({ sql: "SELECT va.*, c.name as advisor_name, c.email as advisor_email FROM venture_advisors va LEFT JOIN contacts c ON va.advisor_contact_id = c.cid WHERE va.venture_id = ? AND va.removed_at IS NULL ORDER BY va.is_primary DESC", args: [dbId] });
    return NextResponse.json({ success: true, advisors: r.rows || [] });
  } catch(e) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }); }
}

export async function POST(req, { params }) {
  try { await initDb(); const authError = await requireAuth(ALLOWED); if (authError) return authError;
    const { id } = await params; const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
    const { advisor_contact_id, is_primary } = await req.json();
    if (!advisor_contact_id) return NextResponse.json({ success: false, error: "advisor_contact_id required" }, { status: 400 });
    try { await db.execute({ sql: "INSERT INTO venture_advisors (venture_id, advisor_contact_id, is_primary, assigned_by) VALUES (?,?,?,?) ON CONFLICT (venture_id, advisor_contact_id) DO UPDATE SET removed_at = NULL, assigned_by = EXCLUDED.assigned_by", args: [dbId, advisor_contact_id, is_primary||false, session.cid] });
    } catch(e) { throw e; }
    return NextResponse.json({ success: true });
  } catch(e) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }); }
}

export async function PATCH(req, { params }) {
  try { await initDb(); const authError = await requireAuth(ALLOWED); if (authError) return authError;
    const { id } = await params; const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
    const { advisor_id, action, is_primary } = await req.json();
    if (action === "remove") {
      await db.execute({ sql: "UPDATE venture_advisors SET removed_at = NOW() WHERE id = ? AND venture_id = ?", args: [advisor_id, dbId] });
    } else if (is_primary === true) {
      // Only one is_primary=true per venture — clear the others first.
      await db.execute({ sql: "UPDATE venture_advisors SET is_primary = false WHERE venture_id = ?", args: [dbId] });
      await db.execute({ sql: "UPDATE venture_advisors SET is_primary = true WHERE id = ? AND venture_id = ?", args: [advisor_id, dbId] });
    }
    return NextResponse.json({ success: true });
  } catch(e) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }); }
}
