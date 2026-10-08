import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/guards";
import { requireProgramScope } from "@/lib/programScopedAccess";
import {
  resolveGroupProgram,
  isParticipantInProgram,
  addMemberToGroup,
  listGroupMembersWithParticipants,
} from "@/services/contacts/groupMembers";

/**
 * /api/group-members — v2 team (group) membership.
 *
 * POST   /api/group-members   { group_id, participant_id }  add a member
 * GET    /api/group-members?group_id=                       list members
 *
 * The decisions live in `@/services/contacts/groupMembers` (the group's program,
 * the one-team-per-program rule); this route authenticates, resolves the record
 * scope, validates and shapes the HTTP answer.
 */

export async function POST(req) {
  try {
    const authError = await requireAuth(["staff", "super_admin"]);
    if (authError) return authError;
    const body = await req.json();
    const { group_id, participant_id } = body;

    if (!group_id || !participant_id) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Record scope: a membership write belongs to the group's program, so the
    // caller must be staffed there. The group's program is resolved first.
    const programId = await resolveGroupProgram(group_id);
    if (programId === null || programId === undefined) {
      return NextResponse.json(
        { success: false, error: "errors.notFound" },
        { status: 404 },
      );
    }
    const scopeError = await requireProgramScope({ programId, wave: "groups" });
    if (scopeError) return scopeError;

    if (await isParticipantInProgram(participant_id, programId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Participant already assigned to a team in this program.",
        },
        { status: 400 },
      );
    }

    const membership = await addMemberToGroup({
      groupId: group_id,
      participantId: participant_id,
    });

    return NextResponse.json({ success: true, membership });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function GET(req) {
  try {
    const authError = await requireAuth(["staff", "super_admin"]);
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const group_id = searchParams.get("group_id");

    // Require a group: an unscoped read dumped EVERY membership, with the full
    // participant row attached.
    if (!group_id) {
      return NextResponse.json(
        { success: false, error: "group_id is required" },
        { status: 400 },
      );
    }

    const members = await listGroupMembersWithParticipants(group_id);
    return NextResponse.json({ success: true, members });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
