import { NextResponse } from "next/server";
import db, { initDb } from "@/lib/db";
import { requireAuth, getSession } from "@/lib/auth";

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
      const pp = await db.execute({
        sql: "SELECT 1 FROM participant_programs WHERE participant_id = ? LIMIT 1",
        args: [cid],
      });
      if (pp.rows?.length > 0) isProgramParticipant = true;
    } catch (_) {}
    if (!isProgramParticipant) {
      try {
        const vp = await db.execute({
          sql: "SELECT 1 FROM v2_participants WHERE user_id = ? OR LOWER(email) = LOWER((SELECT email FROM contacts WHERE cid = ?)) LIMIT 1",
          args: [cid, cid],
        });
        if (vp.rows?.length > 0) isProgramParticipant = true;
      } catch (_) {}
    }

    let ventures = [];
    try {
      const vm = await db.execute({
        sql: `SELECT v.venture_id, COALESCE(v.company_name, v.name) AS name, v.status
              FROM venture_members vm
              LEFT JOIN ventures v ON v.venture_id = vm.venture_id
              WHERE vm.contact_id = ? AND vm.removed_at IS NULL
              ORDER BY vm.joined_at DESC`,
        args: [cid],
      });
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
