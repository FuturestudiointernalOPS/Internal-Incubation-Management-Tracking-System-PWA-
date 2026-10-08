/**
 * Venture Progress Reports (Vinance 3 — Phase 3, doc §14).
 *
 * A Manager composes a report for a Venture and submits it to Super Admin —
 * completed/outstanding items, support delivered, challenges, recommendation.
 * Read-only for Super Admin review; reports join the Venture's institutional
 * memory (listed and viewable alongside History).
 *
 * A report BELONGS TO A JOURNEY (`journey_stage_id`). Two kinds exist:
 *   - 'progress' — an interim report, any time, any number of them;
 *   - 'closing'  — the journey's final report. A journey may have at most one,
 *                  and `listJourneysMissingClosingReport` is how Super Admin
 *                  sees which journeys closed without one. Nothing is ever
 *                  BLOCKED on it: closing a journey stays automatic.
 *
 * Every statement lives in `@/models/ventureReportStore`; nothing here runs SQL.
 * This module used to be re-exported through the `@/lib/ventureReports` facade;
 * that facade is gone (CH-4) and importers read this module directly.
 * see docs/LAYER_SPLIT.md.
 */

import {
  insertVentureReportRow,
  selectVentureReports,
  selectVentureReport,
  updateVentureReportStatusRow,
  selectVentureDbIdByCode,
  selectJourneysMissingClosingReport,
  selectPortfolioReports,
  selectPortfolioMissingClosingReports,
} from "@/models/ventureReportStore";

function rowsOf(result) {
  return (result && result.rows) || [];
}

/** Report kinds. Anything outside this list is refused, never silently stored. */
export const REPORT_KINDS = ["progress", "closing"];

function jsonList(value) {
  const list = Array.isArray(value) ? value : [];
  return list.slice(0, 100).map((item) => (typeof item === "string" ? item.slice(0, 500) : String(item || "").slice(0, 500)));
}

export async function createVentureReport({ code, actorCid = null, fields = {} }) {
  const title = String(fields.title || "").trim();
  if (!title) return { error: "Report title is required." };

  // `closing` is the journey's final report; everything else is an interim one.
  // An interim report is legitimate, so it is labelled rather than refused.
  const reportKind = String(fields.report_kind || "progress").trim() || "progress";
  if (!REPORT_KINDS.includes(reportKind)) return { error: "Unknown report kind." };
  const journeyStageId = fields.journey_stage_id ? String(fields.journey_stage_id) : null;

  const completedItems = jsonList(fields.completed_items);
  const outstandingItems = jsonList(fields.outstanding_items);

  const res = await insertVentureReportRow([
    code, title, fields.reporting_period || null, fields.summary || null,
    fields.current_journey || null, fields.current_milestone || null,
    JSON.stringify(completedItems), JSON.stringify(outstandingItems),
    fields.support_delivered || null, fields.challenges || null,
    fields.recommendation || null, journeyStageId, reportKind, actorCid || null,
  ]);
  return { success: true, id: res.rows?.[0]?.id ?? res.lastInsertRowid };
}

export async function listVentureReports({ code, status = null, journeyStageId = null }) {
  const res = await selectVentureReports(code, { status, journeyStageId }).catch(() => ({ rows: [] }));
  return rowsOf(res);
}

/**
 * Journeys that have closed without their closing report — what Super Admin
 * needs in order to see a gap, without anything being blocked in the meantime.
 * Returns [] rather than throwing: a Venture with no journeys, or a database
 * where the journey table is empty, is a normal state.
 */
export async function listJourneysMissingClosingReport({ code }) {
  const ventureDbId = rowsOf(await selectVentureDbIdByCode(code).catch(() => ({ rows: [] })))[0]?.id;
  if (!ventureDbId) return [];
  const res = await selectJourneysMissingClosingReport(ventureDbId).catch(() => ({ rows: [] }));
  return rowsOf(res);
}

export async function getVentureReport({ code, id }) {
  const res = await selectVentureReport(id, code);
  return rowsOf(res)[0] || null;
}

export async function updateVentureReportStatus({ code, id, status }) {
  const allowed = ["draft", "submitted", "reviewed", "archived"];
  if (!allowed.includes(status)) return { error: "Unknown report status." };
  await updateVentureReportStatusRow(id, code, status, status === "submitted");
  return { success: true };
}

/**
 * THE PORTFOLIO VIEW — every journey report across every Venture, plus the
 * journeys that closed without their closing report.
 *
 * This deliberately crosses Venture boundaries, so the ROUTE decides who may
 * call it (global roles only); nothing here decides access.
 *
 * `v.*` is selected on purpose: the older `ventures` table carries `company_name`
 * and the newer one `name`, so the display name is resolved in JS rather than
 * the SQL assuming a column that may not exist. Every report column is aliased,
 * because `v.*` also carries `status` and `name` and would otherwise overwrite
 * the report's own values.
 */
export async function listPortfolioReports({ status = null, limit = 200 } = {}) {
  const res = await selectPortfolioReports(status, Number(limit) || 200).catch(() => ({ rows: [] }));
  return rowsOf(res).map((row) => ({
    id: row.report_id,
    venture_code: row.venture_code || null,
    // company_name is the canonical label; `name` is the legacy column.
    venture_name: row.company_name || row.name || row.venture_code || null,
    journey_stage_id: row.report_journey_stage_id || null,
    journey_name: row.journey_name || null,
    title: row.report_title,
    reporting_period: row.report_period || null,
    report_kind: row.report_kind || "progress",
    status: row.report_status,
    submitted_at: row.report_submitted_at || null,
    created_at: row.report_created_at || null,
  }));
}

/** Journeys across the whole portfolio that closed without their closing report. */
export async function listPortfolioMissingClosingReports({ limit = 200 } = {}) {
  const res = await selectPortfolioMissingClosingReports(Number(limit) || 200).catch(() => ({ rows: [] }));
  return rowsOf(res).map((row) => ({
    journey_id: row.journey_id,
    journey_name: row.journey_name || null,
    completed_at: row.completed_at || null,
    venture_code: row.venture_id || null,
    venture_name: row.company_name || row.name || row.venture_id || null,
  }));
}
