/**
 * Investor service — the executive dashboard (super-admin investor overview).
 *
 * Layer (see docs/LAYER_SPLIT.md): the DECISION lives here — what the executive
 * view is made of, and the single-row shape each block takes. Every statement
 * lives in `@/models/investor`. No SQL, no HTTP.
 */

import {
  getExecutiveDashboardInvestors,
  getExecutiveDashboardVentures,
  getExecutiveDashboardFundraising,
  getExecutiveDashboardRelationships,
  getExecutiveDashboardPipeline,
  getExecutiveDashboardTopInvestors,
  getExecutiveDashboardSectorDemand,
  getExecutiveDashboardCampaignPerformance,
} from "@/models/investor";

/** Assemble the eight blocks of the executive dashboard. */
export async function buildExecutiveDashboard() {
  const [
    investors,
    ventures,
    fundraising,
    relationships,
    pipeline,
    topInvestors,
    sectorDemand,
    campaignPerformance,
  ] = await Promise.all([
    getExecutiveDashboardInvestors(),
    getExecutiveDashboardVentures(),
    getExecutiveDashboardFundraising(),
    getExecutiveDashboardRelationships(),
    getExecutiveDashboardPipeline(),
    getExecutiveDashboardTopInvestors(),
    getExecutiveDashboardSectorDemand(),
    getExecutiveDashboardCampaignPerformance(),
  ]);

  return {
    investors: investors[0],
    ventures: ventures[0],
    fundraising: fundraising[0],
    relationships: relationships[0],
    pipeline,
    topInvestors,
    sectorDemand,
    campaignPerformance,
  };
}
