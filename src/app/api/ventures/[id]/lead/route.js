/**
 * POST /api/ventures/[id]/lead
 *
 * Change the lead founder / owner of a Venture (Phase 4).
 *
 * Who can do it:
 *  - super_admin, staff, program_manager (privileged)
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
import { initDb } from "@/lib/db";
import { requireAuth } from "@/server/auth/guards";
import { getSession } from "@/server/auth/session";
import { changeVentureLead } from "@/services/ventures/record";
import {
  findLeadFounderMembership,
  logVentureLeadChanged,
} from "@/models/ventureJourney";
import { resolveVentureInternalId } from "@/services/ventures/identity";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { isPlatformOwnerRole } from "@/lib/identity";

export async function POST(req, { params }) {
  await initDb();
  const authError = await requireAuth();
  if (authError) return authError;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "errors.authRequired" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const { member_id } = body;
    if (!member_id) {
      return NextResponse.json({ success: false, error: "member_id is required." }, { status: 400 });
    }

    // Resolve the Venture's INTERNAL id ONCE. Since Phase 0 the members table,
    // the staff assignments and the activity log all key on it — the VNT code is
    // only the access key carried by the URL (docs/VENTURE_IDENTITY_PHASE0.md).
    const ventureId = (await resolveVentureInternalId(id)) || id;

    // ── Authorization: the canonical write gate ──
    // Capability (`ventures.edit`) plus the venture perimeter: the platform
    // owner bypasses, delegated staff need an active assignment, and the
    // current lead founder passes through their membership.
    const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "edit" });
    if (access.error) return access.error;

    // Archived Ventures are immutable historical records (Phase 3).
    try {
      const { requireOperationalVentureAccess } = await import("@/lib/ventureAuth");
      const gate = await requireOperationalVentureAccess({ ventureId, session, mutate: true });
      if (!gate.ok && gate.code === "archived") {
        return NextResponse.json({ success: false, code: "VENTURE_ARCHIVED", error: gate.reason }, { status: 409 });
      }
    } catch (_) {}

    // Beyond the platform owner, only the CURRENT lead founder may hand the
    // lead over. The gate above already bounded this to the Venture.
    if (!isPlatformOwnerRole(session.role)) {
      const leadCheck = await findLeadFounderMembership(ventureId, session.cid);
      if (leadCheck.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "errors.ventureLeadChangeDenied" },
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
      await logVentureLeadChanged(
        ventureId,
        session.cid || "system",
        session.name || "",
        JSON.stringify({ member_id: member_id }),
      );
    } catch (_) {}
    try {
      const { createVentureNotification } = await import("@/services/ventures/activity");
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
