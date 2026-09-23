import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/lib/authorization";
import { publishCourse } from "@/lib/lms/courses";
import { lmsErrorResponse } from "@/lib/lms/errors";

export const dynamic = "force-dynamic";

/**
 * POST /api/lms/courses/[id]/publish
 * Validate then publish a draft course. Requires lms.edit.
 * Returns 422 with `details` (field-level errors) when validation fails.
 */
export async function POST(req, { params }) {
  try {
    await initDb();
    // Course lifecycle (publish/unpublish) is course management (lms.edit).
    const capError = await requireAuthorization("lms", "edit");
    if (capError) return capError;

    const { id } = await params;
    const result = await publishCourse(id);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return lmsErrorResponse(error);
  }
}
