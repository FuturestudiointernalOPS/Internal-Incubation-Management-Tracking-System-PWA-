/**
 * Dashboard — the overview aggregation (SERVICE layer).
 *
 * Layer (see docs/LAYER_SPLIT.md): the work behind `GET /api/dashboard` lives in
 * `./overview/` — the date helpers (`dates`), the calendar assembly (`calendar`),
 * the attention shaping (`attention`), the quick-access projects (`projects`),
 * the Super Admin KPI shortcut (`kpi`) and the parallel-read orchestration
 * (`build`). This file re-exports the same public surface, so the controller
 * keeps importing from here.
 *
 * HTTP-free: it reads through `@/models/dashboard` and `@/models/workspace` and
 * answers `{ status, body }`. The controller keeps `initDb`, the authentication
 * and the response envelope.
 */

export { toDateStr, dateRange } from "./overview/dates";
export { buildOverviewCalendar } from "./overview/calendar";
export { summarizeTaskStats, summarizeBlockers } from "./overview/attention";
export { buildQuickAccessProjects } from "./overview/projects";
export { getDashboardKpiSummary } from "./overview/kpi";
export { buildDashboardOverview } from "./overview/build";
