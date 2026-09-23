import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireVentureAccess } from "@/lib/ventureAuth";
import {
  getVentureCodeByIdForTransition,
  getVentureIdByCodeForTransitionStatus, getDocumentForTransition,
  isFounderForDocumentTransition, updateDocumentStatusForTransition,
} from "@/models/ventureAssets";

const ROLES = ["participant", "founder", "staff", "program_manager", "super_admin"];
const PRIVILEGED = ["staff", "program_manager", "super_admin"];

// venture_members stores venture_id as the VNT code (TEXT) — resolve the code from a UUID if needed
async function resolveVentureCode(idOrCode) {
  if (!idOrCode || (typeof idOrCode === "string" && !idOrCode.startsWith("VNT-") && idOrCode.includes("-"))) {
    try {
      const ventureResult = await getVentureCodeByIdForTransition(idOrCode);
      return ventureResult.rows?.[0]?.venture_id || idOrCode;
    } catch { return idOrCode; }
  }
  return idOrCode;
}
const STATUSES = ["private", "pending_review", "approved", "shared_with_investor"];

export async function PATCH(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth(ROLES);
    if (authError) return authError;
    const { id, docId } = await params;
    const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    const dbId = (await getVentureIdByCodeForTransitionStatus(id)).rows?.[0]?.id;
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const document = await getDocumentForTransition(docId, dbId);
    if (!document.rows?.length) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

    // Founders/privileged only — not advisors, not team members.
    if (!PRIVILEGED.includes(session.role)) {
      const code = await resolveVentureCode(dbId);
      const founder = await isFounderForDocumentTransition(code, session.cid);
      if (!founder.rows?.length) return NextResponse.json({ success: false, error: "Only founders can transition document status." }, { status: 403 });
    }

    const { approval_status } = await req.json();
    if (!STATUSES.includes(approval_status)) {
      return NextResponse.json({ success: false, error: `approval_status must be one of ${STATUSES.join(", ")}` }, { status: 400 });
    }

    await updateDocumentStatusForTransition(approval_status, docId, dbId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
