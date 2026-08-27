import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/lib/authorization";
import { listEnrollments } from "@/lib/lms/learning";
import { lmsErrorResponse } from "@/lib/lms/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/lms/courses/[id]/enrollments
 * Admin view of a course's learners. Requires lms.enroll.
 */
export async function GET(req, { params }) {
  try {
    await initDb();
    const capError = await requireAuthorization("lms", "enroll");
    if (capError) return capError;

    const { id } = await params;
    const enrollments = await listEnrollments(id);
    return NextResponse.json({ success: true, enrollments });
  } catch (e) {
    return lmsErrorResponse(e);
  }
}
