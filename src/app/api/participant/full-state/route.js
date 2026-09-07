import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import {
  getFullStateContactCidByEmail,
  getFullStateProgramByName,
  getFullStateSubmissionsByParticipant,
  getFullStateSessionsByProgram,
  getFullStateNotificationsByRecipient,
  getFullStateKpisByProgram,
  getFullStateDocumentsByProgram,
  getFullStateFollowupsByProgram,
  getFullStateTeamByGroupName,
  getFullStateFamilyByName,
} from "@/models/participantPortal";

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");
    const groupName = searchParams.get("group_name");

    const session = await getSession();
    if (!session)
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    if (
      !["super_admin", "staff", "program_manager", "teacher"].includes(session.role) &&
      String(session.email || "").toLowerCase() !== String(email || "").trim().toLowerCase()
    ) {
      return NextResponse.json(
        { success: false, error: "You can only access your own data." },
        { status: 403 },
      );
    }

    if (!email || !groupName)
      return NextResponse.json({
        success: false,
        error: "Email and Group Name required",
      });

    // 1. Get Participant CID
    const userRes = await getFullStateContactCidByEmail(email);
    const cid = userRes.rows.length > 0 ? userRes.rows[0].cid : email;

    // Parallel Cluster Fetch
    const [
      progRes,
      subRes,
      sesRes,
      notRes,
      kpiRes,
      docRes,
      folRes,
      teamRes,
      familyRes,
    ] = await Promise.all([
      getFullStateProgramByName(groupName),
      getFullStateSubmissionsByParticipant(cid),
      getFullStateSessionsByProgram(groupName),
      getFullStateNotificationsByRecipient(email),
      getFullStateKpisByProgram(groupName),
      getFullStateDocumentsByProgram(groupName),
      getFullStateFollowupsByProgram(groupName),
      getFullStateTeamByGroupName(groupName),
      getFullStateFamilyByName(groupName).catch(() => ({ rows: [] })),
    ]);

    // Aggregate Grading
    const submissions = subRes.rows;
    let individualScore = 0;
    submissions.forEach((s) => {
      individualScore += parseInt(s.score || s.grade) || 0;
    });
    const groupScore = 0; // group_score column not yet available on families
    const finalGrade = individualScore + groupScore;

    return NextResponse.json({
      success: true,
      program: progRes.rows[0],
      submissions: submissions,
      sessions: sesRes.rows,
      notifications: notRes.rows,
      kpis: kpiRes.rows,
      documents: docRes.rows,
      followups: folRes.rows,
      team: teamRes.rows[0],
      grades: { individualScore, groupScore, finalGrade },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
