import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/models/authorization/index";
import { getPortfolioRollup } from "@/services/ventures/reporting/portfolio";
import { getReportingDiscipline } from "@/services/ventures/reporting/discipline";

/**
 * GET /api/reporting/portfolio
 *
 * The studio's view of the whole portfolio (spec §14) and of its own reporting
 * discipline (§13.9). Both are read-only folds over rows that already exist —
 * this endpoint writes nothing and stores nothing.
 *
 * Gated on `ventures.validate`: it is an aggregate over every Venture, so it
 * cannot be scoped to one. The per-Venture dashboard is the scoped view.
 */
export const GET = createHandler(async () => {
  const authError = await requireAuthorization("ventures", "validate");
  if (authError) return authError;

  const [portfolio, discipline] = await Promise.all([
    getPortfolioRollup(),
    getReportingDiscipline(),
  ]);

  return NextResponse.json({ success: true, portfolio, discipline });
});
