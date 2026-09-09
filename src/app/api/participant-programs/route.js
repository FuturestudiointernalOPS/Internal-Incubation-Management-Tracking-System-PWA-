import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  requireAuth,
  getSession,
  hasProgramManagementAccess,
  requireAssignmentAccess,
} from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import { ensureProgramEnrollments } from "@/lib/lms/programRequirements";
import {
  getParticipantProgramAssignments,
  getProgramById,
  getContactEmailByCid,
  checkFacilitatorConflict,
  insertParticipantProgram,
  insertAssignmentAudit,
  insertEnrollmentTimeline,
  deleteParticipantProgram,
  insertRemovalAudit,
  insertWithdrawalTimeline,
} from "@/models/participantPortal";
export const dynamic = "force-dynamic";

/**
 * PARTICIPANT-PROGRAMS API
 * Manages many-to-many relationship between participants and programs.
 *
 * GET    /api/participant-programs?participant_id=X  — Get all programs for a participant
 * POST   /api/participant-programs                   — Add participant to program(s)
 * DELETE /api/participant-programs                   — Remove participant from a program
 */

export async function GET(req) {
  try {
    await initDb();
    // Phase 1.3: cross-participant enrollment reads are governed — management
    // roles or programs.view capability; an assignment in the requested
    // program also suffices when program_id scopes the read.
    const authError = await requireAuth();
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const participantId = searchParams.get("participant_id");
    const programId = searchParams.get("program_id");

    const session = await getSession();
    const capError = await requireAuthorization("programs", "view");
    const canRead = !capError || hasProgramManagementAccess(session?.role);
    if (session && !canRead) {
      if (!programId) {
        return NextResponse.json(
          { success: false, error: "errors.insufficientPermissions" },
          { status: 403 },
        );
      }
      const guardError = await requireAssignmentAccess({
        resource: "program",
        contextId: programId,
      });
      if (guardError) return guardError;
    }

    const result = await getParticipantProgramAssignments(participantId, programId);
    return NextResponse.json({ success: true, assignments: result.rows });
  } catch (error) {
    console.error("GET participant-programs error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth([
      "staff",
      "super_admin",
      "program_manager",
    ]);
    if (authError) return authError;

    const body = await req.json();
    const { participant_id, program_ids, assigned_by, source } = body;

    if (
      !participant_id ||
      !program_ids ||
      !Array.isArray(program_ids) ||
      program_ids.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "participant_id and program_ids (non-empty array) are required.",
        },
        { status: 400 },
      );
    }

    // Verify all programs exist before assigning
    for (const pid of program_ids) {
      const check = await getProgramById(pid);
      if (check.rows.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Program "${pid}" not found. Create it first before assigning.`,
          },
          { status: 404 },
        );
      }
    }

    const results = [];
    const errors = [];

    let participantEmail = "";
    try {
      const pc = await getContactEmailByCid(participant_id);
      participantEmail = pc.rows[0]?.email || "";
    } catch (_) {}

    for (const program_id of program_ids) {
      try {
        const facConflict = await checkFacilitatorConflict(
          program_id,
          participant_id,
          participantEmail,
        );
        if (facConflict.rows.length > 0) {
          errors.push({ program_id, error: "errors.roleConflictFacilitatorParticipant" });
          continue;
        }

        await insertParticipantProgram(participant_id, program_id);

        // Audit log
        await insertAssignmentAudit(participant_id, program_id, assigned_by || null);

        // Timeline event
        try {
          await insertEnrollmentTimeline(participant_id, program_id);
        } catch (_) {}

        results.push(program_id);

        // Phase 6: auto-enroll the participant in every PUBLISHED course this
        // program requires (server-side, idempotent — never breaks the existing
        // program enrollment flow).
        try {
          await ensureProgramEnrollments(program_id, [participant_id]);
        } catch (lmsErr) {
          console.error(
            `[participant-programs] auto LMS enrollment failed for ${participant_id} in ${program_id}:`,
            lmsErr.message,
          );
        }
      } catch (err) {
        console.error(
          `Error assigning participant ${participant_id} to program ${program_id}:`,
          err.message,
        );
        errors.push({ program_id, error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      assigned: results,
      errors,
    });
  } catch (error) {
    console.error("POST participant-programs error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    const authError = await requireAuth([
      "staff",
      "super_admin",
      "program_manager",
    ]);
    if (authError) return authError;

    const body = await req.json();
    const { participant_id, program_id } = body;

    if (!participant_id || !program_id) {
      return NextResponse.json(
        {
          success: false,
          error: "participant_id and program_id are required.",
        },
        { status: 400 },
      );
    }

    const result = await deleteParticipantProgram(participant_id, program_id);

    // Audit log
    await insertRemovalAudit(participant_id, program_id, body.assigned_by || null);

    // Timeline event
    try {
      await insertWithdrawalTimeline(participant_id, program_id);
    } catch (_) {}

    return NextResponse.json({
      success: true,
      rowsAffected: result.rowsAffected,
    });
  } catch (error) {
    console.error("DELETE participant-programs error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
