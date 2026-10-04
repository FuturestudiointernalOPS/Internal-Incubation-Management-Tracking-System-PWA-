import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuth } from "@/server/auth/guards";
import { getSession } from "@/server/auth/session";
import { submitAssessment } from "@/services/lms/learning";
import { lmsErrorResponse } from "@/models/lms/errors";

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
  } catch (error) {
    return lmsErrorResponse(error);
  }
}
