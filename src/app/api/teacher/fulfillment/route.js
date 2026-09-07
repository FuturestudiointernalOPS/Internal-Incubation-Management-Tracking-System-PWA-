import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import {
  getFulfillmentParticipantsByProgram,
  getFulfillmentRequirementsByProgramWeek,
  getSubmissionsByDocumentIds,
} from "@/models/teacher";

export const GET = createHandler(
  { roles: ["teacher", "staff", "super_admin"] },
  async (req) => {
    const { searchParams } = new URL(req.url);
    const program_id = searchParams.get("program_id");
    const week_number = searchParams.get("week_number");

    if (!program_id || !week_number) {
      return NextResponse.json({
        success: false,
        error: "Program ID and Week Number required",
      });
    }

    const participants = await getFulfillmentParticipantsByProgram(program_id);

    const requirements = await getFulfillmentRequirementsByProgramWeek(
      program_id,
      week_number,
    );

    const reqIds = requirements.rows.map((r) => r.id);

    let submissions = [];
    if (reqIds.length > 0) {
      const subRes = await getSubmissionsByDocumentIds(reqIds);
      submissions = subRes.rows;
    }

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
  },
);
