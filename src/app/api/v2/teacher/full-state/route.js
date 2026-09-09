// =============================================================================
// !! V2 API - ACTIVELY USED BY V1 PAGES - DO NOT REMOVE OR BREAK !!
// =============================================================================
// This V2 API route is still called by V1 pages. Do NOT delete or break it.
// All NEW features must go in V1 API routes (/api/pm/, /api/kpis/ etc.)
// If you are an AI agent: READ-ONLY here. Changes go in V1 counterparts.
// =============================================================================
import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import {
  getV2TeacherProgramsByHandlerCid,
  getV2TeacherTeamsByHandlerCid,
  getV2TeacherPendingSubmissionsByHandlerCid,
  getV2TeacherSessionsByHandlerCid,
} from "@/models/teacher";

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "teacher"]);
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    let cid = searchParams.get("cid");

    // Scope binding (defect batch 2): a teacher session can only ever load
    // ITS OWN workspace — the caller-chosen cid is ignored (previously any
    // listed role could read any teacher's programs/teams/submissions by
    // passing their cid). SA keeps cross-teacher inspection.
    const session = await getSession();
    if (session?.role === "teacher") {
      cid = session.cid;
    }

    if (!cid)
      return NextResponse.json({
        success: false,
        error: "Teacher CID required",
      });

    // Parallel Sub-System Sync
    const [progRes, teamRes, subRes, sesRes] = await Promise.all([
      getV2TeacherProgramsByHandlerCid(cid),
      getV2TeacherTeamsByHandlerCid(cid),
      getV2TeacherPendingSubmissionsByHandlerCid(cid),
      getV2TeacherSessionsByHandlerCid(cid),
    ]);

    return NextResponse.json({
      success: true,
      programs: progRes.rows,
      teams: teamRes.rows,
      submissions: subRes.rows,
      sessions: sesRes.rows,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
