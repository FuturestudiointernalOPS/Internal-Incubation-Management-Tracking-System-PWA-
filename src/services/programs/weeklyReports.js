/**
 * Programs — weekly program reports (SERVICE layer).
 *
 * The domain work behind `/api/pm/reports`: the report read with its
 * own-scope filter and KPI-name lookup, and the write with its status → score
 * mapping. The CONTROLLER keeps authentication, the capability and assignment
 * gates and the response envelope.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions, no SQL, no HTTP. It reads and
 * writes through `@/models/**`.
 */

import {
  addWeeklyReportAttachmentTypeColumn,
  addWeeklyReportAttachmentUrlColumn,
  ensureWeeklyReportSchema,
  listWeeklyReports,
  upsertWeeklyReport,
} from "@/models/curriculum";
import { listKpiNamesForPrograms } from "@/models/kpi-progress";

/**
 * Ensure the weekly-report attachment columns exist (URL link or PDF upload).
 * Idempotent and additive — mirrors the other ensure* schema helpers.
 */
async function ensureWeeklyReportAttachmentSchema() {
  try {
    await addWeeklyReportAttachmentTypeColumn();
  } catch (_) {}
  try {
    await addWeeklyReportAttachmentUrlColumn();
  } catch (_) {}
}

/** The health score a report carries, from its status. */
function reportScore(status) {
  return status === "critical"
    ? 1
    : status === "at_risk"
      ? 3
      : status === "stable"
        ? 7
        : 10;
}

/**
 * The weekly reports a caller may see, with the KPI names they cite.
 *
 * A full-access session reads the whole list; any other session sees only the
 * reports it filed itself.
 */
export async function listWeeklyReportsForSession({
  programId,
  weekNumber,
  fullAccess,
  sessionCid,
}) {
  await ensureWeeklyReportSchema();
  await ensureWeeklyReportAttachmentSchema();

  const reports = await listWeeklyReports(programId, weekNumber);
  const rows = fullAccess
    ? reports.rows
    : reports.rows.filter(
        (report) => String(report.teacher_id ?? "") === String(sessionCid ?? ""),
      );

  // The KPI names the rows refer to, in the same answer.
  //
  // A report cites its KPIs by id, and the screen has to show titles. It used to
  // resolve them by asking the KPI progress endpoint once per program on the
  // page, in a loop, which cost one round trip per program and would also make
  // each of them recalculate when it held no cached progress. The names live
  // beside the program, so they come back with the reports: one query for every
  // program in the answer, and a read that recalculates nothing.
  let kpis = [];
  try {
    const catalogue = await listKpiNamesForPrograms(
      rows.map((row) => row.program_id),
    );
    kpis = (catalogue.rows || []).map((kpi) => ({ id: kpi.id, title: kpi.title }));
  } catch (error) {
    // The names are a convenience for the screen: a report whose KPIs cannot be
    // named still belongs on the page, with its ids shown as they are.
    console.warn("[pm/reports] KPI names unavailable:", error?.message);
  }

  return { success: true, reports: rows, kpis };
}

/**
 * Upsert one program-manager weekly report.
 *
 * The body is the payload the PM workspace sends; a legacy
 * `action: "submit_pm_report"` field is accepted and ignored.
 *
 * @returns {Promise<{status: number, body: Object}>}
 */
export async function saveWeeklyReport({ payload }) {
  await ensureWeeklyReportSchema();
  await ensureWeeklyReportAttachmentSchema();

  const {
    program_id,
    week_number,
    summary,
    status,
    pm_id,
    // New structured fields
    week_status,
    week_rating,
    main_topic,
    // KPI-linked assignment tracking
    assignment_given,
    assignment_kpi_ids,
    assignment_objective,
    assignment_outcome,
    attendance_level,
    participation_level,
    participants_need_attention,
    participants_attention_notes,
    standout_participants,
    standout_notes,
    delivery_quality,
    participant_understanding,
    delivery_challenges,
    delivery_challenge_note,
    had_issues,
    issue_types,
    requires_admin_attention,
    additional_issue_note,
    program_on_track,
    planned_adjustments,
    attachment_type,
    attachment_url,
  } = payload;

  await upsertWeeklyReport(
    program_id,
    week_number,
    pm_id,
    "Program Manager",
    summary,
    reportScore(status),
    // New structured fields
    week_status || null,
    week_rating || null,
    main_topic || null,
    // KPI-linked assignment tracking
    assignment_given != null ? (assignment_given ? 1 : 0) : null,
    Array.isArray(assignment_kpi_ids) ? JSON.stringify(assignment_kpi_ids) : null,
    assignment_objective || null,
    assignment_outcome || null,
    attendance_level || null,
    participation_level || null,
    participants_need_attention != null
      ? participants_need_attention
        ? 1
        : 0
      : null,
    participants_attention_notes || null,
    standout_participants != null
      ? standout_participants
        ? 1
        : 0
      : null,
    standout_notes || null,
    delivery_quality || null,
    participant_understanding || null,
    delivery_challenges != null ? (delivery_challenges ? 1 : 0) : null,
    delivery_challenge_note || null,
    had_issues != null ? (had_issues ? 1 : 0) : null,
    Array.isArray(issue_types) ? issue_types : null,
    requires_admin_attention != null ? (requires_admin_attention ? 1 : 0) : null,
    additional_issue_note || null,
    program_on_track != null ? (program_on_track ? 1 : 0) : null,
    planned_adjustments || null,
    attachment_type || null,
    attachment_url || null,
  );

  return { status: 200, body: { success: true } };
}
