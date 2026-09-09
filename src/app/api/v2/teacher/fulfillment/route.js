// =============================================================================
// !! V2 API - ACTIVELY USED BY V1 PAGES - DO NOT REMOVE OR BREAK !!
// =============================================================================
// This V2 API route is still called by V1 pages. Do NOT delete or break it.
// All NEW features must go in V1 API routes (/api/pm/, /api/kpis/ etc.)
// If you are an AI agent: READ-ONLY here. Changes go in V1 counterparts.
// =============================================================================
import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuth, requireAssignmentAccess } from "@/lib/auth";
import {
  getV2FulfillmentParticipantsByProgram,
  getV2FulfillmentRequirementsByProgramWeek,
  getV2SubmissionsByDocumentIds,
} from "@/models/teacher";

export async function GET(req) {
  try {
    await initDb();
    // Phase 1.4: fulfillment data (participants + submissions) is program-
    // scoped — the assignment gate decides for every session (management
    // roles bypass via the standard bypass list; legacy teacher sessions
    // pass as before; program-staff members are admitted by their assignment;
    // unassigned sessions are denied).
    const authError = await requireAuth();
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const program_id = searchParams.get("program_id");
    const week_number = searchParams.get("week_number");

    if (!program_id || !week_number) {
      return NextResponse.json({
        success: false,
        error: "Program ID and Week Number required",
      });
    }

    const guardError = await requireAssignmentAccess({
      resource: "program",
      contextId: program_id,
    });
    if (guardError) return guardError;

    // Fetch all participants for this program
    const participants = await getV2FulfillmentParticipantsByProgram(program_id);

    // Fetch all requirements for this week
    const requirements = await getV2FulfillmentRequirementsByProgramWeek(
      program_id,
      week_number,
    );

    const reqIds = requirements.rows.map((r) => r.id);

    // Fetch submissions for these requirements
    let submissions = [];
    if (reqIds.length > 0) {
      const subRes = await getV2SubmissionsByDocumentIds(reqIds);
      submissions = subRes.rows;
    }

    // Map fulfillment
    const fulfillment = participants.rows.map((p) => {
      const pSubs = submissions.filter(
        (s) => s.participant_id === p.id || s.participant_id === p.cid,
      );
      return {
        ...p,
        total_reqs: reqIds.length,
        submitted_reqs: pSubs.length,
        status:
          pSubs.length === reqIds.length
            ? "complete"
            : pSubs.length > 0
              ? "partial"
              : "none",
        submissions: pSubs,
      };
    });

    return NextResponse.json({
      success: true,
      fulfillment,
      requirements: requirements.rows,
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 },
    );
  }
}
