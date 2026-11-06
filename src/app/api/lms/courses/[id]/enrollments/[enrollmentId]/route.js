import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/models/authorization/index";
import { getEnrollmentDetail } from "@/services/lms/learning";
import { lmsErrorResponse } from "@/models/lms/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/lms/courses/[id]/enrollments/[enrollmentId]
 * One learner's lessons and assessment results, question by question.
 * Requires lms.edit.
 */
export async function GET(req, { params }) {
  try {
    await initDb();
    const capError = await requireAuthorization("lms", "edit");
    if (capError) return capError;

    const { id, enrollmentId } = await params;
    const detail = await getEnrollmentDetail(id, enrollmentId);
    return NextResponse.json({ success: true, detail });
  } catch (error) {
    return lmsErrorResponse(error);
  }
}
