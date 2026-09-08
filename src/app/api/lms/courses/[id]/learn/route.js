import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuth, getSession } from "@/lib/auth";
import { getLearnerCourse } from "@/lib/lms/learning";
import { lmsErrorResponse } from "@/lib/lms/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/lms/courses/[id]/learn
 * Learner-scoped course view (structure + progress). Enforces enrollment
 * server-side: a user without a valid enrollment for this course gets 403,
 * even if they know the course ID.
 */
export async function GET(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    const session = await getSession();
    const { id } = await params;
    const course = await getLearnerCourse(id, session.cid);
    return NextResponse.json({ success: true, ...course });
  } catch (e) {
    return lmsErrorResponse(e);
  }
}
