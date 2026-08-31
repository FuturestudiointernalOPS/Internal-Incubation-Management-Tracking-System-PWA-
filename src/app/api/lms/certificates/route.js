import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuth, getSession } from "@/lib/auth";
import { getCertificatesForLearner } from "@/lib/lms/certificates";
import { lmsErrorResponse } from "@/lib/lms/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/lms/certificates
 * The authenticated learner's own certificates.
 * Access is derived server-side from the session cid — the learner can never
 * list another user's certificates.
 */
export async function GET() {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    const session = await getSession();
    const certificates = await getCertificatesForLearner(session.cid);
    return NextResponse.json({ success: true, certificates });
  } catch (e) {
    return lmsErrorResponse(e);
  }
}
