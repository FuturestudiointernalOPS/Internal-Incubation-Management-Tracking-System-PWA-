import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import {
  getVentureDbIdForFollowups,
  listVentureFollowups,
} from "@/models/ventureWorkspace";

const ROLES = ["participant", "founder", "staff", "program_manager", "super_admin", "teacher", "developer"];

// Read-only aggregation — reuses v2_followups (Program OS engine) via its new
// nullable venture_id column. No parallel meeting/follow-up table.
export async function GET(req, { params }) {
  try {
    await initDb();
    const access = await requireVentureScopedAccess({ db, ventureId: id, module: "ventures", capability: "view", legacyRoles: ROLES });
    if (access.error) return access.error;
    const { session } = access;
    const { id } = await params;
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    const vRes = await getVentureDbIdForFollowups(id);
    const dbId = vRes.rows?.[0]?.id || id;

    const r = await listVentureFollowups(dbId);
    return NextResponse.json({ success: true, followups: r.rows || [] });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
