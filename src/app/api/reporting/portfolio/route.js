import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/models/authorization/index";
import { isInternalVentureIdentity } from "@/services/ventures/portfolioAccess";
import { getPortfolioRollup } from "@/services/ventures/reporting/portfolio";
import { getReportingDiscipline } from "@/services/ventures/reporting/discipline";

/**
 * GET /api/reporting/portfolio
 *
 * The studio's view of the whole portfolio (spec §14) and of its own reporting
 * discipline (§13.9). Both are read-only folds over rows that already exist —
 * this endpoint writes nothing and stores nothing.
 *
 * Gated on `ventures.view_all` — the explicit portfolio read right. It is an
 * aggregate over every Venture, so it cannot be scoped to one. The perimeter
 * right makes the audience a grant rather than a role: a Super Admin holds it by
 * default through their profile and can lose it like anyone else.
 *
 * The per-Venture dashboard remains the scoped view.
 */
export const GET = createHandler(async (req) => {
  // A portfolio aggregate is a staff surface: a member never receives the whole
  // directory through it, whatever capability they might hold.
  if (!isInternalVentureIdentity(req.session?.role)) {
    return NextResponse.json(
      { success: false, error: "errors.insufficientPermissions" },
      { status: 403 },
    );
  }

  const authError = await requireAuthorization("ventures", "view_all", 1);
  if (authError) return authError;

  const [portfolio, discipline] = await Promise.all([
    getPortfolioRollup(),
    getReportingDiscipline(),
  ]);

  return NextResponse.json({ success: true, portfolio, discipline });
});
