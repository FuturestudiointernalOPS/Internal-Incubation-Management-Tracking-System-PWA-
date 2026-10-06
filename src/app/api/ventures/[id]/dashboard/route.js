import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { buildVentureDashboard } from "@/services/ventures/dashboard";

/**
 * GET /api/ventures/[id]/dashboard
 *
 * Aggregates all venture dashboard data.
 * Each widget section loads independently — if one fails, others still return.
 */
export const GET = createHandler(
  async (req, { params }) => {
    const { id } = await params;
    const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "view" });
    if (access.error) return access.error;
    const { session } = access;

    // Internal viewers = global Venture authority (super_admin).
    // They see the INTERNAL audit stream + internal 'sa' notification feed.
    // Everyone else (Venture members, scoped staff) only ever receives
    // Venture-facing events — never the internal staff feed.
    const isInternalViewer = ["super_admin"].includes(session?.role);
    const start = Date.now();

    // Every widget section (profile, team, feeds, activity, verification,
    // documents, meetings, KPIs, coaching, readiness): services/ventures/dashboard.
    const dashboard = await buildVentureDashboard({ ventureParam: id, isInternalViewer });

    const duration = Date.now() - start;

    return NextResponse.json({
      success: true,
      dashboard,
      meta: { duration_ms: duration, generated_at: new Date().toISOString() },
    });
  },
);
