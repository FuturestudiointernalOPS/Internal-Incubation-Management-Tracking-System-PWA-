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
 * Pure data layer over venture_reports; every write is additive.
 */

function rowsOf(result) {
  return (result && result.rows) || [];
}

/** Report kinds. Anything outside this list is refused, never silently stored. */
export const REPORT_KINDS = ["progress", "closing"];

function jsonList(value) {
  const list = Array.isArray(value) ? value : [];
  return list.slice(0, 100).map((item) => (typeof item === "string" ? item.slice(0, 500) : String(item || "").slice(0, 500)));
}

export async function createVentureReport(db, { code, actorCid = null, fields = {} }) {
  const title = String(fields.title || "").trim();
  if (!title) return { error: "Report title is required." };

  // `closing` is the journey's final report; everything else is an interim one.
  // An interim report is legitimate, so it is labelled rather than refused.
  const reportKind = String(fields.report_kind || "progress").trim() || "progress";
  if (!REPORT_KINDS.includes(reportKind)) return { error: "Unknown report kind." };
  const journeyStageId = fields.journey_stage_id ? String(fields.journey_stage_id) : null;

  const completedItems = jsonList(fields.completed_items);
  const outstandingItems = jsonList(fields.outstanding_items);

  const res = await db.execute({
    sql: `INSERT INTO venture_reports
            (venture_id, title, reporting_period, summary, current_journey, current_milestone,
             completed_items, outstanding_items, support_delivered, challenges, recommendation,
             journey_stage_id, report_kind, status, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?, ?, ?, ?, ?, 'draft', ?) RETURNING id`,
    args: [
      code, title, fields.reporting_period || null, fields.summary || null,
      fields.current_journey || null, fields.current_milestone || null,
      JSON.stringify(completedItems), JSON.stringify(outstandingItems),
      fields.support_delivered || null, fields.challenges || null,
      fields.recommendation || null, journeyStageId, reportKind, actorCid || null,
    ],
  });
  return { success: true, id: res.rows?.[0]?.id ?? res.lastInsertRowid };
}

export async function listVentureReports(db, { code, status = null, journeyStageId = null }) {
  let sql = "SELECT * FROM venture_reports WHERE venture_id = ?";
  const args = [code];
  if (status) {
    sql += " AND status = ?";
    args.push(status);
  }
  if (journeyStageId) {
    sql += " AND journey_stage_id = ?";
    args.push(String(journeyStageId));
  }
  sql += " ORDER BY created_at DESC";
  const res = await db.execute({ sql, args }).catch(() => ({ rows: [] }));
  return rowsOf(res);
}

/**
 * Journeys that have closed without their closing report — what Super Admin
 * needs in order to see a gap, without anything being blocked in the meantime.
 * Returns [] rather than throwing: a Venture with no journeys, or a database
 * where the journey table is empty, is a normal state.
 */
export async function listJourneysMissingClosingReport(db, { code }) {
  const ventureResult = await db
    .execute({ sql: "SELECT id FROM ventures WHERE venture_id = ?", args: [code] })
    .catch(() => ({ rows: [] }));
  const ventureDbId = rowsOf(ventureResult)[0]?.id;
  if (!ventureDbId) return [];
  const res = await db
    .execute({
      sql: `SELECT s.id, s.name, s.stage_order, s.completed_at
            FROM venture_journey_stages s
            WHERE s.venture_id = ? AND s.status = 'completed'
              AND NOT EXISTS (
                SELECT 1 FROM venture_reports r
                WHERE r.journey_stage_id = s.id AND r.report_kind = 'closing'
              )
            ORDER BY s.stage_order ASC`,
      args: [ventureDbId],
    })
    .catch(() => ({ rows: [] }));
  return rowsOf(res);
}

export async function getVentureReport(db, { code, id }) {
  const res = await db.execute({
    sql: "SELECT * FROM venture_reports WHERE id = ? AND venture_id = ?",
    args: [id, code],
  });
  return rowsOf(res)[0] || null;
}

export async function updateVentureReportStatus(db, { code, id, status }) {
  const allowed = ["draft", "submitted", "reviewed", "archived"];
  if (!allowed.includes(status)) return { error: "Unknown report status." };
  const fields = ["status = ?", "updated_at = NOW()"];
  const args = [status];
  if (status === "submitted") {
    fields.push("submitted_at = COALESCE(submitted_at, NOW())");
  }
  args.push(id, code);
  await db.execute({
    sql: `UPDATE venture_reports SET ${fields.join(", ")} WHERE id = ? AND venture_id = ?`,
    args,
  });
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
export async function listPortfolioReports(db, { status = null, limit = 200 } = {}) {
  let sql = `SELECT r.id AS report_id, r.venture_id AS venture_code, r.title AS report_title,
                    r.reporting_period AS report_period, r.status AS report_status,
                    r.report_kind AS report_kind, r.submitted_at AS report_submitted_at,
                    r.created_at AS report_created_at, r.journey_stage_id AS report_journey_stage_id,
                    s.name AS journey_name, v.*
             FROM venture_reports r
             LEFT JOIN ventures v ON v.venture_id = r.venture_id
             LEFT JOIN venture_journey_stages s ON s.id = r.journey_stage_id`;
  const args = [];
  if (status) {
    sql += " WHERE r.status = ?";
    args.push(status);
  }
  sql += " ORDER BY r.created_at DESC LIMIT ?";
  args.push(Number(limit) || 200);

  const res = await db.execute({ sql, args }).catch(() => ({ rows: [] }));
  return rowsOf(res).map((row) => ({
    id: row.report_id,
    venture_code: row.venture_code || null,
    venture_name: row.name || row.company_name || row.venture_code || null,
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
export async function listPortfolioMissingClosingReports(db, { limit = 200 } = {}) {
  const res = await db
    .execute({
      sql: `SELECT s.id AS journey_id, s.name AS journey_name, s.stage_order,
                   s.completed_at, s.venture_id AS venture_db_id, v.*
            FROM venture_journey_stages s
            JOIN ventures v ON v.id = s.venture_id
            WHERE s.status = 'completed'
              AND NOT EXISTS (
                SELECT 1 FROM venture_reports r
                WHERE r.journey_stage_id = s.id AND r.report_kind = 'closing'
              )
            ORDER BY s.completed_at DESC NULLS LAST
            LIMIT ?`,
      args: [Number(limit) || 200],
    })
    .catch(() => ({ rows: [] }));
  return rowsOf(res).map((row) => ({
    journey_id: row.journey_id,
    journey_name: row.journey_name || null,
    completed_at: row.completed_at || null,
    venture_code: row.venture_id || null,
    venture_name: row.name || row.company_name || row.venture_id || null,
  }));
}

export default { createVentureReport, listVentureReports, getVentureReport, updateVentureReportStatus, listJourneysMissingClosingReport, listPortfolioReports, listPortfolioMissingClosingReports, REPORT_KINDS };
