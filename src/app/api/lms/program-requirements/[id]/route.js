import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/lib/authorization";
import {
  updateProgramRequirement,
  detachCourseFromProgram,
} from "@/lib/lms/programRequirements";
import { lmsErrorResponse } from "@/lib/lms/errors";

export const dynamic = "force-dynamic";

/**
 * PROGRAM LEARNING REQUIREMENT — Phase 6
 *
 * PUT    /api/lms/program-requirements/[id]
 *        Body: { title?, description?, is_required?, position?, week_number?,
 *                session_id? }
 *        Updates one learning item (e.g. toggle REQUIRED / OPTIONAL).
 *        Requires lms.assign.
 *
 * DELETE /api/lms/program-requirements/[id]
 *        Detaches the course from the program. Existing learner enrollments
 *        are kept (access is not silently revoked).
 *        Requires lms.assign.
 */
export async function PUT(req, { params }) {
  try {
    await initDb();
    const capError = await requireAuthorization("lms", "assign");
    if (capError) return capError;

    const { id } = await params;
    const body = await req.json();
    const requirement = await updateProgramRequirement(id, {
      title: body.title,
      description: body.description,
      is_required: body.is_required,
      position: body.position,
      week_number: body.week_number,
      session_id: body.session_id,
    });
    return NextResponse.json({ success: true, requirement });
  } catch (e) {
    return lmsErrorResponse(e);
  }
}

export async function DELETE(req, { params }) {
  try {
    await initDb();
    const capError = await requireAuthorization("lms", "assign");
    if (capError) return capError;

    const { id } = await params;
    const result = await detachCourseFromProgram(id);
    return NextResponse.json(result);
  } catch (e) {
    return lmsErrorResponse(e);
  }
}
