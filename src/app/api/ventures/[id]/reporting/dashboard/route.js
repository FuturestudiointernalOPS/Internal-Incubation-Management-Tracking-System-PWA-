import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/models/authorization/index";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { selectVentureIdentity } from "@/models/ventureReportingStore";
import { getVentureDashboard } from "@/services/ventures/reporting/dashboard";

/**
 * GET /api/ventures/[id]/reporting/dashboard
 *
 * The venture dashboard (spec §12): north-star trend, stage and progress,
 * customers, revenue, health, team and the latest narrative — all read from the
 * CALCULATED layer. Nothing here recomputes a figure.
 *
 * Readable by the founder (scoped) and by a reviewer (`ventures.validate`).
 */
export const GET = createHandler(async (req, { params }) => {
  const { id } = await params;

  const authError = await requireAuthorization("ventures", "validate");
  if (authError) {
    const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "view" });
    if (access.error) return access.error;
  }

  const venture = await selectVentureIdentity(id).catch(() => ({ rows: [] }));
  const resolved = (venture.rows || [])[0] || null;
  if (!resolved) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

  const dashboard = await getVentureDashboard({ ventureUuid: resolved.id });
  return NextResponse.json({ success: true, ...dashboard });
});
