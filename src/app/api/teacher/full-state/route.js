import db from "@/lib/db";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";

export const GET = createHandler(
  { roles: ["teacher", "staff", "super_admin"] },
  async (req) => {
    const { searchParams } = new URL(req.url);
    const cid = searchParams.get("cid");
    if (!cid)
      return NextResponse.json({
        success: false,
        error: "Teacher CID required",
      });

    const teamRes = await db.execute({
      sql: "SELECT * FROM v2_teams WHERE handler_id = ?",
      args: [cid],
    });

    // v2_document_requirements/v2_sessions schema mismatch (deliverable_id is uuid,
    // v2_document_requirements.id is integer; r.session_id also doesn't exist)
    // — see SCHEMA_DRIFT_AUDIT.md cluster 12
    let subRes;
    try {
      subRes = await db.execute({
        sql: `SELECT s.*, r.title as requirement_title, ses.week_number FROM v2_submissions s JOIN v2_document_requirements r ON s.deliverable_id = r.id LEFT JOIN v2_sessions ses ON r.session_id = ses.id JOIN v2_teams t ON s.program_id = t.program_id WHERE t.handler_id = ? AND s.status = 'pending'`,
        args: [cid],
      });
    } catch (e) {
      subRes = { rows: [] };
    }

    // v2_sessions schema mismatch — see SCHEMA_DRIFT_AUDIT.md cluster 12
    let sesRes;
    try {
      sesRes = await db.execute({
        sql: `SELECT s.*, p.name as program_name FROM v2_sessions s JOIN v2_programs p ON s.program_id = p.id WHERE s.handler_id = ? AND s.scheduled_date IS NOT NULL`,
        args: [cid],
      });
    } catch (e) {
      sesRes = { rows: [] };
    }

    return NextResponse.json({
      success: true,
      teams: teamRes.rows,
      submissions: subRes.rows,
      sessions: sesRes.rows,
    });
  },
);
