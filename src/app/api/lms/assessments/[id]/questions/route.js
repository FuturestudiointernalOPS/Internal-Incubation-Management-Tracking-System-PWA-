import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/lib/authorization";
import { createQuestion } from "@/lib/lms/assessments";
import { lmsErrorResponse } from "@/lib/lms/errors";

export const dynamic = "force-dynamic";

/**
 * POST /api/lms/assessments/[id]/questions — create a question.
 * Supports multiple_choice and true_false. Requires lms.edit.
 */
export async function POST(req, { params }) {
  try {
    await initDb();
    const capError = await requireAuthorization("lms", "edit");
    if (capError) return capError;

    const { id } = await params;
    const body = await req.json();
    const question = await createQuestion({ assessmentId: id, ...body });
    return NextResponse.json({ success: true, question });
  } catch (e) {
    return lmsErrorResponse(e);
  }
}
