import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuth, getSession } from "@/lib/auth";
import {
  hasParticipantProgramMembership,
  hasV2ParticipantRecord,
  getVentureMembershipsForContact,
} from "@/models/contacts";

/**
 * GET /api/me/relationships
 *
 * The authenticated person's ACTUAL relationships (not their role string).
 * Used by the personal dashboard/sidebar so "what you see" follows what you
 * are a member of — program participation and venture membership — instead of
 * the legacy contact.role default.
 *
 *   isProgramParticipant : has participant_programs rows (or v2_participants)
 *   ventures             : active venture_memberships (venture_members)
 *   isVentureMember      : ventures.length > 0
 */

export async function GET() {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const session = await getSession();
    const cid = session?.cid;
    if (!cid) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    // Phase 2: personal dashboards trigger the once-per-process neutral-role
    // backfill (contacts with 'participant' role but no program/venture/group
    // relationship become the neutral 'member' role). Idempotent.
    try {
      const { backfillNeutralParticipantRoles } = await import("@/lib/contactIdentity");
      await backfillNeutralParticipantRoles();
    } catch (_) {}

    let isProgramParticipant = false;
    try {
      const pp = await hasParticipantProgramMembership(cid);
      if (pp.rows?.length > 0) isProgramParticipant = true;
    } catch (_) {}
    if (!isProgramParticipant) {
      try {
        const vp = await hasV2ParticipantRecord(cid);
        if (vp.rows?.length > 0) isProgramParticipant = true;
      } catch (_) {}
    }

    let ventures = [];
    try {
      const vm = await getVentureMembershipsForContact(cid);
      ventures = vm.rows || [];
    } catch (_) {}

    return NextResponse.json({
      success: true,
      isProgramParticipant,
      isVentureMember: ventures.length > 0,
      ventures,
    });
  } catch (error) {
    console.error("GET /api/me/relationships error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
