/**
 * Ops reports — the weekly stand-up / retro use case (SERVICE layer).
 *
 * The decisions behind `GET`/`POST /api/op-reports`:
 *  - who may read whose reports (only a super admin reads beyond their own);
 *  - the upsert: update when a report already exists for user + week + year +
 *    type, create otherwise;
 *  - which fields an update may touch, and the rule that an empty
 *    `projects_tasks` never erases the stored one (the auto-generated task list);
 *  - the workspace a NEW report lands in — interns vs everyone else.
 *
 * HTTP-free: it reads and writes through `@/models/adminOps` and answers
 * `{ status, body }`. The controller keeps `initDb`, the capability gate and the
 * response envelope.
 */

import {
  getOpReportId,
  insertOpReport,
  listOpReports,
  updateOpReport,
} from "@/models/adminOps";

// The fields an update may carry, in the order the UPDATE statement lists them.
// The argument order is significant, so this array is the single source of truth.
const UPDATEABLE_FIELDS = [
  "weekly_priorities",
  "key_deliverables",
  "risks_blockers",
  "additional_notes",
  "top_priorities",
  "expected_deliverables",
  "projects_tasks",
  "has_dependencies",
  "dependency_note",
  "has_blockers",
  "blocker_description",
  "needs_support",
  "support_note",
  "completed_work",
  "unfinished_tasks",
  "challenges",
  "wins",
  "carryover_items",
  "retro_notes",
  "context_type",
  "context_id",
];

/**
 * The report list one caller is allowed to read.
 *
 * @returns {Promise<{status:number, body:object}>}
 */
export async function listReports({ session, filters }) {
  // SECURITY (Phase 0): only a super admin reads beyond their own reports.
  if (session.role !== "super_admin") {
    const requested = filters.user_id;
    if (requested && String(requested) !== String(session.cid)) {
      return {
        status: 403,
        body: {
          success: false,
          error: "You can only view your own operational reports.",
        },
      };
    }
  }

  const result = await listOpReports({
    isSuperAdmin: session.role === "super_admin",
    sessionCid: session.cid,
    user_id: filters.user_id,
    workspace: filters.workspace,
    report_type: filters.report_type,
    week_number: filters.week_number,
    year: filters.year,
    context_type: filters.context_type,
    context_id: filters.context_id,
  });

  return { status: 200, body: { success: true, reports: result.rows } };
}

/**
 * Create or update a report. The upsert key is user + week + year + type: a
 * matching row is updated in place, anything else is inserted.
 *
 * @returns {Promise<{status:number, body:object}>}
 */
export async function saveReport(payload) {
  const { user_id, report_type, week_number, year, status } = payload;

  if (!user_id || !report_type || !week_number || !year) {
    return {
      status: 400,
      body: {
        success: false,
        error: "user_id, report_type, week_number, and year are required",
      },
    };
  }

  const existing = await getOpReportId(user_id, week_number, year, report_type);

  if (existing.rows.length > 0) {
    const reportId = existing.rows[0].id;
    const updateFields = [];
    const updateArgs = [];

    for (const field of UPDATEABLE_FIELDS) {
      const value = payload[field];
      if (value === undefined) continue;
      // Merge projects_tasks: don't overwrite auto-generated tasks with empty/null
      if (field === "projects_tasks" && (!value || String(value).trim() === "")) {
        continue; // skip — keep existing tasks
      }
      updateFields.push(`${field} = ?`);
      updateArgs.push(value);
    }

    if (status) {
      updateFields.push("status = ?");
      updateArgs.push(status);
    }

    updateFields.push("updated_at = CURRENT_TIMESTAMP");
    updateArgs.push(reportId);

    if (updateFields.length > 1) {
      await updateOpReport(updateFields, updateArgs);
    }

    return { status: 200, body: { success: true, id: reportId, action: "updated" } };
  }

  // Interns land in their own workspace; everyone else in the main one.
  const workspace = payload.user_role === "intern" ? "interns" : "main";
  const result = await insertOpReport({
    user_id,
    user_name: payload.user_name,
    user_role: payload.user_role,
    workspace,
    report_type,
    week_number,
    year,
    status,
    weekly_priorities: payload.weekly_priorities,
    key_deliverables: payload.key_deliverables,
    risks_blockers: payload.risks_blockers,
    additional_notes: payload.additional_notes,
    top_priorities: payload.top_priorities,
    expected_deliverables: payload.expected_deliverables,
    projects_tasks: payload.projects_tasks,
    has_dependencies: payload.has_dependencies,
    dependency_note: payload.dependency_note,
    has_blockers: payload.has_blockers,
    blocker_description: payload.blocker_description,
    needs_support: payload.needs_support,
    support_note: payload.support_note,
    completed_work: payload.completed_work,
    unfinished_tasks: payload.unfinished_tasks,
    challenges: payload.challenges,
    wins: payload.wins,
    carryover_items: payload.carryover_items,
    retro_notes: payload.retro_notes,
    context_type: payload.context_type,
    context_id: payload.context_id,
  });

  return {
    status: 200,
    body: {
      success: true,
      id: Number(result.rows[0]?.id ?? result.lastInsertRowid),
      action: "created",
    },
  };
}
