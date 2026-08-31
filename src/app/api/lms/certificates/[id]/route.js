import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuth, getSession } from "@/lib/auth";
import { getLearnerCertificate } from "@/lib/lms/certificates";
import { lmsErrorResponse } from "@/lib/lms/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/lms/certificates/[id]
 * One certificate, ownership-scoped. The service derives the owner from the
 * certificate record and compares it with the session cid — manipulating the
 * certificate_id can never reach another learner's certificate (403).
 */
export async function GET(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    const session = await getSession();
    const { id } = await params;
    const certificate = await getLearnerCertificate(id, session.cid);
    return NextResponse.json({ success: true, certificate });
  } catch (e) {
    return lmsErrorResponse(e);
  }
}
