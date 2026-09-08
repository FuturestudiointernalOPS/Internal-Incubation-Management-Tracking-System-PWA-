import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/lib/authorization";
import { updateLesson, moveLesson, deleteLesson } from "@/lib/lms/lessons";
import { lmsErrorResponse } from "@/lib/lms/errors";

export const dynamic = "force-dynamic";

/**
 * PUT /api/lms/lessons/[id]
 * Update a lesson, or reorder it with { action: "move", direction: "up"|"down" }.
 * Requires lms.edit.
 */
export async function PUT(req, { params }) {
  try {
    await initDb();
    const capError = await requireAuthorization("lms", "edit");
    if (capError) return capError;

    const { id } = await params;
    const body = await req.json();
    if (body.action === "move") {
      const result = await moveLesson(id, body.direction);
      return NextResponse.json({ success: true, ...result });
    }
    const lesson = await updateLesson(id, body);
    return NextResponse.json({ success: true, lesson });
  } catch (e) {
    return lmsErrorResponse(e);
  }
}

/**
 * DELETE /api/lms/lessons/[id] — safe-delete guard: refuses when the lesson
 * already has learner progress. Requires lms.edit.
 */
export async function DELETE(req, { params }) {
  try {
    await initDb();
    const capError = await requireAuthorization("lms", "edit");
    if (capError) return capError;

    const { id } = await params;
    const result = await deleteLesson(id);
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return lmsErrorResponse(e);
  }
}
