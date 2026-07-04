import db from "@/lib/db";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";

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

    const participants = await db.execute({
      sql: "SELECT id, name, cid, email, phone FROM v2_participants WHERE program_id = ?",
      args: [program_id],
    });

    const requirements = await db.execute({
      sql: "SELECT id, title FROM v2_document_requirements WHERE program_id = ? AND week_number = ?",
      args: [program_id, week_number],
    });

    const reqIds = requirements.rows.map((r) => r.id);

    let submissions = [];
    if (reqIds.length > 0) {
      const placeholders = reqIds.map(() => "?").join(",");
      const subRes = await db.execute({
        sql: `SELECT * FROM v2_submissions WHERE document_id IN (${placeholders})`,
        args: reqIds.map(String),
      });
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
