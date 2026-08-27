import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/lib/authorization";
import { createAssessment } from "@/lib/lms/assessments";
import { lmsErrorResponse } from "@/lib/lms/errors";

export const dynamic = "force-dynamic";

/**
 * POST /api/lms/courses/[id]/assessments — create an assessment.
 * `sectionId` optional: set = section-end assessment, null = course-level.
 * Requires lms.edit.
 */
export async function POST(req, { params }) {
  try {
    await initDb();
    const capError = await requireAuthorization("lms", "edit");
    if (capError) return capError;

    const { id } = await params;
    const body = await req.json();
    const assessment = await createAssessment({ courseId: id, ...body });
    return NextResponse.json({ success: true, assessment });
  } catch (e) {
    return lmsErrorResponse(e);
  }
}
