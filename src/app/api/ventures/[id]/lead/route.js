/**
 * POST /api/ventures/[id]/lead
 *
 * Change the lead founder / owner of a Venture (Phase 4).
 *
 * Who can do it:
 *  - super_admin, staff, program_manager, developer (privileged)
 *  - the current lead founder of the venture
 *
 * Guardrails:
 *  - the new lead must be an existing ACTIVE venture member
 *  - the previous lead is cleared first, so the venture is never left
 *    without a lead by this action (removal of the sole lead remains
 *    blocked by the members route's last-founder guard)
 *  - every change is written to ownership_history + venture_activity_log
 */

import { NextResponse } from "next/server";
import db, { initDb } from "@/lib/db";
import { requireAuth, getSession } from "@/lib/auth";
import { changeVentureLead } from "@/lib/ventures";

export async function POST(req, { params }) {
  await initDb();
  const authError = await requireAuth();
  if (authError) return authError;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const { member_id } = body;
    if (!member_id) {
      return NextResponse.json({ success: false, error: "member_id is required." }, { status: 400 });
    }

    // Resolve the venture's VNT code (the members table keys on it)
    let ventureId = id;
    if (!/^VNT-/i.test(id)) {
      const byId = await db.execute({ sql: "SELECT venture_id FROM ventures WHERE id::text = ?", args: [id] });
      if (byId.rows.length > 0) ventureId = byId.rows[0].venture_id;
    }

    // ── Authorization: privileged roles OR the current lead founder ──
    const privileged = ["super_admin", "staff", "program_manager", "developer"];

    // Archived Ventures are immutable historical records (Phase 3).
    try {
      const { requireOperationalVentureAccess } = await import("@/lib/ventureAuth");
      const gate = await requireOperationalVentureAccess({ ventureId, db, session, mutate: true });
      if (!gate.ok && gate.code === "archived") {
        return NextResponse.json({ success: false, code: "VENTURE_ARCHIVED", error: gate.reason }, { status: 409 });
      }
    } catch (_) {}

    if (!privileged.includes(session.role)) {
      const leadCheck = await db.execute({
        sql: "SELECT id FROM venture_members WHERE venture_id = ? AND (contact_id = ? OR user_cid = ?) AND lead_founder = TRUE AND removed_at IS NULL",
        args: [ventureId, session.cid, session.cid],
      });
      if (leadCheck.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "Unauthorized. Only Future Studio staff or the current lead founder can change the lead." },
          { status: 403 },
        );
      }
    }

    const result = await changeVentureLead({
      ventureId,
      memberId: member_id,
      actorCid: session.cid,
      actorName: session.name || "",
    });
    if (result.error) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    // ── Audit + notification ──
    try {
      await db.execute({
        sql: `INSERT INTO venture_activity_log (venture_id, action, actor_cid, actor_name, details, created_at)
              VALUES (?, 'LEAD_CHANGED', ?, ?, ?::jsonb, NOW())`,
        args: [ventureId, session.cid || "system", session.name || "", JSON.stringify({ member_id: member_id })],
      });
    } catch (_) {}
    try {
      const { createVentureNotification } = await import("@/lib/ventures");
      await createVentureNotification({
        recipient_id: session.cid || "sa",
        title: "Venture Lead Changed",
        message: `The lead founder of ${ventureId} has been changed.`,
      });
    } catch (_) {}

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Venture lead change error:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to change the lead founder." }, { status: 500 });
  }
}
