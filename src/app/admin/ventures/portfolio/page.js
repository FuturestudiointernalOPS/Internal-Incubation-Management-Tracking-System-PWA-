"use client";

import VenturePortfolioRollup from "@/components/shared/ventures/console/reporting/VenturePortfolioRollup";

/**
 * /admin/ventures/portfolio
 *
 * The portfolio roll-up (spec §14) and the studio's reporting discipline
 * (§13.9). Global, like the reporting settings — it summarises every Venture.
 */
export default function VenturePortfolioPage() {
  return <VenturePortfolioRollup />;
}
