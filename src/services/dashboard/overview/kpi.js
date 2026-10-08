/**
 * Dashboard service — the Super Admin program KPI shortcut.
 *
 * A single read of the program KPI summary rows, kept apart from the overview
 * aggregation so the shortcut stays a one-liner. No SQL, no HTTP.
 */

import { getProgramKpiSummary } from "@/models/dashboard";

/** Super Admin dashboard shortcut: the program KPI summary rows. */
export async function getDashboardKpiSummary() {
  const kpiSummaryResult = await getProgramKpiSummary();
  return kpiSummaryResult.rows;
}