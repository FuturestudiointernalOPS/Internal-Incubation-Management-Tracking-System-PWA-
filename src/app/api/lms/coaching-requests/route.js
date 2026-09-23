import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuth, getSession } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import { requireProgramScope } from "@/lib/programScopedAccess";
import { lmsErrorResponse } from "@/lib/lms/errors";
import {
  createCoachingRequest,
  listMyCoachingRequests,
  listCoachingRequests,
} from "@/lib/lms/coaching";

export const dynamic = "force-dynamic";

/**
 * COACHING REQUESTS — Phase 8
 *
 * GET  /api/lms/coaching-requests                  → the caller's own requests
 *      /api/lms/coaching-requests?program_id=X     → a program's queue (lms.view)
 *      /api/lms/coaching-requests?program_id=X&status=pending
 *
 * POST /api/lms/coaching-requests
 *      Body: { course_id, timing: 'before'|'during'|'after', lesson_id?, topic?,
 *              message? }
 *      The learner asks for coaching around a course they are enrolled in.
 *      Enrollment is verified server-side; an already-open request is returned
 *      instead of being duplicated.
 */
export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const programId = searchParams.get("program_id");

    if (programId) {
      const capError = await requireAuthorization("lms", "view");
      if (capError) return capError;
      // Program scope: reading a program's coaching queue is a program action, so
      // a delegated `lms.view` holder must be staffed on THIS program.
      const scopeError = await requireProgramScope({ programId, wave: "lms" });
      if (scopeError) return scopeError;
      const requests = await listCoachingRequests({
        programId,
        courseId: searchParams.get("course_id") || undefined,
        status: searchParams.get("status") || undefined,
      });
      return NextResponse.json({ success: true, requests });
    }

    const authError = await requireAuth();
    if (authError) return authError;
    const session = await getSession();
    const requests = await listMyCoachingRequests(session.cid, {
      courseId: searchParams.get("course_id") || undefined,
    });
    return NextResponse.json({ success: true, requests });
  } catch (error) {
    return lmsErrorResponse(error);
  }
}

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    const session = await getSession();
    const body = await req.json();
    const result = await createCoachingRequest({
      cid: session.cid,
      courseId: body.course_id,
      lessonId: body.lesson_id,
      timing: body.timing,
      topic: body.topic,
      message: body.message,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return lmsErrorResponse(error);
  }
}
