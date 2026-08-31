import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuth, getSession } from "@/lib/auth";
import { getAssessmentForTake } from "@/lib/lms/learning";
import { lmsErrorResponse } from "@/lib/lms/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/lms/assessments/[id]/take
 * Learner view of an assessment: metadata, questions (options ONLY — correct
 * answers are never exposed) and attempt history. Enrollment-gated server-side:
 * assessment → course → enrollment.
 */
export async function GET(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    const session = await getSession();
    const { id } = await params;
    const data = await getAssessmentForTake(id, session.cid);
    return NextResponse.json({ success: true, ...data });
  } catch (e) {
    return lmsErrorResponse(e);
  }
}
