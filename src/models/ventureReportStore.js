/**
 * Venture progress reports — statements (REPOSITORY layer).
 *
 * The data access behind `@/services/ventures/reports`: the report CRUD, the
 * closed-journeys-without-a-closing-report reads, and the two portfolio reads.
 * The validation (title/kind/status) and the row → response mapping live in the
 * service.
 *
 * The optional filters (status, journey, limit) are assembled here, as
 * repository shaping.
 *
 * SQL is byte-identical to what used to sit inline in `src/lib/ventureReports.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";
import { resolveVentureInternalId } from "@/models/ventureIdentityStore";

// ── Report CRUD ──────────────────────────────────────────────────────────────

/** Insert one report (the 14 args are assembled by the service). */
export async function insertVentureReportRow(args) {
  const [ventureRef, ...rest] = args;
  const ventureId = await resolveVentureInternalId(ventureRef);
  return db.execute({
    sql: `INSERT INTO venture_reports
            (venture_id, title, reporting_period, summary, current_journey, current_milestone,
             completed_items, outstanding_items, support_delivered, challenges, recommendation,
             journey_stage_id, report_kind, status, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?, ?, ?, ?, ?, 'draft', ?) RETURNING id`,
    args: [ventureId, ...rest],
  });
}

/** A Venture's reports, newest first, with the optional status / journey filters. */
export async function selectVentureReports(ventureRef, { status = null, journeyStageId = null } = {}) {
  const ventureId = await resolveVentureInternalId(ventureRef);
  let sql = "SELECT * FROM venture_reports WHERE venture_id = ?";
  const args = [ventureId];
  if (status) {
    sql += " AND status = ?";
    args.push(status);
  }
  if (journeyStageId) {
    sql += " AND journey_stage_id = ?";
    args.push(String(journeyStageId));
  }
  sql += " ORDER BY created_at DESC";
  return db.execute({ sql, args });
}

/** One report by id, scoped to its Venture. */
export async function selectVentureReport(id, ventureRef) {
  const ventureId = await resolveVentureInternalId(ventureRef);
  return db.execute({
    sql: "SELECT * FROM venture_reports WHERE id = ? AND venture_id = ?",
    args: [id, ventureId],
  });
}

/** Move a report to a new status (optionally stamping submitted_at). */
export async function updateVentureReportStatusRow(id, ventureRef, status, markSubmitted) {
  const ventureId = await resolveVentureInternalId(ventureRef);
  const fields = ["status = ?", "updated_at = NOW()"];
  const args = [status];
  if (markSubmitted) {
    fields.push("submitted_at = COALESCE(submitted_at, NOW())");
  }
  args.push(id, ventureId);
  return db.execute({
    sql: `UPDATE venture_reports SET ${fields.join(", ")} WHERE id = ? AND venture_id = ?`,
    args,
  });
}

// ── Closing-report gaps ──────────────────────────────────────────────────────

/** The internal id of a Venture from its VNT code. */
export function selectVentureDbIdByCode(code) {
  return db.execute({ sql: "SELECT id FROM ventures WHERE venture_id = ?", args: [code] });
}

/** A Venture's completed journeys with no closing report. */
export function selectJourneysMissingClosingReport(ventureDbId) {
  return db.execute({
    sql: `SELECT s.id, s.name, s.stage_order, s.completed_at
            FROM venture_journey_stages s
            WHERE s.venture_id = ? AND s.status = 'completed'
              AND NOT EXISTS (
                SELECT 1 FROM venture_reports r
                WHERE r.journey_stage_id = s.id AND r.report_kind = 'closing'
              )
            ORDER BY s.stage_order ASC`,
    args: [ventureDbId],
  });
}

// ── Portfolio ────────────────────────────────────────────────────────────────

/** Every journey report across every Venture (optional status filter + limit). */
export function selectPortfolioReports(status, limit) {
  let sql = `SELECT r.id AS report_id, v.venture_id AS venture_code, r.title AS report_title,
                    r.reporting_period AS report_period, r.status AS report_status,
                    r.report_kind AS report_kind, r.submitted_at AS report_submitted_at,
                    r.created_at AS report_created_at, r.journey_stage_id AS report_journey_stage_id,
                    s.name AS journey_name, v.*
             FROM venture_reports r
             LEFT JOIN ventures v ON r.venture_id = v.id::text
             LEFT JOIN venture_journey_stages s ON s.id = r.journey_stage_id`;
  const args = [];
  if (status) {
    sql += " WHERE r.status = ?";
    args.push(status);
  }
  sql += " ORDER BY r.created_at DESC LIMIT ?";
  args.push(limit);

  return db.execute({ sql, args });
}

/** Journeys across the portfolio that closed without their closing report. */
export function selectPortfolioMissingClosingReports(limit) {
  return db.execute({
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
    args: [limit],
  });
}
