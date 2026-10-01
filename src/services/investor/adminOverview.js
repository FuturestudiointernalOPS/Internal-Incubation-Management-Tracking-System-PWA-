/**
 * Investor service — the admin overview (super-admin due-diligence / pipeline).
 *
 * Layer (see docs/LAYER_SPLIT.md): the DECISION lives here — what the overview
 * is made of and the single-row shape of its stats block. Every statement lives
 * in `@/models/investor`. No SQL, no HTTP.
 */

import {
  getAdminOverviewStats,
  listAdminOverviewPipelines,
  listAdminOverviewRequests,
  listAdminOverviewWorkspaces,
} from "@/models/investor";

/** Assemble the workspaces, pipelines, stats and requests of the overview. */
export async function buildAdminOverview() {
  const [workspaces, pipelines, stats, requests] = await Promise.all([
    listAdminOverviewWorkspaces(),
    listAdminOverviewPipelines(),
    getAdminOverviewStats(),
    listAdminOverviewRequests(),
  ]);

  return {
    workspaces: workspaces.rows,
    pipelines: pipelines.rows,
    stats: stats.rows[0],
    requests: requests.rows,
  };
}
