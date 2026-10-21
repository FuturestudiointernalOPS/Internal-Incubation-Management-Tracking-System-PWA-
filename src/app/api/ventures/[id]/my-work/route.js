import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { isStaffActorForVenture, roleIsPrivileged } from "@/lib/ventureAuth";
import { getVentureFacts } from "@/services/ventures/accessFacts";
import { resolveVentureInternalId } from "@/models/ventureIdentityStore";
import { activateDueStages } from "@/services/ventures/milestoneEngine";
import { buildMyWork } from "@/services/ventures/myWork";

/**
 * GET /api/ventures/[id]/my-work — the founder's work queue.
 *
 * Answers two separate questions with two separate lists:
 *
 *   personal — records assigned to THIS person (an identity, never a name);
 *   venture  — the rest of the Venture's open work, its next milestone and its
 *              next venture-facing session.
 *
 * The two lists partition the same records, so nothing is reported twice.
 *
 * ── ACCESS ──────────────────────────────────────────────────────────────────
 *
 * The SAME gate every Venture read uses: `ventures.view` + `venture_own` scope.
 * A member of the Venture, an assigned staff member and a Super Admin pass; a
 * stranger gets 403 (out of scope) or 404 (no such Venture), through the one
 * refusal shape. Nothing here weakens `/journey-report`, which stays staff-only
 * and remains the operating-report surface.
 *
 * ── WHY THIS READ SWEEPS DUE JOURNEYS ───────────────────────────────────────
 *
 * Journey activation is date-driven and happens on read (see the Journey route).
 * A Journey whose start_date has arrived becomes `active`, which is what
 * RELEASES its milestones to the Venture. Without the same sweep here, work the
 * founder can already see on the Journey tab would be missing from their queue
 * until they happened to open that tab. The sweep is idempotent, already runs on
 * other reads, and a failure is swallowed: a queue that is late beats a queue
 * that is broken.
 */
export const GET = createHandler(async (req, { params }) => {
  const { id } = await params;
  const access = await requireVentureScopedAccess({
    ventureId: id,
    module: "ventures",
    capability: "view",
  });
  if (access.error) return access.error;

  const session = req.session || access.session;
  const dbId = await resolveVentureInternalId(id);

  await activateDueStages({ dbId }).catch((error) => {
    console.warn("[ventures/my-work] journey activation skipped:", error?.message || error);
  });

  // Sealed work is withheld from a member and shown to staff — the same rule the
  // Journey projection applies (lib/ventureVisibility).
  const staff =
    roleIsPrivileged(session?.role) ||
    (session?.cid ? await isStaffActorForVenture(id, session) : false);

  // The address travels with the answer because the same work opens in a
  // different workspace for a founder and for staff.
  const facts = await getVentureFacts(id).catch(() => null);
  const code = facts?.code || id;
  const workspaceHref = staff
    ? `/staff/ventures/${encodeURIComponent(code)}`
    : `/participant/ventures/${encodeURIComponent(code)}`;

  const work = await buildMyWork({
    dbId,
    ventureCode: code,
    viewerCid: session?.cid || null,
    unsealed: Boolean(staff),
    workspaceHref,
  });

  return NextResponse.json({ success: true, my_work: work });
});
