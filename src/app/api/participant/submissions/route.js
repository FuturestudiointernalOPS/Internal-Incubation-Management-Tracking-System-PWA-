import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import {
  getSubmissionsByParticipantOrTeam,
  insertParticipantSubmission,
} from "@/models/participantPortal";
import {
  resolveSubmissionReadScope,
  resolveSubmissionWriteScope,
  isProgramViewOnly,
} from "@/services/participant";

async function requireSession() {
  const { getSession } = await import("@/server/auth/session");
  return getSession();
}

export const GET = createHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const participantId = searchParams.get("participant_id");
  const teamId = searchParams.get("team_id");
  const programId = searchParams.get("program_id");

  const session = await requireSession();
  if (!session)
    return NextResponse.json(
      { success: false, error: "Authentication required." },
      { status: 401 },
    );

  // The read scope decision lives in the participant service.
  const scope = resolveSubmissionReadScope({
    role: session.role,
    sessionCid: session.cid,
    participantId,
    teamId,
  });
  if (scope.error) {
    return NextResponse.json({ success: false, error: scope.error }, { status: scope.status });
  }

  const result = await getSubmissionsByParticipantOrTeam(
    scope.teamId,
    scope.participantId,
    programId,
  );
  return NextResponse.json({ success: true, submissions: result.rows });
});

export const POST = createHandler(async (req) => {
  const { participant_id, team_id, program_id, requirement_id, file_url } = await req.json();

  const session = await requireSession();
  if (!session)
    return NextResponse.json(
      { success: false, error: "Authentication required." },
      { status: 401 },
    );

  // The write scope decision lives in the participant service.
  const scope = resolveSubmissionWriteScope({
    role: session.role,
    sessionCid: session.cid,
    participantId: participant_id,
    teamId: team_id,
  });
  if (scope.error) {
    return NextResponse.json({ success: false, error: scope.error }, { status: scope.status });
  }

  // View-only gate (Phase 2C) — the decision lives in the participant service.
  const viewOnly = await isProgramViewOnly({
    role: session.role,
    sessionCid: session.cid,
    programId: program_id,
  });
  if (viewOnly) {
    return NextResponse.json(
      { success: false, error: "errors.programCompletedViewOnly" },
      { status: 403 },
    );
  }

  await insertParticipantSubmission(
    scope.participantId,
    scope.teamId,
    program_id,
    requirement_id,
    file_url,
  );

  return NextResponse.json({ success: true });
});
