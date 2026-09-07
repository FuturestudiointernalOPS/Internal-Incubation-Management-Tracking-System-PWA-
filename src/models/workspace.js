import db from "@/lib/db";

/**
 * Workspace model — shared cross-cutting data access for the API routes that
 * sit outside the vertical domains (workspaces hub, calendar, sessions,
 * notifications, profile, progress, activity, documents, categories, contact
 * emails, team tasks, export jobs).
 *
 * Route → function map:
 *  - /api/workspaces    → getStaffAssignmentsForUser, getActiveParticipantEnrollments,
 *                         getProgramAssignmentsFromContactRoles, getParticipantProgramMemberships,
 *                         getUserGroupMembershipsByNames, getInactiveGroupMembershipHistory,
 *                         getActiveResponsibilitiesForUser, getActiveVentureMembershipsForContact
 *  - /api/calendar      → getFacilitatorProgramScopePids, getParticipantProgramScopePids,
 *                         getCalendarTasksWithDates, getCalendarPrograms, getCalendarSessions,
 *                         getCalendarDeliverables, ensureFollowupsCreatedByColumn, getCalendarFollowups
 *  - /api/sessions      → createSession, listSessions
 *  - /api/notifications → createNotification, getRecentNotifications,
 *                         getNotificationRecipientById, markNotificationRead
 *  - /api/notifications/overdue       → getOverdueTasks, findRecentOverdueNotification,
 *                                       createOverdueNotification
 *  - /api/notifications/due-reminders → getTasksDueInNext24Hours, findRecentDueReminder,
 *                                       createDueReminderNotification
 *  - /api/profile       → getContactProfileFields, getContactSecondaryFields,
 *                         getContactLoginActivity, updateContactCoreFields,
 *                         updateContactSecondaryFields
 *  - /api/progress      → countDeliverablesForProgram, countApprovedSubmissions,
 *                         getMaxApprovedWeek
 *  - /api/activity      → listActivityLogs, createActivityLog
 *  - /api/documents     → ensureDocumentRequirementsResourceUrlColumn,
 *                         ensureDocumentRequirementsResourceLabelColumn,
 *                         getDocumentRequirementsByProgram, createDocumentRequirement
 *  - /api/categories    → listActiveWorkCategories
 *  - /api/contact-emails → findContactByCid
 *  - /api/team-tasks    → getTeamTasks, createTeamTask, updateTeamTaskFields, deleteTeamTask
 *  - /api/run-export    → getRunWithFormName, getRunSubmissions
 *  - /api/send-pending  → getPendingCampaignContacts, completeCampaignContact
 *
 * Each function wraps exactly one SQL statement. SQL is byte-identical to the
 * queries that used to live inline in the controllers, so behavior is unchanged.
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md §4):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data/outcome it returns.
 */

// ────────────────────────────────────────────────────────────
// /api/workspaces — neutral post-login hub data
// ────────────────────────────────────────────────────────────

/** Program staff assignments (role + program name) for a user. */
export async function getStaffAssignmentsForUser(cid, emailOrCid) {
  return db.execute({
    sql: `SELECT ps.role, CAST(ps.program_id AS TEXT) AS program_id, p.name AS program_name
            FROM v2_program_staff ps
            JOIN v2_programs p ON CAST(p.id AS TEXT) = CAST(ps.program_id AS TEXT)
            WHERE (ps.staff_id = ? OR LOWER(ps.staff_id) = LOWER(?))
            ORDER BY p.name ASC`,
    args: [cid, emailOrCid],
  });
}

/** Active participant enrollments (program id + name) for a user. */
export async function getActiveParticipantEnrollments(cid) {
  return db.execute({
    sql: `SELECT CAST(pp.program_id AS TEXT) AS program_id, p.name AS program_name
            FROM participant_programs pp
            JOIN v2_programs p ON CAST(p.id AS TEXT) = CAST(pp.program_id AS TEXT)
            WHERE pp.participant_id = ? AND (pp.status IS NULL OR pp.status = 'active')
            ORDER BY p.name ASC`,
    args: [cid],
  });
}

/** Generalized program assignments from contact_roles (dedup source). */
export async function getProgramAssignmentsFromContactRoles(cid) {
  return db.execute({
    sql: `SELECT cr.contact_cid, cr.role, cr.title, cr.context_id AS program_id,
                     cr.is_current, cr.status, cr.scope, cr.started_at, cr.ended_at,
                     p.name AS program_name
              FROM contact_roles cr
              LEFT JOIN v2_programs p ON p.id::text = cr.context_id::text
              WHERE cr.contact_cid = ? AND cr.context_type = 'program'
              ORDER BY cr.is_current DESC, cr.started_at DESC`,
    args: [cid],
  });
}

/** All participant memberships with lifecycle status (incl. completed). */
export async function getParticipantProgramMemberships(cid) {
  return db.execute({
    sql: `SELECT pp.participant_id, pp.program_id, pp.status, pp.screening_status,
                     pp.accepted_at, pp.completed_at, pp.outcome, pp.certificate_issued,
                     p.name AS program_name, p.status AS program_status
              FROM participant_programs pp
              LEFT JOIN v2_programs p ON p.id::text = pp.program_id::text
              WHERE pp.participant_id = ?
              ORDER BY pp.assigned_at DESC`,
    args: [cid],
  });
}

/**
 * Active organizational memberships for a set of group names. The placeholder
 * list is derived from the number of groups, so the generated SQL is identical
 * to the original inline `group_name IN (?,?,...)` query.
 */
export async function getUserGroupMembershipsByNames(userCid, groupNames) {
  const placeholders = groupNames.map(() => "?").join(",");
  return db.execute({
    sql: `SELECT group_name, role_in_group FROM user_groups
                WHERE user_cid = ? AND group_name IN (${placeholders})
                ORDER BY group_name`,
    args: [userCid, ...groupNames],
  });
}

/** Historical (non-active) group memberships for a user, newest first. */
export async function getInactiveGroupMembershipHistory(userCid) {
  return db.execute({
    sql: `SELECT group_name, status, started_at, expires_at
              FROM group_memberships
              WHERE user_cid = ? AND status != 'active'
              ORDER BY started_at DESC`,
    args: [userCid],
  });
}

/** Active responsibilities assigned to a user, ordered by name. */
export async function getActiveResponsibilitiesForUser(userCid) {
  return db.execute({
    sql: `SELECT r.id, r.name, r.key, r.description, r.icon
              FROM user_responsibilities ur
              JOIN responsibilities r ON r.id = ur.responsibility_id
              WHERE ur.user_cid = ? AND r.is_active = 1
              ORDER BY r.name`,
    args: [userCid],
  });
}

/** Non-removed venture memberships for a contact, newest first. */
export async function getActiveVentureMembershipsForContact(contactCid) {
  return db.execute({
    sql: `SELECT vm.*, COALESCE(v.company_name, v.name) AS venture_name, v.status AS venture_status
              FROM venture_members vm
              LEFT JOIN ventures v ON v.venture_id = vm.venture_id
              WHERE vm.contact_id = ? AND vm.removed_at IS NULL
              ORDER BY vm.joined_at DESC`,
    args: [contactCid],
  });
}

// ────────────────────────────────────────────────────────────
// /api/calendar — unified calendar event sources
// ────────────────────────────────────────────────────────────

/** Program ids a facilitator handles (teams + facilitator staff rows). */
export async function getFacilitatorProgramScopePids(cid) {
  return db.execute({
    sql: `SELECT DISTINCT CAST(program_id AS TEXT) AS pid FROM v2_teams WHERE handler_id = ?
              UNION
              SELECT DISTINCT CAST(program_id AS TEXT) AS pid FROM v2_program_staff WHERE role = 'facilitator' AND staff_id = ?`,
    args: [cid, cid],
  });
}

/** Program ids a participant is enrolled in. */
export async function getParticipantProgramScopePids(cid) {
  return db.execute({
    sql: "SELECT DISTINCT CAST(program_id AS TEXT) AS pid FROM participant_programs WHERE participant_id = ?",
    args: [cid],
  });
}

/**
 * Calendar source — tasks with a start/end date. When a user id is provided
 * the generated SQL is identical to the original inline filter
 * `AND (user_id = ? OR assigned_to = ?)`.
 */
export async function getCalendarTasksWithDates(userId) {
  let sql = `SELECT id, title, start_date, end_date, status, project_id, user_id, assigned_to FROM tasks WHERE (start_date IS NOT NULL OR end_date IS NOT NULL)`;
  const args = [];
  if (userId) {
    sql += ` AND (user_id = ? OR assigned_to = ?)`;
    args.push(userId, userId);
  }
  return db.execute({ sql, args });
}

/**
 * Calendar source — programs with dates. The caller supplies the role-scope
 * fragment (` AND CAST(id AS TEXT) IN (?,...)`, or "") and its args, so the
 * generated SQL stays identical to the original inline query.
 */
export async function getCalendarPrograms(programTableScopeSql, programScopeArgs) {
  return db.execute({
    sql: `SELECT id, name, start_date, end_date, assigned_pm_id FROM v2_programs WHERE (start_date IS NOT NULL OR end_date IS NOT NULL) AND (is_archived IS NULL OR is_archived = 0)${programTableScopeSql}`,
    args: [...programScopeArgs],
  });
}

/** Calendar source — sessions with dates, scoped the same way as programs. */
export async function getCalendarSessions(programScopeSql, programScopeArgs) {
  return db.execute({
    sql: `SELECT s.id, s.title, s.start_at, s.type, s.teacher_id, s.program_id, p.name AS program_name
              FROM v2_sessions s
              LEFT JOIN v2_programs p ON s.program_id = p.id AND (p.is_archived IS NULL OR p.is_archived = 0)
              WHERE s.start_at IS NOT NULL${programScopeSql}`,
    args: [...programScopeArgs],
  });
}

/** Calendar source — deliverables with due dates, scoped to visible programs. */
export async function getCalendarDeliverables(programScopeSql, programScopeArgs) {
  return db.execute({
    sql: `SELECT d.id, d.title, d.due_date, d.week_number, d.program_id, p.name AS program_name
              FROM v2_deliverables d
              LEFT JOIN v2_programs p ON d.program_id = p.id AND (p.is_archived IS NULL OR p.is_archived = 0)
              WHERE d.due_date IS NOT NULL${programScopeSql}`,
    args: [...programScopeArgs],
  });
}

/** Best-effort schema guard: v2_followups.created_by column exists. */
export async function ensureFollowupsCreatedByColumn() {
  return db.execute("ALTER TABLE v2_followups ADD COLUMN IF NOT EXISTS created_by TEXT");
}

/**
 * Calendar source — follow-ups with scheduled_at, scoped to visible programs
 * and further filtered by the caller-supplied visibility clause (participant →
 * own rows; non-super-admin → rows they assigned, legacy NULL rows visible).
 */
export async function getCalendarFollowups(programScopeSql, programScopeArgs, visibilitySql, visibilityArgs) {
  const sql = `SELECT f.id, f.comment, f.scheduled_at, f.followup_type, f.team_id, f.program_id, t.name AS team_name, p.name AS program_name
              FROM v2_followups f
              LEFT JOIN v2_teams t ON f.team_id = t.id
              LEFT JOIN v2_programs p ON f.program_id = p.id
              WHERE f.scheduled_at IS NOT NULL${programScopeSql}${visibilitySql}`;
  const args = [...programScopeArgs, ...visibilityArgs];
  return db.execute({ sql, args });
}

// ────────────────────────────────────────────────────────────
// /api/sessions — v2_sessions CRUD
// ────────────────────────────────────────────────────────────

/** Create a session and return its new id. */
export async function createSession(programId, title, weekNumber, type, teacherId, startAt) {
  return db.execute({
    sql: `INSERT INTO v2_sessions (program_id, title, week_number, type, teacher_id, start_at)
          VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
    args: [programId, title, weekNumber, type, teacherId, startAt],
  });
}

/** List sessions, optionally filtered to one program, ordered by week. */
export async function listSessions(programId) {
  let sql = "SELECT * FROM v2_sessions";
  const args = [];
  if (programId) {
    sql += " WHERE program_id = ?";
    args.push(programId);
  }
  sql += " ORDER BY week_number ASC";
  return db.execute({ sql, args });
}

// ────────────────────────────────────────────────────────────
// /api/notifications — signal aggregation (inbox + read actions)
// ────────────────────────────────────────────────────────────

/** Create a notification row (unread, timestamped now). */
export async function createNotification(recipientId, title, message, type) {
  return db.execute({
    sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at)
            VALUES (?, ?, ?, ?, 0, NOW())`,
    args: [recipientId, title, message, type],
  });
}

/** A recipient's 50 most recent notification rows. */
export async function getRecentNotifications(recipientId) {
  return db.execute({
    sql: "SELECT * FROM v2_notifications WHERE recipient_id = ? ORDER BY created_at DESC LIMIT 50",
    args: [recipientId],
  });
}

/** Notification row restricted to recipient_id, for ownership checks. */
export async function getNotificationRecipientById(notificationId) {
  return db.execute({
    sql: "SELECT recipient_id FROM v2_notifications WHERE id = ?",
    args: [notificationId],
  });
}

/** Mark a notification as read. */
export async function markNotificationRead(notificationId) {
  return db.execute({
    sql: "UPDATE v2_notifications SET is_read = 1 WHERE id = ?",
    args: [notificationId],
  });
}

// ────────────────────────────────────────────────────────────
// /api/notifications/overdue — overdue notification engine
// ────────────────────────────────────────────────────────────

/** Tasks past their end_date (excluding completed and archived). */
export async function getOverdueTasks() {
  return db.execute({
    sql: `SELECT id, user_id, title, end_date
            FROM tasks
            WHERE end_date < NOW()
              AND status NOT IN ('completed', 'archived')`,
    args: [],
  });
}

/** Existing 'overdue' notification for a task within the last 24 hours. */
export async function findRecentOverdueNotification(recipientId, titlePattern) {
  return db.execute({
    sql: `SELECT id FROM v2_notifications
              WHERE recipient_id = ?
                AND type = 'overdue'
                AND message ILIKE ?
                AND created_at >= NOW() - INTERVAL '24 hours'
              LIMIT 1`,
    args: [recipientId, titlePattern],
  });
}

/** Insert an 'overdue' notification. */
export async function createOverdueNotification(recipientId, title, message) {
  return db.execute({
    sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at)
              VALUES (?, ?, ?, 'overdue', 0, NOW())`,
    args: [recipientId, title, message],
  });
}

// ────────────────────────────────────────────────────────────
// /api/notifications/due-reminders — due-date reminder engine
// ────────────────────────────────────────────────────────────

/** Tasks due within the next 24 hours (excluding completed/archived/carried_over). */
export async function getTasksDueInNext24Hours() {
  return db.execute({
    sql: `SELECT id, user_id, title, end_date
            FROM tasks
            WHERE end_date BETWEEN NOW() AND NOW() + INTERVAL '24 hours'
              AND status NOT IN ('completed', 'archived', 'carried_over')`,
    args: [],
  });
}

/** Existing 'due_reminder' notification for a task within the last 6 hours. */
export async function findRecentDueReminder(recipientId, titlePattern) {
  return db.execute({
    sql: `SELECT id FROM v2_notifications
              WHERE recipient_id = ?
                AND type = 'due_reminder'
                AND message ILIKE ?
                AND created_at >= NOW() - INTERVAL '6 hours'
              LIMIT 1`,
    args: [recipientId, titlePattern],
  });
}

/** Insert a 'due_reminder' notification. */
export async function createDueReminderNotification(recipientId, title, message) {
  return db.execute({
    sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at)
              VALUES (?, ?, ?, 'due_reminder', 0, NOW())`,
    args: [recipientId, title, message],
  });
}

// ────────────────────────────────────────────────────────────
// /api/profile — profile completion read + update
// ────────────────────────────────────────────────────────────

/** Core profile fields of a contact. */
export async function getContactProfileFields(cid) {
  return db.execute({
    sql: "SELECT name, email, phone, address, language, role, group_name, image, status, created_at FROM contacts WHERE cid = ?",
    args: [cid],
  });
}

/** Optional secondary contact fields (may not exist in every environment). */
export async function getContactSecondaryFields(cid) {
  return db.execute({
    sql: "SELECT alternative_email, alternative_phone, country, country_code FROM contacts WHERE cid = ?",
    args: [cid],
  });
}

/** Login activity counters of a contact (may not exist in every environment). */
export async function getContactLoginActivity(cid) {
  return db.execute({
    sql: "SELECT last_login_at, login_count FROM contacts WHERE cid = ?",
    args: [cid],
  });
}

/**
 * Update core contact columns with a caller-built set clause list. The
 * generated SQL is identical to the original inline
 * `UPDATE contacts SET name = ?, ... WHERE cid = ?` query.
 */
export async function updateContactCoreFields(cid, setClauses, setArgs) {
  return db.execute({
    sql: `UPDATE contacts SET ${setClauses.join(", ")} WHERE cid = ?`,
    args: [...setArgs, cid],
  });
}

/** Update optional secondary contact columns (best-effort, caller try/catch). */
export async function updateContactSecondaryFields(cid, setClauses, setArgs) {
  return db.execute({
    sql: `UPDATE contacts SET ${setClauses.join(", ")} WHERE cid = ?`,
    args: [...setArgs, cid],
  });
}

// ────────────────────────────────────────────────────────────
// /api/progress — program progress metrics
// ────────────────────────────────────────────────────────────

/** Total deliverables count for a program. */
export async function countDeliverablesForProgram(programId) {
  return db.execute({
    sql: "SELECT COUNT(*) as count FROM v2_deliverables WHERE program_id = ?",
    args: [programId],
  });
}

/**
 * Approved submissions count for a program, optionally narrowed to one
 * group or one participant. The generated SQL is identical to the original
 * inline `AND group_id = ?` / `AND participant_id = ?` variants.
 */
export async function countApprovedSubmissions(programId, groupId, participantId) {
  let sql =
    "SELECT COUNT(*) as count FROM v2_submissions WHERE program_id = ? AND status = 'approved'";
  const args = [programId];

  if (groupId) {
    sql += " AND group_id = ?";
    args.push(groupId);
  } else if (participantId) {
    sql += " AND participant_id = ?";
    args.push(participantId);
  }

  return db.execute({ sql, args });
}

/**
 * Highest approved week number for a program, optionally narrowed to one
 * group or one participant. The generated SQL is identical to the original
 * inline `AND s.group_id = ?` / `AND s.participant_id = ?` variants.
 */
export async function getMaxApprovedWeek(programId, groupId, participantId) {
  return db.execute({
    sql: `SELECT MAX(d.week_number) as max_week
           FROM v2_deliverables d
           JOIN v2_submissions s ON d.id = s.deliverable_id
           WHERE s.program_id = ? AND s.status = 'approved'
           ${groupId ? "AND s.group_id = ?" : participantId ? "AND s.participant_id = ?" : ""}`,
    args: groupId
      ? [programId, groupId]
      : participantId
        ? [programId, participantId]
        : [programId],
  });
}

// ────────────────────────────────────────────────────────────
// /api/activity — activity log feed + insert
// ────────────────────────────────────────────────────────────

/** 100 most recent activity log rows. */
export async function listActivityLogs() {
  return db.execute(
    `SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 100`,
  );
}

/** Append one activity log row. */
export async function createActivityLog(userIdentity, action) {
  return db.execute({
    sql: "INSERT INTO activity_logs (user_identity, action) VALUES (?, ?)",
    args: [userIdentity, action],
  });
}

// ────────────────────────────────────────────────────────────
// /api/documents — document requirements by program
// ────────────────────────────────────────────────────────────

/** Best-effort schema guard: v2_document_requirements.resource_url column. */
export async function ensureDocumentRequirementsResourceUrlColumn() {
  return db.execute({ sql: "ALTER TABLE v2_document_requirements ADD COLUMN IF NOT EXISTS resource_url TEXT", args: [] });
}

/** Best-effort schema guard: v2_document_requirements.resource_label column. */
export async function ensureDocumentRequirementsResourceLabelColumn() {
  return db.execute({ sql: "ALTER TABLE v2_document_requirements ADD COLUMN IF NOT EXISTS resource_label TEXT", args: [] });
}

/** Document requirements of a program. */
export async function getDocumentRequirementsByProgram(programId) {
  return db.execute({
    sql: "SELECT * FROM v2_document_requirements WHERE program_id = ?",
    args: [programId],
  });
}

/** Create a document requirement, returning the inserted row. */
export async function createDocumentRequirement(programId, title, description, resourceUrl, resourceLabel) {
  return db.execute({
    sql: "INSERT INTO v2_document_requirements (program_id, title, description, resource_url, resource_label) VALUES (?, ?, ?, ?, ?) RETURNING *",
    args: [programId, title, description, resourceUrl, resourceLabel],
  });
}

// ────────────────────────────────────────────────────────────
// /api/categories — work categories
// ────────────────────────────────────────────────────────────

/** Active work categories in display order. */
export async function listActiveWorkCategories() {
  return db.execute({
    sql: "SELECT * FROM work_categories WHERE is_active = true ORDER BY sort_order ASC",
  });
}

// ────────────────────────────────────────────────────────────
// /api/contact-emails — contact identity guards
// ────────────────────────────────────────────────────────────

/** Contact existence check (row restricted to cid). */
export async function findContactByCid(cid) {
  return db.execute({ sql: "SELECT cid FROM contacts WHERE cid = ?", args: [cid] });
}

// ────────────────────────────────────────────────────────────
// /api/team-tasks — team task board
// ────────────────────────────────────────────────────────────

/** Tasks of a team with the assignee name, ordered by priority. */
export async function getTeamTasks(teamId) {
  return db.execute({
    sql: `SELECT tt.*, c.name AS assigned_name
            FROM team_tasks tt
            LEFT JOIN contacts c ON tt.assigned_to = c.cid
            WHERE tt.team_id = ?
            ORDER BY
              CASE tt.priority
                WHEN 'critical' THEN 1
                WHEN 'high' THEN 2
                WHEN 'medium' THEN 3
                WHEN 'low' THEN 4
                ELSE 5
              END,
              tt.created_at DESC`,
    args: [teamId],
  });
}

/** Create a team task, returning the inserted row. */
export async function createTeamTask(teamId, title, description, status, priority, assignedTo, createdBy) {
  return db.execute({
    sql: `INSERT INTO team_tasks (team_id, title, description, status, priority, assigned_to, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    args: [teamId, title, description, status, priority, assignedTo, createdBy],
  });
}

/**
 * Update a team task with a caller-built set clause list. The generated SQL
 * is identical to the original inline
 * `UPDATE team_tasks SET title = ?, ..., updated_at = NOW() WHERE id = ? RETURNING *`
 * query.
 */
export async function updateTeamTaskFields(taskId, setClauses, setArgs) {
  return db.execute({
    sql: `UPDATE team_tasks SET ${setClauses.join(", ")} WHERE id = ? RETURNING *`,
    args: [...setArgs, taskId],
  });
}

/** Delete a team task. */
export async function deleteTeamTask(taskId) {
  return db.execute({
    sql: "DELETE FROM team_tasks WHERE id = ?",
    args: [taskId],
  });
}

// ────────────────────────────────────────────────────────────
// /api/run-export — platform run responses export
// ────────────────────────────────────────────────────────────

/** Run row joined with its form name (export header data). */
export async function getRunWithFormName(runId) {
  return db.execute({
    sql: `SELECT r.id, r.name, r.status, f.name AS form_name
            FROM platform_form_runs r LEFT JOIN platform_forms f ON f.id = r.form_id
            WHERE r.id = ?`,
    args: [runId],
  });
}

/** Submissions of a run, newest first (export body data). */
export async function getRunSubmissions(runId) {
  return db.execute({
    sql: "SELECT id, submitter_name, status, submitted_at, data FROM platform_form_submissions WHERE run_id = ? ORDER BY submitted_at DESC NULLS LAST",
    args: [runId],
  });
}

// ────────────────────────────────────────────────────────────
// /api/send-pending — pending campaign email dispatch
// ────────────────────────────────────────────────────────────

/** Up to 10 pending campaign contacts with their first-step content. */
export async function getPendingCampaignContacts() {
  return db.execute(`
      SELECT cc.id as cc_id, cc.contact_cid, cc.campaign_id,
             c.email, c.name, cam.name as campaign_name, cam.form_id,
             cs.subject as step_subject, cs.body as step_body
      FROM campaign_contacts cc
      JOIN contacts c ON cc.contact_cid = c.cid
      JOIN campaigns cam ON cc.campaign_id = cam.id
      JOIN campaign_steps cs ON cc.campaign_id = cs.campaign_id AND cs.step_order = 0
      WHERE cc.status = 'pending'
      AND cam.status != 'paused'
      LIMIT 10
    `);
}

/** Mark a campaign contact as completed after its email was sent. */
export async function completeCampaignContact(campaignContactId) {
  return db.execute({
    sql: `UPDATE campaign_contacts SET status = 'completed', sent_at = NOW() WHERE id = ?`,
    args: [campaignContactId],
  });
}
