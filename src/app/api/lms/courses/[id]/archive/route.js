import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/models/authorization/index";
import { archiveCourse } from "@/models/lms/courses";
import { lmsErrorResponse } from "@/models/lms/errors";

export const dynamic = "force-dynamic";

/**
 * POST /api/lms/courses/[id]/archive
 * Archive a published course. Requires lms.edit.
 * Archiving never deletes enrollments/progress/attempts/history.
 */
export async function POST(req, { params }) {
  try {
    await initDb();
    const capError = await requireAuthorization("lms", "edit");
    if (capError) return capError;

    const { id } = await params;
    const result = await archiveCourse(id);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return lmsErrorResponse(error);
  }
}
