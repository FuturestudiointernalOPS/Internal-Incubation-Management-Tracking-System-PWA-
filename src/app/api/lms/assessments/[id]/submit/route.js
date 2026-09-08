import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuth, getSession } from "@/lib/auth";
import { submitAssessment } from "@/lib/lms/learning";
import { lmsErrorResponse } from "@/lib/lms/errors";

export const dynamic = "force-dynamic";

/**
 * POST /api/lms/assessments/[id]/submit
 * Body: { answers: [{ questionId, answer }] }
 *
 * The server verifies the learner's enrollment, validates every answer against
 * the configured questions, computes the score and pass/fail (never trusting
 * the client), derives the attempt number and persists the attempt. Unlimited
 * retries; all attempts remain recorded.
 */
export async function POST(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    const session = await getSession();
    const { id } = await params;
    const body = await req.json();
    const result = await submitAssessment(id, session.cid, body?.answers);
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return lmsErrorResponse(e);
  }
}
