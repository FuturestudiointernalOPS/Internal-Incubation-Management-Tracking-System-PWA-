import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { buildVenturePortfolio } from "@/services/ventures/portfolio";

/**
 * GET /api/admin/ventures/dashboard — the Super Admin's Portfolio overview.
 *
 * One read across the whole portfolio: Ventures by phase, Ventures by sector,
 * the distribution across the four investment-readiness levels, and how many
 * Parcours are running. This is the data behind the DASHBOARD entry the sidebar
 * shows under VENTURES, and it is deliberately portfolio-wide — a per-Venture
 * read already exists at `GET /api/ventures/[id]/dashboard`.
 *
 * The build is a pure read and never writes, so the gate is the only decision
 * this controller makes: a global portfolio view is a Super Admin concern, and
 * nobody else needs the aggregate.
 */
export const GET = createHandler({ roles: ["super_admin"] }, async () => {
  const portfolio = await buildVenturePortfolio();
  return NextResponse.json({ success: true, portfolio });
});
