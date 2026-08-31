import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/lib/authorization";
import {
  getProgramRequirements,
  attachCourseToProgram,
  ensureProgramEnrollments,
  getProgramParticipantIds,
  getProgramLearningSummary,
} from "@/lib/lms/programRequirements";
import { lmsErrorResponse } from "@/lib/lms/errors";

export const dynamic = "force-dynamic";

/**
 * PROGRAM LEARNING REQUIREMENTS — Phase 6
 *
 * GET  /api/lms/program-requirements?program_id=X[&week_number=N][&session_id=S]
 *      Learning items for a program (with attached course info). Requires
 *      lms.view (super admin + Program Manager profile have it).
 *
 * POST /api/lms/program-requirements
 *      Body: { program_id, course_id, week_number?, session_id?, title?,
 *              description?, is_required? }
 *      Attaches an EXISTING course to a program — the course is never copied.
 *      Requires lms.assign (Program Course Assignment permission, distinct from
 *      course authoring lms.create/edit). After attaching, all current program
 *      participants are auto-enrolled in the course (server-side, idempotent).
 */
export async function GET(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("lms", "view");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const programId = searchParams.get("program_id");
    const weekNumber = searchParams.get("week_number");
    const sessionId = searchParams.get("session_id");
    if (!programId) {
      return NextResponse.json(
        { success: false, error: "lms.errors.programIdRequired" },
        { status: 400 },
      );
    }
    const requirements = await getProgramRequirements(programId, {
      weekNumber: weekNumber != null ? Number(weekNumber) : undefined,
      sessionId: sessionId || undefined,
    });
    const payload = { success: true, requirements };
    // Optional PM visibility summary (§17): per-course enrolled/completed counts
    // across the program's participants (computed from lms_enrollments only).
    if (searchParams.get("includeSummary") === "1") {
      payload.summary = await getProgramLearningSummary(programId);
    }
    return NextResponse.json(payload);
  } catch (e) {
    return lmsErrorResponse(e);
  }
}

export async function POST(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("lms", "assign");
    if (capError) return capError;

    const body = await req.json();
    const requirement = await attachCourseToProgram({
      programId: body.program_id,
      courseId: body.course_id,
      weekNumber: body.week_number,
      sessionId: body.session_id,
      title: body.title,
      description: body.description,
      isRequired: body.is_required,
      position: body.position,
    });
    const cids = await getProgramParticipantIds(body.program_id);
    const enrollment = await ensureProgramEnrollments(body.program_id, cids);
    return NextResponse.json({
      success: true,
      requirement,
      enrollment,
    });
  } catch (e) {
    return lmsErrorResponse(e);
  }
}
