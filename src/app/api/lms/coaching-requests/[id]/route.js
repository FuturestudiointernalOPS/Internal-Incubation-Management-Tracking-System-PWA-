import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuth, getSession } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import { lmsErrorResponse } from "@/lib/lms/errors";
import {
  updateCoachingRequest,
  cancelCoachingRequest,
} from "@/lib/lms/coaching";

export const dynamic = "force-dynamic";

/**
 * COACHING REQUEST — Phase 8
 *
 * PUT    /api/lms/coaching-requests/[id]
 *        Body: { status: 'accepted'|'declined'|'completed'|'pending',
 *                response_note? }
 *        Staff decision; requires lms.view (PM / super admin). The learner is
 *        notified of the new status.
 *
 * DELETE /api/lms/coaching-requests/[id]
 *        The learner withdraws their OWN open request (ownership enforced).
 */
export async function PUT(req, { params }) {
  try {
    await initDb();
    const capError = await requireAuthorization("lms", "view");
    if (capError) return capError;

    const session = await getSession();
    const { id } = await params;
    const body = await req.json();
    const request = await updateCoachingRequest(id, {
      status: body.status,
      responseNote: body.response_note,
      handledBy: session?.cid || null,
    });
    return NextResponse.json({ success: true, request });
  } catch (e) {
    return lmsErrorResponse(e);
  }
}

export async function DELETE(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    const session = await getSession();
    const { id } = await params;
    const request = await cancelCoachingRequest(id, session.cid);
    return NextResponse.json({ success: true, request });
  } catch (e) {
    return lmsErrorResponse(e);
  }
}
