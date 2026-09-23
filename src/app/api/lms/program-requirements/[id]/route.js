import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/lib/authorization";
import {
  updateProgramRequirement,
  detachCourseFromProgram,
  getRequirementProgramId,
} from "@/lib/lms/programRequirements";
import { requireProgramScope } from "@/lib/programScopedAccess";
import { lmsErrorResponse } from "@/lib/lms/errors";

export const dynamic = "force-dynamic";

/**
 * PROGRAM LEARNING REQUIREMENT — Phase 6
 *
 * PUT    /api/lms/program-requirements/[id]
 *        Body: { title?, description?, is_required?, position?, week_number?,
 *                session_id? }
 *        Updates one learning item (e.g. toggle REQUIRED / OPTIONAL).
 *        Requires lms.edit.
 *
 * DELETE /api/lms/program-requirements/[id]
 *        Detaches the course from the program. Existing learner enrollments
 *        are kept (access is not silently revoked).
 *        Requires lms.edit.
 */
export async function PUT(req, { params }) {
  try {
    await initDb();
    // Program-requirement editing is course management (lms.edit).
    const capError = await requireAuthorization("lms", "edit");
    if (capError) return capError;

    const { id } = await params;

    // Program scope: the requirement id comes from the URL, so resolve the
    // owning program first — a linked course may only be edited by a holder
    // staffed on THAT program.
    const programId = await getRequirementProgramId(id);
    const scopeError = await requireProgramScope({ programId, wave: "lms" });
    if (scopeError) return scopeError;

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
  } catch (error) {
    return lmsErrorResponse(error);
  }
}

export async function DELETE(req, { params }) {
  try {
    await initDb();
    // Program-requirement detach is course management (lms.edit).
    const capError = await requireAuthorization("lms", "edit");
    if (capError) return capError;

    const { id } = await params;

    // Program scope: detach is a program action, so resolve the owning program
    // from the requirement and require the caller to be staffed there.
    const programId = await getRequirementProgramId(id);
    const scopeError = await requireProgramScope({ programId, wave: "lms" });
    if (scopeError) return scopeError;

    const result = await detachCourseFromProgram(id);
    return NextResponse.json(result);
  } catch (error) {
    return lmsErrorResponse(error);
  }
}
