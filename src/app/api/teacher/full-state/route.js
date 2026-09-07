import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import {
  getTeacherTeamsByHandlerCid,
  getTeacherPendingSubmissionsByHandlerCid,
  getTeacherSessionsByHandlerCid,
} from "@/models/teacher";

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

    const teamRes = await getTeacherTeamsByHandlerCid(cid);

    // v2_document_requirements/v2_sessions schema mismatch (deliverable_id is uuid,
    // v2_document_requirements.id is integer; r.session_id also doesn't exist)
    // — see SCHEMA_DRIFT_AUDIT.md cluster 12
    let subRes;
    try {
      subRes = await getTeacherPendingSubmissionsByHandlerCid(cid);
    } catch (e) {
      subRes = { rows: [] };
    }

    // v2_sessions schema mismatch — see SCHEMA_DRIFT_AUDIT.md cluster 12
    let sesRes;
    try {
      sesRes = await getTeacherSessionsByHandlerCid(cid);
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
