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
 * Remove every `correct_answer` from an authoring structure. A view-only holder
 * does not need the answer key, so it must not be handed one.
 */
function stripAnswerKeys(node) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach(stripAnswerKeys);
    return;
  }
  if ("correct_answer" in node) delete node.correct_answer;
  for (const value of Object.values(node)) stripAnswerKeys(value);
}

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
    // The answer key is an EDITOR resource: strip it unless the caller may edit.
    const editCapError = await requireAuthorization("lms", "edit");
    if (editCapError) stripAnswerKeys(structure);
    return NextResponse.json({ success: true, course: structure });
  } catch (error) {
    return lmsErrorResponse(error);
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
  } catch (error) {
    return lmsErrorResponse(error);
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
  } catch (error) {
    return lmsErrorResponse(error);
  }
}
