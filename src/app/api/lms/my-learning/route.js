import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuth, getSession } from "@/lib/auth";
import { getLearnerCourses } from "@/lib/lms/learning";
import { lmsErrorResponse } from "@/lib/lms/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/lms/my-learning
 * Learner's enrolled courses with progress + resume point.
 * Any authenticated user; access is derived from lms_enrollments (server-side),
 * never from client-supplied IDs or capabilities.
 */
export async function GET() {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    const session = await getSession();
    const courses = await getLearnerCourses(session.cid);
    return NextResponse.json({ success: true, courses });
  } catch (e) {
    return lmsErrorResponse(e);
  }
}
