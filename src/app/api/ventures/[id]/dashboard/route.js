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

    // Internal viewers = the portfolio perimeter (the explicit
    // `ventures.view_all` right, held by the owner's profile by default).
    // They see the INTERNAL audit stream + internal 'sa' notification feed.
    // Everyone else (Venture members, scoped staff) only ever receives
    // Venture-facing events — never the internal staff feed.
    const isInternalViewer =
      access.path === "super-admin" || access.path === "portfolio";
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
