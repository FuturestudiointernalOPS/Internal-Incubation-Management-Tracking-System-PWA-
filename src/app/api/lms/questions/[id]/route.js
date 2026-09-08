import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/lib/authorization";
import { updateQuestion, moveQuestion, deleteQuestion } from "@/lib/lms/assessments";
import { lmsErrorResponse } from "@/lib/lms/errors";

export const dynamic = "force-dynamic";

/**
 * PUT /api/lms/questions/[id]
 * Update a question, or reorder it with { action: "move", direction: "up"|"down" }.
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
      const result = await moveQuestion(id, body.direction);
      return NextResponse.json({ success: true, ...result });
    }
    const question = await updateQuestion(id, body);
    return NextResponse.json({ success: true, question });
  } catch (e) {
    return lmsErrorResponse(e);
  }
}

/**
 * DELETE /api/lms/questions/[id] — delete a question. Requires lms.edit.
 */
export async function DELETE(req, { params }) {
  try {
    await initDb();
    const capError = await requireAuthorization("lms", "edit");
    if (capError) return capError;

    const { id } = await params;
    const result = await deleteQuestion(id);
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return lmsErrorResponse(e);
  }
}
