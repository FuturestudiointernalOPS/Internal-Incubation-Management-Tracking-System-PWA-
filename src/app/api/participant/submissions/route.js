import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import {
  getSubmissionsByParticipantOrTeam,
  getSubmissionProgramCompletionStatus,
  insertParticipantSubmission,
} from "@/models/participantPortal";

export const GET = createHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  let participantId = searchParams.get("participant_id");
  let teamId = searchParams.get("team_id");
  const programId = searchParams.get("program_id");

  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  if (!session)
    return NextResponse.json(
      { success: false, error: "Authentication required." },
      { status: 401 },
    );
  const privileged = ["staff", "super_admin", "program_manager", "teacher", "facilitator"];
  if (!privileged.includes(session.role)) {
    if (participantId && String(participantId) !== String(session.cid)) {
      return NextResponse.json(
        { success: false, error: "You can only access your own submissions." },
        { status: 403 },
      );
    }
    if (teamId && session.role !== "team") {
      return NextResponse.json(
        { success: false, error: "You cannot access team submissions." },
        { status: 403 },
      );
    }
    if (!participantId && !teamId) participantId = session.cid;
  }

  const res = await getSubmissionsByParticipantOrTeam(teamId, participantId, programId);
  return NextResponse.json({ success: true, submissions: res.rows });
});

export const POST = createHandler(async (req) => {
  let { participant_id, team_id, program_id, requirement_id, file_url } =
    await req.json();

  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  if (!session)
    return NextResponse.json(
      { success: false, error: "Authentication required." },
      { status: 401 },
    );
  const privileged = ["staff", "super_admin", "program_manager", "teacher"];
  if (!privileged.includes(session.role)) {
    if (participant_id && String(participant_id) !== String(session.cid)) {
      return NextResponse.json(
        { success: false, error: "You can only create your own submissions." },
        { status: 403 },
      );
    }
    if (team_id && session.role !== "team") {
      return NextResponse.json(
        { success: false, error: "You cannot create team submissions." },
        { status: 403 },
      );
    }
    if (!participant_id && !team_id) participant_id = session.cid;
  }

  // View-only gate (Phase 2C): participants/teams cannot submit into a
  // completed program (person-level completion or program-level). Staff / PM /
  // teacher / super_admin manage regardless of program status.
  if (program_id && !privileged.includes(session.role)) {
    try {
      const pCheck = await getSubmissionProgramCompletionStatus(session.cid, program_id);
      const st = String(pCheck.rows[0]?.status || "").toLowerCase();
      if (st === "completed") {
        return NextResponse.json(
          { success: false, error: "errors.programCompletedViewOnly" },
          { status: 403 },
        );
      }
    } catch (_) {}
  }

  await insertParticipantSubmission(
    participant_id,
    team_id,
    program_id,
    requirement_id,
    file_url,
  );

  return NextResponse.json({ success: true });
});
