import db from "@/lib/db";
import { stopRoleMutationEnabled } from "@/lib/identity";

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

