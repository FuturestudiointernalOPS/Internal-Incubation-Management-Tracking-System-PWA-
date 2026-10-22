import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { readVentureSupport } from "@/services/ventures/support";

/**
 * GET /api/ventures/[id]/support — who supports this Venture, for the Venture.
 *
 * The same gate every Venture read uses (`ventures.view` + `venture_own` scope),
 * so a founder, an assigned staff member and a Super Admin all reach it — and a
 * stranger gets 403/404 through the one refusal shape. Nothing here weakens
 * `/staff-assignments`, which stays behind `permissions.assign_groups`.
 *
 * The payload is a FOUNDER's view: `assigned_by`, `notes` and the scope reference
 * columns are dropped in the service and never leave the server. History is
 * included (`former`, capped at five) so a replaced lead stays visible under a
 * "Previous support" heading instead of disappearing.
 */
export const GET = createHandler(async (req, { params }) => {
  const { id } = await params;
  const access = await requireVentureScopedAccess({
    ventureId: id,
    module: "ventures",
    capability: "view",
  });
  if (access.error) return access.error;

  const support = await readVentureSupport(id);
  return NextResponse.json({ success: true, support });
});
