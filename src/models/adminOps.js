import db from "@/lib/db";
import { stopRoleMutationEnabled } from "@/lib/identity";

/**
 * Admin/ops model — data access for the admin + ops controllers listed below.
 *
 * Each function wraps exactly one SQL statement. SQL is byte-identical to the
 * queries that used to live inline in the controllers, so behavior is unchanged.
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 *
 * Route → function-group map:
 *   src/app/api/admin/analytics/route.js          getTaskStatusStats(), getBlockerStatusStats(),
 *                                                 getSubmittedReportCountsByWeek(), getV2ProjectCount(),
 *                                                 getDistinctTaskUserCount(), getAvgBlockerResolutionSeconds(),
 *                                                 getWeeklyProductivityStats()
 *   src/app/api/admin/analytics/users/route.js    getTaskProjectUserOptions(), getTaskAggregatesForUsers(),
 *                                                 getBlockerAggregatesForUsers(), getUserProjectCounts(),
 *                                                 getUserIndependentTaskCounts(), getUserReportCompliance()
 *   src/app/api/admin/fix-participant/route.js    getLatestProgram(), getContactByCid(),
 *                                                 addParticipantProgramMembership(), clearContactProgramId(),
 *                                                 findExistingParticipantSync(), insertV2Participant()
 *   src/app/api/admin/bulk-upload/route.js        getAllActiveContactPhones(), findActiveContactByEmail(),
 *                                                 updateContactByEmail(), insertContact(),
 *                                                 deleteContactByCid(), insertBulkImportNotification()
 *   src/app/api/admin/approve-user/route.js       getUserForApproval(), approveContact(),
 *                                                 insertPasswordSetupToken(), insertApprovalAuditLog(),
 *                                                 markApprovalUserNotificationsRead()
 *   src/app/api/admin/reject-user/route.js        getUserForRejection(), rejectContact(),
 *                                                 insertRejectionAuditLog(), markRejectionUserNotificationsRead()
 *   src/app/api/admin/pending-users/route.js      listPendingUsers()
 *   src/app/api/admin/run-migration/route.js      executeMigrationStatement()
 *   src/app/api/op-reports/route.js               listOpReports(), getOpReportId(), updateOpReport(),
 *                                                 insertOpReport()
 *   src/app/api/errors/route.js                   findRecentErrorByFingerprint(),
 *                                                 findRecentErrorByMessageAndPage(), incrementErrorOccurrence(),
 *                                                 insertErrorLog(), listErrorLogs(), updateErrorResolution(),
 *                                                 updateErrorResolutionNotes(), updateErrorTaskId()
 *   src/app/api/audit-log/route.js                listAuditLogs()
 *
 * Note: extraction is strictly 1:1 with the original inline call sites, so a
 * handful of lookups (e.g. the pending-contact lookup shared by approve/reject)
 * intentionally repeat the same SQL across functions.
 */

// ── GET /api/admin/analytics — Super Admin dashboard aggregates ─────────────

/** Task counts by status across ALL users. */
export async function getTaskStatusStats() {
  return db.execute({
    sql: `SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
        COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
        COUNT(*) FILTER (WHERE status = 'blocked')::int AS blocked,
        COUNT(*) FILTER (WHERE status = 'carried_over')::int AS carried_over,
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending
        FROM tasks`,
  });
}

/** Blocker counts by status. */
export async function getBlockerStatusStats() {
  return db.execute({
    sql: `SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'active')::int AS active,
        COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved
        FROM blockers`,
  });
}

/** Standup/retro submission counts for a given week + year. */
export async function getSubmittedReportCountsByWeek(weekNumber, year) {
  return db.execute({
    sql: `SELECT
        COUNT(*) FILTER (WHERE report_type = 'standup')::int AS standups,
        COUNT(*) FILTER (WHERE report_type = 'retro')::int AS retros
        FROM v2_op_reports WHERE week_number = ? AND year = ? AND status = 'submitted'`,
    args: [weekNumber, year],
  });
}

/** Total number of v2_projects. */
export async function getV2ProjectCount() {
  return db.execute({
    sql: "SELECT COUNT(*)::int AS total FROM v2_projects",
  });
}

/** Number of distinct users that have at least one task. */
export async function getDistinctTaskUserCount() {
  return db.execute({
    sql: "SELECT COUNT(DISTINCT user_id)::int AS count FROM tasks",
  });
}

/** Average blocker resolution time in seconds (resolved blockers only). */
export async function getAvgBlockerResolutionSeconds() {
  return db.execute({
    sql: "SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)))::int AS avg_seconds FROM blockers WHERE status = 'resolved' AND resolved_at IS NOT NULL AND created_at IS NOT NULL",
  });
}

/** Tasks completed per week (by completion date), last 8 weeks. */
export async function getWeeklyProductivityStats() {
  return db.execute({
    sql: `SELECT
              EXTRACT(week FROM completed_at)::int AS week,
              EXTRACT(isoyear FROM completed_at)::int AS year,
              COUNT(*)::int AS completed
            FROM tasks
            WHERE status = 'completed' AND completed_at IS NOT NULL
            GROUP BY EXTRACT(isoyear FROM completed_at), EXTRACT(week FROM completed_at)
            ORDER BY year DESC, week DESC
            LIMIT 8`,
  });
}

// ── GET /api/admin/analytics/users — per-user execution analytics ───────────

/** Distinct task/project users with a display name (task users + project owners). */
export async function getTaskProjectUserOptions() {
  return db.execute({
    sql: `SELECT DISTINCT u.user_id AS id, COALESCE(c.name, u.user_name) AS name
            FROM (SELECT user_id, user_name FROM tasks UNION SELECT owner_id, name FROM v2_projects WHERE owner_id IS NOT NULL) u
            LEFT JOIN contacts c ON u.user_id = c.cid OR u.user_id = c.id ORDER BY name`,
  });
}

/** Per-user task status aggregates for the given user ids. */
export async function getTaskAggregatesForUsers(ids) {
  const idsPh = ids.map(() => "?").join(",");
  return db.execute({
    sql: `SELECT user_id::text AS uid,
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
                COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
                COUNT(*) FILTER (WHERE status = 'blocked')::int AS blocked,
                COUNT(*) FILTER (WHERE status = 'carried_over')::int AS carried_over,
                COUNT(*) FILTER (WHERE status = 'pending')::int AS pending
                FROM tasks WHERE user_id::text IN (${idsPh})
                GROUP BY user_id::text`,
    args: ids,
  });
}

/** Per-user blocker aggregates (total + active) for the given user ids. */
export async function getBlockerAggregatesForUsers(ids) {
  const idsPh = ids.map(() => "?").join(",");
  return db.execute({
    sql: `SELECT user_id::text AS uid,
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'active')::int AS active
                FROM blockers WHERE user_id::text IN (${idsPh})
                GROUP BY user_id::text`,
    args: ids,
  });
}

/** Distinct project count per user (tasks with a project + owned v2_projects). */
export async function getUserProjectCounts(ids) {
  const idsPh = ids.map(() => "?").join(",");
  return db.execute({
    sql: `SELECT u.uid, COUNT(DISTINCT u.pid)::int AS count
                FROM (
                  SELECT user_id::text AS uid, NULL::text AS pid FROM tasks
                    WHERE user_id::text IN (${idsPh}) AND project_id IS NOT NULL
                  UNION ALL
                  SELECT id::text AS uid, id::text AS pid FROM v2_projects
                    WHERE owner_id::text IN (${idsPh})
                ) u
                GROUP BY u.uid`,
    args: [...ids, ...ids],
  });
}

/** Count of tasks without a project per user, for the given user ids. */
export async function getUserIndependentTaskCounts(ids) {
  const idsPh = ids.map(() => "?").join(",");
  return db.execute({
    sql: `SELECT user_id::text AS uid, COUNT(*)::int AS count
                FROM tasks WHERE user_id::text IN (${idsPh}) AND project_id IS NULL
                GROUP BY user_id::text`,
    args: ids,
  });
}

/** Submitted standup/retro counts per user since week `minWeek` of `year`. */
export async function getUserReportCompliance(ids, minWeek, year) {
  const idsPh = ids.map(() => "?").join(",");
  return db.execute({
    sql: `SELECT user_id::text AS uid,
                COUNT(*) FILTER (WHERE report_type = 'standup')::int AS standups,
                COUNT(*) FILTER (WHERE report_type = 'retro')::int AS retros
                FROM v2_op_reports WHERE user_id::text IN (${idsPh})
                  AND week_number >= ? AND year = ? AND status = 'submitted'
                GROUP BY user_id::text`,
    args: [...ids, minWeek, year],
  });
}

// ── POST /api/admin/fix-participant — diagnostic participant assignment ─────

/** Latest program (used as the assignment target). */
export async function getLatestProgram() {
  return db.execute({
    sql: "SELECT id, name FROM v2_programs ORDER BY created_at DESC LIMIT 1",
    args: [],
  });
}

/** Look up a contact (participant) row by cid. */
export async function getContactByCid(cid) {
  return db.execute({
    sql: "SELECT cid, name, email, program_id, group_name FROM contacts WHERE cid = ?",
    args: [cid],
  });
}

/** Insert a participant_programs membership, ignoring duplicates. */
export async function addParticipantProgramMembership(participantId, programId) {
  return db.execute({
    sql: `INSERT INTO participant_programs (participant_id, program_id)
              VALUES (?, ?)
              ON CONFLICT (participant_id, program_id) DO NOTHING`,
    args: [participantId, programId],
  });
}

/** Clear a contact's program_id while recording the new program_name. */
export async function clearContactProgramId({ programName, contactCid }) {
  return db.execute({
    sql: "UPDATE contacts SET program_id = NULL, program_name = ? WHERE cid = ?",
    args: [programName, contactCid],
  });
}

/** Check whether a v2_participants row already exists for this email + program. */
export async function findExistingParticipantSync(email, programId) {
  return db.execute({
    sql: "SELECT id FROM v2_participants WHERE email = ? AND program_id = ?",
    args: [email, programId],
  });
}

/** Sync a participant into v2_participants as active. */
export async function insertV2Participant({ programId, userCid, name, email }) {
  return db.execute({
    sql: `INSERT INTO v2_participants (program_id, user_id, name, email, screening_status)
                VALUES (?, ?, ?, ?, 'active')`,
    args: [programId, userCid, name, email],
  });
}

// ── POST /api/admin/bulk-upload — CSV user import (validate + rollback) ─────

/** All non-empty phone numbers of non-deleted contacts (duplicate check). */
export async function getAllActiveContactPhones() {
  return db.execute({
    sql: "SELECT phone FROM contacts WHERE phone IS NOT NULL AND phone != '' AND deleted = 0 AND deleted_at IS NULL",
    args: [],
  });
}

/** Look up a non-deleted contact by email (upsert check). */
export async function findActiveContactByEmail(email) {
  return db.execute({
    sql: "SELECT cid FROM contacts WHERE email = ? AND deleted = 0 AND deleted_at IS NULL LIMIT 1",
    args: [email],
  });
}

/** Upsert branch for existing emails: reset the row to pending + new password. */
export async function updateContactByEmail({ name, phone, groupName, role, password, email }) {
  return db.execute({
    sql: `UPDATE contacts
                  SET name = ?, phone = ?, group_name = ?, role = ?, status = 'pending', password = ?
                  WHERE email = ?`,
    args: [
      name,
      phone || null,
      String(groupName || "").trim().toUpperCase(),
      role,
      password,
      email,
    ],
  });
}

/** Insert branch for new emails: a new pending contact with a generated cid. */
export async function insertContact({ cid, name, email, phone, password, role, groupName }) {
  return db.execute({
    sql: `INSERT INTO contacts (cid, name, email, phone, password, role, group_name, status, deleted)
                  VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0)`,
    args: [
      cid,
      name,
      email,
      phone || null,
      password,
      role,
      String(groupName || "").trim().toUpperCase(),
    ],
  });
}

/** Rollback helper: delete a contact that was created during this import. */
export async function deleteContactByCid(cid) {
  return db.execute({
    sql: "DELETE FROM contacts WHERE cid = ?",
    args: [cid],
  });
}

/** Notify the super admin when an import created or updated users. */
export async function insertBulkImportNotification(created, updated, errorCount) {
  return db.execute({
    sql: `INSERT INTO v2_notifications (recipient_id, title, message, type)
                VALUES ('sa', ?, ?, 'verification')`,
    args: [
      "BULK USER IMPORT",
      `${created} new users created, ${updated} updated via CSV upload. ${errorCount} errors.`,
    ],
  });
}

// ── POST /api/admin/approve-user — approve + password-setup flow ────────────

/** Find a non-deleted contact by cid (approval pre-check). */
export async function getUserForApproval(userCid) {
  return db.execute({
    sql: "SELECT * FROM contacts WHERE cid = ? AND deleted = 0 AND deleted_at IS NULL LIMIT 1",
    args: [userCid],
  });
}

/** Mark the contact approved and set their role. */
export async function approveContact(role, userCid) {
  // PHASE I2 (flag-gated): context joins no longer rewrite the baseline
  // identity — approval only changes status; the participant context lives in
  // participant_programs and legacy readers get the derived role at session
  // creation (IDENTITY_DERIVE_LEGACY_ROLE=1).
  if (stopRoleMutationEnabled()) {
    return db.execute({
      sql: "UPDATE contacts SET status = 'approved' WHERE cid = ?",
      args: [userCid],
    });
  }
  return db.execute({
    sql: "UPDATE contacts SET status = 'approved', role = ? WHERE cid = ?",
    args: [role || "participant", userCid],
  });
}

/** Store the 24h password-setup token for the approved contact. */
export async function insertPasswordSetupToken(contactCid, token, tokenHash, expiresAt) {
  return db.execute({
    sql: `INSERT INTO password_setup_tokens (contact_cid, token, token_hash, expires_at, used)
            VALUES (?, ?, ?, ?, 0)`,
    args: [
      contactCid,
      token,
      tokenHash,
      expiresAt.toISOString().replace("T", " ").replace("Z", ""),
    ],
  });
}

/** Audit-log the approval (non-critical; callers wrap in try/catch). */
export async function insertApprovalAuditLog({ adminName, userCid, userName, userEmail, expiresAt, emailSent }) {
  return db.execute({
    sql: `INSERT INTO audit_log (entity_type, entity_id, user_id, user_name, action, details, metadata)
              VALUES ('user', 0, ?, ?, 'approved', ?, ?)`,
    args: [
      adminName || "super_admin",
      userCid,
      `User '${userName}' (${userEmail}) approved. Setup email sent.`,
      JSON.stringify({
        user_name: userName,
        user_email: userEmail,
        token_expires: expiresAt.toISOString(),
        email_sent: emailSent,
      }),
    ],
  });
}

/** Mark super-admin notifications mentioning the user as read after approval. */
export async function markApprovalUserNotificationsRead(userName) {
  return db.execute({
    sql: `UPDATE v2_notifications
              SET is_read = 1
              WHERE recipient_id = 'sa'
              AND message ILIKE ?
              AND is_read = 0`,
    args: [`%${userName}%`],
  });
}

// ── POST /api/admin/reject-user — reject flow ───────────────────────────────

/** Find a non-deleted contact by cid (rejection pre-check). */
export async function getUserForRejection(userCid) {
  return db.execute({
    sql: "SELECT * FROM contacts WHERE cid = ? AND deleted = 0 AND deleted_at IS NULL LIMIT 1",
    args: [userCid],
  });
}

/** Mark the contact rejected. */
export async function rejectContact(userCid) {
  return db.execute({
    sql: "UPDATE contacts SET status = 'rejected' WHERE cid = ?",
    args: [userCid],
  });
}

/** Audit-log the rejection (non-critical; callers wrap in try/catch). */
export async function insertRejectionAuditLog({ adminName, userCid, userName, userEmail }) {
  return db.execute({
    sql: `INSERT INTO audit_log (entity_type, entity_id, user_id, user_name, action, details)
              VALUES ('user', 0, ?, ?, 'rejected', ?)`,
    args: [
      adminName || "super_admin",
      userCid,
      `User '${userName}' (${userEmail}) was rejected.`,
    ],
  });
}

/** Mark super-admin notifications mentioning the user as read after rejection. */
export async function markRejectionUserNotificationsRead(userName) {
  return db.execute({
    sql: `UPDATE v2_notifications
              SET is_read = 1
              WHERE recipient_id = 'sa'
              AND message ILIKE ?
              AND is_read = 0`,
    args: [`%${userName}%`],
  });
}

// ── GET /api/admin/pending-users — pending verification queue ───────────────

/** Pending users awaiting verification, grouped client-side by the route. */
export async function listPendingUsers() {
  return db.execute({
    sql: `SELECT cid, name, email, phone, group_name, role, created_at, program_name, gender FROM contacts WHERE status = 'pending' AND archived_at IS NULL AND deleted_at IS NULL ORDER BY created_at DESC`,
    args: [],
  });
}

// ── POST /api/admin/run-migration — temporary migration runner ──────────────

/** Execute one raw migration DDL statement. */
export async function executeMigrationStatement(sql) {
  return db.execute({ sql, args: [] });
}

// ── GET/POST /api/op-reports — operational reports ──────────────────────────

/**
 * Filtered op-report list. Non-super-admins are always scoped to their own
 * reports (the controller pre-checks 403s for cross-user requests); super
 * admins get the workspace/user filters applied.
 */
export async function listOpReports({
  isSuperAdmin,
  sessionCid,
  user_id,
  workspace,
  report_type,
  week_number,
  year,
  context_type,
  context_id,
}) {
  let sql = "SELECT * FROM v2_op_reports WHERE 1=1";
  const args = [];

  // SECURITY (Phase 0): Non-SA users can only view their own reports.
  // SA can view all reports with optional filters.
  if (!isSuperAdmin) {
    sql += " AND user_id = ?";
    args.push(String(sessionCid));
  } else {
    // Super admin overview defaults to main workspace unless specified
    if (!user_id && !workspace) {
      sql += " AND workspace = 'main'";
    } else if (workspace) {
      sql += " AND workspace = ?";
      args.push(workspace);
    }

    // SA can filter by specific user
    if (user_id) {
      sql += " AND user_id = ?";
      args.push(user_id);
    }
  }

  if (report_type) {
    sql += " AND report_type = ?";
    args.push(report_type);
  }

  if (week_number) {
    sql += " AND week_number = ?";
    args.push(parseInt(week_number));
  }

  if (year) {
    sql += " AND year = ?";
    args.push(parseInt(year));
  }

  if (context_type) {
    sql += " AND context_type = ?";
    args.push(context_type);
  }

  if (context_id) {
    sql += " AND context_id = ?";
    args.push(context_id);
  }

  sql += " ORDER BY year DESC, week_number DESC, created_at DESC";

  return db.execute({ sql, args });
}

/** Existing report id for the user/week/year/type upsert check. */
export async function getOpReportId(userId, weekNumber, year, reportType) {
  return db.execute({
    sql: "SELECT id FROM v2_op_reports WHERE user_id = ? AND week_number = ? AND year = ? AND report_type = ?",
    args: [userId, weekNumber, year, reportType],
  });
}

/**
 * Update an existing report. `updateFields` holds "col = ?" fragments plus the
 * final "updated_at = CURRENT_TIMESTAMP"; `updateArgs` ends with the report id.
 */
export async function updateOpReport(updateFields, updateArgs) {
  return db.execute({
    sql: `UPDATE v2_op_reports SET ${updateFields.join(", ")} WHERE id = ?`,
    args: updateArgs,
  });
}

/** Create a new op-report row and return its id. */
export async function insertOpReport({
  user_id,
  user_name,
  user_role,
  workspace,
  report_type,
  week_number,
  year,
  status,
  // Stand-up fields
  weekly_priorities,
  key_deliverables,
  risks_blockers,
  additional_notes,
  // New structured stand-up fields
  top_priorities,
  expected_deliverables,
  projects_tasks,
  has_dependencies,
  dependency_note,
  has_blockers,
  blocker_description,
  needs_support,
  support_note,
  // Retro fields
  completed_work,
  unfinished_tasks,
  challenges,
  wins,
  carryover_items,
  retro_notes,
  // Context fields
  context_type,
  context_id,
}) {
  return db.execute({
    sql: `INSERT INTO v2_op_reports
        (user_id, user_name, user_role, workspace, report_type, week_number, year, status,
         weekly_priorities, key_deliverables, risks_blockers, additional_notes,
         top_priorities, expected_deliverables, projects_tasks,
         has_dependencies, dependency_note, has_blockers, blocker_description,
         needs_support, support_note,
         completed_work, unfinished_tasks, challenges, wins, carryover_items, retro_notes,
         context_type, context_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?,
         ?, ?, ?, ?,
         ?, ?, ?,
         ?, ?, ?, ?,
         ?, ?,
         ?, ?, ?, ?, ?, ?,
         ?, ?) RETURNING id`,
    args: [
      user_id,
      user_name || "",
      user_role || "staff",
      workspace,
      report_type,
      week_number,
      year,
      status || "draft",
      weekly_priorities || null,
      key_deliverables || null,
      risks_blockers || null,
      additional_notes || null,
      top_priorities || null,
      expected_deliverables || null,
      projects_tasks || null,
      has_dependencies != null ? (has_dependencies ? 1 : 0) : null,
      dependency_note || null,
      has_blockers != null ? (has_blockers ? 1 : 0) : null,
      blocker_description || null,
      needs_support != null ? (needs_support ? 1 : 0) : null,
      support_note || null,
      completed_work || null,
      unfinished_tasks || null,
      challenges || null,
      wins || null,
      carryover_items || null,
      retro_notes || null,
      context_type || "staff",
      context_id || null,
    ],
  });
}

// ── POST/GET/PATCH /api/errors — client error reports + triage ──────────────

/** Unresolved matching error from the last 24h, keyed by fingerprint. */
export async function findRecentErrorByFingerprint(fingerprint) {
  return db.execute({
    sql: `SELECT id, occurrence_count FROM error_logs
              WHERE fingerprint = ?
                AND created_at > NOW() - INTERVAL '24 hours'
                AND (resolved IS NULL OR resolved = false)
              ORDER BY created_at DESC
              LIMIT 1`,
    args: [fingerprint],
  });
}

/** Fallback dedup when the fingerprint column is missing (message + page). */
export async function findRecentErrorByMessageAndPage(message, page) {
  return db.execute({
    sql: `SELECT id, occurrence_count FROM error_logs
                WHERE message = ? AND COALESCE(page, '') = COALESCE(?, '')
                  AND created_at > NOW() - INTERVAL '24 hours'
                  AND (resolved IS NULL OR resolved = false)
                ORDER BY created_at DESC
                LIMIT 1`,
    args: [message, page || ""],
  });
}

/** Bump occurrence_count of a deduplicated error and refresh its payload. */
export async function incrementErrorOccurrence(id, newCount, body) {
  return db.execute({
    sql: `UPDATE error_logs
              SET occurrence_count = ?, created_at = NOW(), user_id = ?, user_name = ?, user_role = ?, page = ?, action_attempted = ?, url = ?, status_code = ?, method = ?, endpoint = ?, request_body = ?, user_agent = ?, severity = ?, stack = ?
              WHERE id = ?`,
    args: [
      newCount,
      body.user_id || null,
      body.user_name || null,
      body.user_role || null,
      body.page || null,
      body.action_attempted || null,
      body.url || null,
      body.status_code || null,
      body.method || null,
      body.endpoint || null,
      body.request_body || null,
      body.user_agent || null,
      body.severity || "error",
      body.stack || null,
      id,
    ],
  });
}

/** Insert a new error log row with its category + fingerprint, returning id. */
export async function insertErrorLog(body, category, fingerprint) {
  return db.execute({
    sql: `INSERT INTO error_logs
            (message, stack, url, user_id, user_name, user_role, user_agent,
             severity, status_code, method, endpoint, request_body,
             page, action_attempted, category, fingerprint, occurrence_count)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            RETURNING id`,
    args: [
      body.message,
      body.stack || null,
      body.url || null,
      body.user_id || null,
      body.user_name || null,
      body.user_role || null,
      body.user_agent || null,
      body.severity || "error",
      body.status_code || null,
      body.method || null,
      body.endpoint || null,
      body.request_body || null,
      body.page || null,
      body.action_attempted || null,
      category,
      fingerprint,
    ],
  });
}

/** Filtered error-log list for the triage view. */
export async function listErrorLogs({ severity, resolved, category, search }) {
  let sql = "SELECT * FROM error_logs WHERE 1=1";
  const args = [];

  if (severity) {
    sql += " AND severity = ?";
    args.push(severity);
  }

  if (resolved === "true") {
    sql += " AND resolved = true";
  } else if (resolved === "false") {
    sql += " AND (resolved IS NULL OR resolved = false)";
  }

  if (category) {
    sql += " AND category = ?";
    args.push(category);
  }

  if (search) {
    sql += " AND message ILIKE ?";
    args.push(`%${search}%`);
  }

  sql += " ORDER BY created_at DESC";

  return db.execute({ sql, args });
}

/** Resolve/unresolve an error log (clears resolved_at when unresolved). */
export async function updateErrorResolution(id, resolved, resolutionNotes) {
  return db.execute({
    sql: "UPDATE error_logs SET resolved = ?, resolution_notes = ?, resolved_at = CASE WHEN ? THEN NOW() ELSE NULL END WHERE id = ?",
    args: [
      resolved ? 1 : 0,
      resolutionNotes || null,
      resolved ? 1 : 0,
      id,
    ],
  });
}

/** Attach resolution notes to an error log. */
export async function updateErrorResolutionNotes(id, resolutionNotes) {
  return db.execute({
    sql: "UPDATE error_logs SET resolution_notes = ? WHERE id = ?",
    args: [resolutionNotes, id],
  });
}

/** Link an error log to a follow-up task. */
export async function updateErrorTaskId(id, taskId) {
  return db.execute({
    sql: "UPDATE error_logs SET task_id = ? WHERE id = ?",
    args: [taskId, id],
  });
}

// ── GET /api/audit-log — audit trail listing ────────────────────────────────

/** Filtered audit-log entries (entity, user, action) with optional limit. */
export async function listAuditLogs({ entity_type, entity_id, user_id, action, limit }) {
  let sql = "SELECT * FROM audit_log WHERE 1=1";
  const args = [];
  if (entity_type) {
    sql += " AND entity_type = ?";
    args.push(entity_type);
  }
  if (entity_id) {
    sql += " AND entity_id = ?";
    args.push(parseInt(entity_id));
  }
  if (user_id) {
    sql += " AND user_id = ?";
    args.push(user_id);
  }
  if (action) {
    sql += " AND action = ?";
    args.push(action);
  }
  sql += " ORDER BY created_at DESC";
  if (limit) {
    sql += " LIMIT ?";
    args.push(parseInt(limit));
  }

  return db.execute({ sql, args });
}

// ── GET /api/superadmin/full-state — Super Admin dashboard counts ────────────

/** Count of active (non-archived, status = 'active') v2 programs. */
export async function countActiveV2Programs() {
  return db.execute(
    "SELECT COUNT(*) as count FROM v2_programs WHERE is_archived = 0 AND status = 'active'",
  );
}

/** Count of participant contacts (not deleted). */
export async function countParticipantContacts() {
  return db.execute(
    "SELECT COUNT(*) as count FROM contacts WHERE role = 'participant' AND deleted = 0",
  );
}

/** Count of staff contacts (admin, staff, teacher roles). */
export async function countStaffContacts() {
  return db.execute(
    "SELECT COUNT(*) as count FROM contacts WHERE role IN ('admin', 'staff', 'teacher')",
  );
}

/** Most recent activity-log entries (10). */
export async function listRecentActivityLogs() {
  return db.execute(
    "SELECT id, user_identity as user, action, module, status, created_at as timestamp FROM activity_logs ORDER BY created_at DESC LIMIT 10",
  );
}

/** Most recently created active programs (5). */
export async function listActiveV2Programs() {
  return db.execute(
    "SELECT id, name, status, created_at FROM v2_programs WHERE is_archived = 0 AND status = 'active' ORDER BY created_at DESC LIMIT 5",
  );
}
