import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireVentureAccess } from "@/lib/ventureAuth";
import {
  getVentureIdByCodeForDocumentPermissions, getVentureCodeByIdForDocumentPermissions,
  getDocumentForPermissions, listDocumentPermissions, getDocumentForPermissionsUpdate,
  isFounderForDocumentPermissions, deleteDocumentPermission, upsertDocumentPermission,
} from "@/models/ventureAssets";

const ROLES = ["participant", "founder", "staff", "program_manager", "super_admin", "teacher", "developer"];
const PRIVILEGED = ["staff", "program_manager", "super_admin", "developer"];

async function resolveVentureDbId(ventureId) {
  const r = await getVentureIdByCodeForDocumentPermissions(ventureId);
  return r.rows?.[0]?.id || null;
}

// venture_members stores venture_id as the VNT code (TEXT) — resolve the code from a UUID if needed
async function resolveVentureCode(idOrCode) {
  if (!idOrCode || (typeof idOrCode === "string" && !idOrCode.startsWith("VNT-") && idOrCode.includes("-"))) {
    try {
      const r = await getVentureCodeByIdForDocumentPermissions(idOrCode);
      return r.rows?.[0]?.venture_id || idOrCode;
    } catch { return idOrCode; }
  }
  return idOrCode;
}

export async function GET(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth(ROLES);
    if (authError) return authError;
    const { id, docId } = await params;
    const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const doc = await getDocumentForPermissions(docId, dbId);
    if (!doc.rows?.length) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

    const r = await listDocumentPermissions(docId);
    return NextResponse.json({ success: true, permissions: r.rows || [] });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth(ROLES);
    if (authError) return authError;
    const { id, docId } = await params;
    const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const doc = await getDocumentForPermissionsUpdate(docId, dbId);
    if (!doc.rows?.length) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

    // Only founders (or privileged staff roles) may edit permissions.
    if (!PRIVILEGED.includes(session.role)) {
      const code = await resolveVentureCode(dbId);
      const founder = await isFounderForDocumentPermissions(code, session.cid);
      if (!founder.rows?.length) return NextResponse.json({ success: false, error: "Only founders can manage document permissions." }, { status: 403 });
    }

    const { role_scope, access_level } = await req.json();
    if (!role_scope || !access_level) return NextResponse.json({ success: false, error: "role_scope and access_level required" }, { status: 400 });
    if (!["none", "view", "edit"].includes(access_level)) return NextResponse.json({ success: false, error: "access_level must be none, view, or edit" }, { status: 400 });

    if (access_level === "none") {
      // Remove permission row entirely
      await deleteDocumentPermission(docId, role_scope);
    } else {
      await upsertDocumentPermission(docId, role_scope, access_level);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
