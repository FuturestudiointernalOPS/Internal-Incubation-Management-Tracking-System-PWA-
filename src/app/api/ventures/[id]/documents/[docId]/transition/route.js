import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/guards";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import {
  getVentureIdByCodeForTransitionStatus, getDocumentForTransition,
  isFounderForDocumentTransition, updateDocumentStatusForTransition,
} from "@/models/ventureAssets";

const ROLES = ["participant", "founder", "staff", "program_manager", "super_admin"];
const PRIVILEGED = ["staff", "program_manager", "super_admin"];

const STATUSES = ["private", "pending_review", "approved", "shared_with_investor"];

export async function PATCH(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth(ROLES);
    if (authError) return authError;
    const { id, docId } = await params;
    const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "edit" });
    if (access.error) return access.error;
    const { session } = access;
    const dbId = (await getVentureIdByCodeForTransitionStatus(id)).rows?.[0]?.id;
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const document = await getDocumentForTransition(docId, dbId);
    if (!document.rows?.length) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

    // Founders/privileged only — not advisors, not team members.
    if (!PRIVILEGED.includes(session.role)) {
      // `dbId` is the internal id, which the membership table keys on (Phase 0).
      const founder = await isFounderForDocumentTransition(dbId, session.cid);
      if (!founder.rows?.length) return NextResponse.json({ success: false, error: "errors.foundersOnly" }, { status: 403 });
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
