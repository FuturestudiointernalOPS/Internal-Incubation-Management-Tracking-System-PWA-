"use client";

import VenturePortfolioRollup from "@/components/shared/ventures/console/reporting/VenturePortfolioRollup";
import StudioCapitalPanel from "@/spaces/admin/components/investors/StudioCapitalPanel";

/**
 * /admin/investors/portfolio
 *
 * The STUDIO'S portfolio, surfaced inside the Investor area.
 *
 * This is Future Studio's own data — the studio's ventures, capital raised,
 * jobs, team, survival and time-in-stage — NOT an individual investor's
 * portfolio. The investor's own book of deals stays at /investor/portfolio.
 *
 * The roll-up reuses the Ventures reporting view verbatim (one source of truth);
 * the capital panel adds the F metrics derived from the venture event log.
 *
 * Read-only. Visible to the Super Admin (holders of `ventures.validate` /
 * `investor.view`).
 */
export default function InvestorStudioPortfolioPage() {
  return (
    <>
      <VenturePortfolioRollup />
      <StudioCapitalPanel />
    </>
  );
}
