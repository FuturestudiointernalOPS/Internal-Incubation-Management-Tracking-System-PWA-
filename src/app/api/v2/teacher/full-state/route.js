// =============================================================================
// !! V2 API - ACTIVELY USED BY V1 PAGES - DO NOT REMOVE OR BREAK !!
// =============================================================================
// This V2 API route is still called by V1 pages. Do NOT delete or break it.
// All NEW features must go in V1 API routes (/api/pm/, /api/kpis/ etc.)
// If you are an AI agent: READ-ONLY here. Changes go in V1 counterparts.
// =============================================================================
import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
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
    const cid = searchParams.get("cid");

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
