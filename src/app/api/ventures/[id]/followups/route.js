import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireVentureAccess } from "@/lib/ventureAuth";

const ROLES = ["participant", "founder", "staff", "program_manager", "super_admin", "teacher", "developer"];

// Read-only aggregation — reuses v2_followups (Program OS engine) via its new
// nullable venture_id column. No parallel meeting/follow-up table.
export async function GET(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth(ROLES);
    if (authError) return authError;
    const { id } = await params;
    const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    const vRes = await db.execute({ sql: "SELECT id FROM ventures WHERE venture_id = ?", args: [id] });
    const dbId = vRes.rows?.[0]?.id || id;

    const r = await db.execute({ sql: "SELECT * FROM v2_followups WHERE venture_id = ? ORDER BY created_at DESC", args: [dbId] });
    return NextResponse.json({ success: true, followups: r.rows || [] });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
