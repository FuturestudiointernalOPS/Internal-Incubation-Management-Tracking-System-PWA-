import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireProgramScope } from "@/lib/programScopedAccess";
import { participantBatches } from "@/lib/participantBatches";
import { ensureProgramEnrollments } from "@/lib/lms/programRequirements";
import {
  getBulkProgramById,
  checkBulkFacilitatorConflicts,
  insertBulkParticipantPrograms,
  deleteBulkParticipantPrograms,
  insertBulkAudits,
} from "@/models/participantPortal";
export const dynamic = "force-dynamic";

/**
 * PARTICIPANT-PROGRAMS BULK API
 * Handles bulk assign/remove of participants to/from a program.
 *
 * POST /api/participant-programs/bulk
 * Body: { participant_ids: ["p1", "p2"], program_id: "prog1", action: "add"|"remove", assigned_by: "sa" }
 */

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
    const { participant_ids, program_id, action, assigned_by } = body;

    if (
      !participant_ids ||
      !Array.isArray(participant_ids) ||
      participant_ids.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "participant_ids (non-empty array) is required.",
        },
        { status: 400 },
      );
    }

    if (!program_id) {
      return NextResponse.json(
        { success: false, error: "program_id is required." },
        { status: 400 },
      );
    }

    if (!action || !["add", "remove"].includes(action)) {
      return NextResponse.json(
        { success: false, error: "action must be 'add' or 'remove'." },
        { status: 400 },
      );
    }

    // Program scope (wave: enrollment). OFF by default (no-op until switched on).
    const scopeError = await requireProgramScope({
      programId: program_id,
      wave: "enrollment",
    });
    if (scopeError) return scopeError;

    // Verify the program exists before assigning (only on add)
    if (action === "add") {
      const progCheck = await getBulkProgramById(program_id);
      if (progCheck.rows.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Program "${program_id}" not found. Create it first before assigning.`,
          },
          { status: 404 },
        );
      }
    }

    const results = [];
    const errors = [];

    // The participants are APPLIED IN CHUNKS of 30, as a queue.
    //
    // Per person this used to cost three statements plus one per required course
    // (a conflict check, the assignment, the audit entry, then the enrolment) -
    // so a few hundred people made a few hundred round trips inside this one
    // request. Per chunk it is a handful, and the enrolment adds one more per
    // chunk per course instead of one per person per course.
    //
    // The chunk is therefore also the unit that lands or fails: a database error
    // is reported for the chunk's people rather than for the one row that
    // happened to be written when it occurred.
    for (const chunk of participantBatches(participant_ids)) {
      let added = [];

      try {
        if (action === "add") {
          // One query decides who in this chunk is already a facilitator of the
          // programme. They are refused as before; the rest of the chunk is not
          // held up by them.
          const conflicts = await checkBulkFacilitatorConflicts(
            program_id,
            chunk,
          );
          const blocked = new Set(
            (conflicts.rows || []).map((row) =>
              String(row.staff_id).trim().toLowerCase(),
            ),
          );
          added = chunk.filter(
            (id) => !blocked.has(String(id).trim().toLowerCase()),
          );
          for (const id of chunk) {
            if (!added.includes(id)) {
              errors.push({
                participant_id: id,
                error: "errors.roleConflictFacilitatorParticipant",
              });
            }
          }
          if (added.length === 0) continue;

          await insertBulkParticipantPrograms(added, program_id);
        } else {
          await deleteBulkParticipantPrograms(chunk, program_id);
          added = chunk;
        }

        // Audit log — one entry per person, written in one statement.
        await insertBulkAudits(
          added,
          program_id,
          action === "add" ? "assigned" : "removed",
          assigned_by || null,
        );

        results.push(...added);
      } catch (err) {
        console.error(
          `Bulk ${action} error for a chunk of ${chunk.length} in ${program_id}:`,
          err.message,
        );
        for (const participant_id of chunk) {
          errors.push({ participant_id, error: err.message });
        }
        continue;
      }

      // Phase 6: auto-enroll added participants in every PUBLISHED course
      // the program requires (server-side, idempotent). One call for the chunk —
      // the enrolment groups its own writes in turn.
      if (action === "add" && added.length > 0) {
        try {
          await ensureProgramEnrollments(program_id, added);
        } catch (lmsErr) {
          console.error(
            `[participant-programs/bulk] auto LMS enrollment failed for a chunk in ${program_id}:`,
            lmsErr.message,
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      action,
      program_id,
      processed: results,
      errors,
    });
  } catch (error) {
    console.error("POST participant-programs/bulk error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
