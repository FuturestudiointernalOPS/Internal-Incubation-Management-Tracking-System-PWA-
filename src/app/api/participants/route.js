import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import { requireAuth, getSession, requireAssignmentAccess, getFacilitatorTeamScope, hasProgramManagementAccess, assertNoParticipantFacilitatorConflict } from "@/lib/auth";
import { getAuthorizationContext, authorize } from "@/lib/authorization";
import {
  upsertParticipantContact,
  getContactCidByEmail,
  enrollPendingParticipantProgram,
  logParticipantEnrollment,
  getProgramParticipants,
} from "@/models/groups";

/**
 * PARTICIPANTS API — ENROLLMENT ENGINE
 * Handles direct participant registration and contact credential sync.
 */

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["staff", "super_admin"]);
    if (authError) return authError;
    const body = await req.json();
    const { program_id, name, email, phone, screening_status } = body;

    if (!program_id || !name || !email) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    // 3. FLEXIBLE SYNC: Upsert into V1 Contacts
    // Admins never create user passwords — store an unusable random hash so
    // the participant sets their own password via the invitation/activation flow.
    const unusableHash = await bcrypt.hash(uuidv4(), 10);
    const cid = `c-${Math.random().toString(36).substr(2, 9)}`;

    await upsertParticipantContact(cid, name, email, phone, unusableHash);

    // Resolve the actual contact cid (the upsert above may have matched an
    // existing email, in which case the generated cid is not the real one).
    let contactCid = cid;
    try {
      const cRes = await getContactCidByEmail(email);
      if (cRes.rows.length > 0) contactCid = cRes.rows[0].cid;
    } catch (_) {}

    // Same-program conflict guard (Phase 2A): a facilitator in this program
    // cannot also be enrolled as a participant in the same program.
    const conflictError = await assertNoParticipantFacilitatorConflict(
      program_id,
      contactCid,
      email,
    );
    if (conflictError) return conflictError;

    // Keep participant_programs (canonical membership) in sync so direct-add
    // participants show up in the Program Participants view once active.
    try {
      await enrollPendingParticipantProgram(contactCid, program_id, screening_status);
    } catch (_) {}

    // Timeline event
    try {
      await logParticipantEnrollment(cid, program_id);
    } catch (_) {}

    return NextResponse.json({
      success: true,
      participant: {
        id: contactCid,
        program_id,
        name,
        email,
        phone,
        screening_status,
      },
    });
  } catch (error) {
    console.error("Participant POST Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(["staff", "super_admin", "program_manager", "teacher", "facilitator"]);
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const program_id = searchParams.get("program_id");

    if (!program_id) {
      return NextResponse.json({ success: true, participants: [] });
    }

    const session = await getSession();

    // Server-side enforcement (Phase 3): management roles AND holders of
    // programs.view (default template or individual grant) may list
    // participants. Everyone else — facilitators, unassigned staff, … — must
    // be assigned to the program and hold participants.view at level >= 1.
    // Assignment seam: delegates to the proven facilitator resolution chain.
    const ctx = session ? await getAuthorizationContext(session) : null;
    const canViewParticipants =
      hasProgramManagementAccess(session?.role) ||
      (!!ctx && authorize(ctx, "programs", "view"));
    if (session && !canViewParticipants) {
      const facError = await requireAssignmentAccess({
        resource: "program",
        contextId: program_id,
        capability: "participants.view",
        minLevel: 1,
      });
      if (facError) return facError;
    }

    // Canonical participant source: participant_programs (program membership)
    // + contacts (active account). id is contacts.cid so attendance and team
    // links use one consistent identifier. Form submissions and v2_participants
    // are NOT treated as operational participant membership.
    // Facilitator team scope: only participants assigned to the facilitator's
    // v2_teams (where handler_id = facilitator cid).
    let teamIds = [];
    if (session && !canViewParticipants) {
      const scope = await getFacilitatorTeamScope(program_id, session.cid);
      if (scope.scope !== "all") {
        if (scope.teamIds.length === 0) {
          return NextResponse.json({ success: true, participants: [] });
        }
        teamIds = scope.teamIds;
      }
    }

    const { rows } = await getProgramParticipants(program_id, teamIds);
    return NextResponse.json({ success: true, participants: rows });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
