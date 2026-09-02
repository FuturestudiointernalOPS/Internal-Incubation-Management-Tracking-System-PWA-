import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuth, getSession } from "@/lib/auth";
import { getLearnerCourses, learnerHasEnrollments } from "@/lib/lms/learning";
import { lmsErrorResponse } from "@/lib/lms/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/lms/my-learning[?exists=1]
 * Learner's enrolled courses with progress + resume point.
 * Any authenticated user; access is derived from lms_enrollments (server-side),
 * never from client-supplied IDs or capabilities.
 *
 * `?exists=1` is the lightweight variant used by the shell to decide whether to
 * surface the "My Learning" entry: it returns { success, enrolled } without
 * loading courses/progress.
 */
export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    const session = await getSession();
    const existsMode = req?.url
      ? new URL(req.url).searchParams.get("exists") === "1"
      : false;
    if (existsMode) {
      const enrolled = await learnerHasEnrollments(session.cid);
      return NextResponse.json({ success: true, enrolled });
    }
    const courses = await getLearnerCourses(session.cid);
    return NextResponse.json({ success: true, courses });
  } catch (e) {
    return lmsErrorResponse(e);
  }
}
