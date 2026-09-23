import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireVentureAccess } from "@/lib/ventureAuth";
import {
  getVentureIdByCodeForAdvisors, listVentureAdvisors, upsertVentureAdvisor,
  removeVentureAdvisor, clearVenturePrimaryAdvisor, setVenturePrimaryAdvisor,
} from "@/models/ventureAssets";

const ROLES = ["participant","founder","staff","program_manager","super_admin"];
const ALLOWED = ["participant","founder","staff","program_manager","super_admin"];

async function resolveVentureDbId(ventureId) {
  const ventureResult = await getVentureIdByCodeForAdvisors(ventureId);
  return ventureResult.rows?.[0]?.id || null;
}

export async function GET(req, { params }) {
  try { await initDb(); const authError = await requireAuth(ROLES); if (authError) return authError;
    const { id } = await params; const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
    const advisorsResult = await listVentureAdvisors(dbId);
    return NextResponse.json({ success: true, advisors: advisorsResult.rows || [] });
  } catch(error) { return NextResponse.json({ success: false, error: error.message }, { status: 500 }); }
}

export async function POST(req, { params }) {
  try { await initDb(); const authError = await requireAuth(ALLOWED); if (authError) return authError;
    const { id } = await params; const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
    const { advisor_contact_id, is_primary } = await req.json();
    if (!advisor_contact_id) return NextResponse.json({ success: false, error: "advisor_contact_id required" }, { status: 400 });
    await upsertVentureAdvisor({ venture_id: dbId, advisor_contact_id, is_primary, assigned_by: session.cid });
    return NextResponse.json({ success: true });
  } catch(error) { return NextResponse.json({ success: false, error: error.message }, { status: 500 }); }
}

export async function PATCH(req, { params }) {
  try { await initDb(); const authError = await requireAuth(ALLOWED); if (authError) return authError;
    const { id } = await params; const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
    const { advisor_id, action, is_primary } = await req.json();
    if (action === "remove") {
      await removeVentureAdvisor(advisor_id, dbId);
    } else if (is_primary === true) {
      // Only one is_primary=true per venture — clear the others first.
      await clearVenturePrimaryAdvisor(dbId);
      await setVenturePrimaryAdvisor(advisor_id, dbId);
    }
    return NextResponse.json({ success: true });
  } catch(error) { return NextResponse.json({ success: false, error: error.message }, { status: 500 }); }
}
