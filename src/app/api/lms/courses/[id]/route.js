import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/lib/authorization";
import {
  getCourseStructure,
  updateCourse,
  deleteCourse,
} from "@/lib/lms/courses";
import { lmsErrorResponse } from "@/lib/lms/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/lms/courses/[id] — full authoring structure (course + sections +
 * lessons + assessments + questions). Requires lms.view.
 */
export async function GET(req, { params }) {
  try {
    await initDb();
    const capError = await requireAuthorization("lms", "view");
    if (capError) return capError;

    const { id } = await params;
    const structure = await getCourseStructure(id);
    return NextResponse.json({ success: true, course: structure });
  } catch (e) {
    return lmsErrorResponse(e);
  }
}

/**
 * PUT /api/lms/courses/[id] — update course metadata. Requires lms.edit.
 */
export async function PUT(req, { params }) {
  try {
    await initDb();
    const capError = await requireAuthorization("lms", "edit");
    if (capError) return capError;

    const { id } = await params;
    const body = await req.json();
    const course = await updateCourse(id, body);
    return NextResponse.json({ success: true, course });
  } catch (e) {
    return lmsErrorResponse(e);
  }
}

/**
 * DELETE /api/lms/courses/[id] — delete a DRAFT course with no enrollments.
 * Requires lms.delete. Published/archived courses must be archived instead.
 */
export async function DELETE(req, { params }) {
  try {
    await initDb();
    const capError = await requireAuthorization("lms", "delete");
    if (capError) return capError;

    const { id } = await params;
    const result = await deleteCourse(id);
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return lmsErrorResponse(e);
  }
}
