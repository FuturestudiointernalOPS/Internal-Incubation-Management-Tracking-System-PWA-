import db from "@/lib/db";

// ── GET /api/ventures/[id]/dashboard ─────────────────────────────────────────

/** Venture identity row for the dashboard. */
export async function getVentureDashboardInfo(ventureId) {
  return db.execute({
    sql: "SELECT company_name, venture_id, industry, business_stage, status, created_at, description, website, logo_url, registration_number FROM ventures WHERE venture_id = ?",
    args: [ventureId],
  });
}

/** Active member recipient ids of a Venture (contact + user cid). */
export function listVentureMemberRecipients(ventureId) {
  return db.execute({
    sql: "SELECT contact_id, user_cid FROM venture_members WHERE venture_id = ? AND removed_at IS NULL",
    args: [ventureId],
  });
}

/** The internal 'sa' notification feed (recent 10). */
export function selectInternalNotificationFeed() {
  return db.execute({
    sql: `SELECT id, title, message, type, is_read, created_at
                FROM v2_notifications
                WHERE recipient_id = 'sa'
                ORDER BY created_at DESC LIMIT 10`,
  });
}

/** The notification feed for a set of recipients (optionally + internal 'sa'). */
export function selectVentureNotificationFeed({ recipientIds, includeInternal }) {
  const orInternal = includeInternal ? " OR recipient_id = 'sa'" : "";
  return db.execute({
    sql: `SELECT id, title, message, type, is_read, created_at
                FROM v2_notifications
                WHERE recipient_id IN (${recipientIds.map(() => "?").join(", ")})${orInternal}
                ORDER BY created_at DESC LIMIT 10`,
    args: recipientIds,
  });
}

/** The Venture's recent activity log rows (40). */
export function listVentureActivityLog(ventureId) {
  return db.execute({
    sql: `SELECT id, action, actor_name, details, created_at
                FROM venture_activity_log WHERE venture_id = ?
                ORDER BY created_at DESC LIMIT 40`,
    args: [ventureId],
  });
}

/** The Venture's recent documents (live, archive column). */
export function listVentureDocumentsForDashboard(ventureId) {
  return db.execute({
    sql: "SELECT id, title, category, file_name, file_type, file_size, uploaded_by, created_at FROM venture_documents WHERE venture_id = ? AND is_deleted = false ORDER BY created_at DESC LIMIT 5",
    args: [ventureId],
  });
}

/** Legacy fallback: the same documents without the is_deleted guard. */
export function listVentureDocumentsForDashboardLegacy(ventureId) {
  return db.execute({
    sql: "SELECT id, title, category, file_name, file_type, file_size, uploaded_by, created_at FROM venture_documents WHERE venture_id = ? ORDER BY created_at DESC LIMIT 5",
    args: [ventureId],
  });
}

/** Upcoming calendar events of a Venture (5). */
export function listVentureMeetings(ventureId) {
  return db.execute({
    sql: `SELECT id, title, description, event_date, event_time, status, type
                FROM calendar_events WHERE venture_id = ? AND event_date >= CURRENT_DATE
                ORDER BY event_date ASC LIMIT 5`,
    args: [ventureId],
  });
}

/** The Venture's recent KPI assignments (5). */
export function listVentureKpiSummary(dbId) {
  return db.execute({
    sql: `SELECT d.name, d.unit, d.auto_calc_source, a.target_value, a.current_value, a.updated_at
                FROM venture_kpi_assignments a
                JOIN venture_kpi_definitions d ON d.id = a.kpi_definition_id
                WHERE a.venture_id::text = ?
                ORDER BY a.updated_at DESC LIMIT 5`,
    args: [dbId],
  });
}

/** Count a Venture's advisors. */
export function countVentureAdvisors(dbId) {
  return db.execute({ sql: "SELECT COUNT(*) AS n FROM venture_advisors WHERE venture_id::text = ?", args: [dbId] });
}

/** Count a Venture's coaching sessions. */
export function countVentureCoachingSessions(dbId) {
  return db.execute({ sql: "SELECT COUNT(*) AS n FROM venture_coaching_sessions WHERE venture_id::text = ?", args: [dbId] });
}

/** Count a Venture's active coach assignments. */
export function countVentureActiveCoachAssignments(dbId) {
  return db.execute({ sql: "SELECT COUNT(*) AS n FROM venture_coach_assignments WHERE venture_id::text = ? AND status = 'active'", args: [dbId] });
}

// ── GET/POST/PATCH /api/ventures/[id]/blockers ───────────────────────────────

/** Internal ventures.id by VNT code — blockers resolveVentureDbId helper. */
export async function getVentureDbIdForBlockers(venture_id) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ?",
    args: [venture_id],
  });
}

/** Venture blockers with creator names, newest first. */
export async function listVentureBlockersWithCreators(venture_id) {
  return db.execute({
    sql: `SELECT b.*, c.name as creator_name FROM blockers b LEFT JOIN contacts c ON b.user_id = c.cid WHERE b.venture_id = ? ORDER BY b.created_at DESC`,
    args: [venture_id],
  });
}

/** Task existence check scoped to a venture. */
export async function getVentureTaskByVentureId(task_id, venture_id) {
  return db.execute({
    sql: "SELECT id FROM venture_tasks WHERE id = ? AND venture_id = ?",
    args: [task_id, venture_id],
  });
}

/** Contact display name for the blocker creator. */
export async function getContactNameByCid(cid) {
  return db.execute({
    sql: "SELECT name FROM contacts WHERE cid = ?",
    args: [cid],
  });
}

/** Schema backfill: drop the legacy blockers task fkey constraint (best-effort). */
export async function dropBlockersTaskForeignKeyIfExists() {
  return db.execute({
    sql: "ALTER TABLE blockers DROP CONSTRAINT IF EXISTS blockers_task_id_fkey",
    args: [],
  });
}

/** Schema backfill: ensure the blockers supporting_url column (best-effort). */
export async function addSupportingUrlColumnToBlockers() {
  return db.execute({
    sql: "ALTER TABLE blockers ADD COLUMN IF NOT EXISTS supporting_url TEXT",
    args: [],
  });
}

/** Insert a retro-sourced venture blocker (status defaults to 'active'). */
export async function insertVentureBlocker({ task_id, title, description, venture_id, venture_retro_id, user_id, user_name, supporting_url }) {
  return db.execute({
    sql: "INSERT INTO blockers (task_id, title, description, venture_id, venture_retro_id, status, user_id, user_name, supporting_url) VALUES (?,?,?,?,?,'active',?,?,?)",
    args: [task_id, title, description || null, venture_id, venture_retro_id, user_id, user_name || "", supporting_url || null],
  });
}

/** Creator of a venture blocker (resolve permission check). */
export async function getVentureBlockerCreator(blocker_id, venture_id) {
  return db.execute({
    sql: "SELECT user_id FROM blockers WHERE id = ? AND venture_id = ?",
    args: [blocker_id, venture_id],
  });
}

/** Mark a venture blocker resolved (records who resolved it). */
export async function resolveVentureBlocker(blocker_id, resolved_by) {
  return db.execute({
    sql: "UPDATE blockers SET status='resolved', resolved_at=NOW(), resolved_by=? WHERE id=?",
    args: [resolved_by, blocker_id],
  });
}

// ── GET/POST /api/ventures/[id]/standups ─────────────────────────────────────

/** Internal ventures.id by VNT code — standups resolveVentureDbId helper. */
export async function getVentureDbIdForStandups(venture_id) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ?",
    args: [venture_id],
  });
}

/** Standup row id for a venture/week (current-week submitted check). */
export async function getStandupForWeek(venture_id, week_number, year) {
  return db.execute({
    sql: "SELECT id FROM venture_standups WHERE venture_id = ? AND week_number = ? AND year = ? LIMIT 1",
    args: [venture_id, week_number, year],
  });
}

/** All venture standups with creator names, newest week/year first. */
export async function listVentureStandupsWithCreators(venture_id) {
  return db.execute({
    sql: `SELECT vs.*, c.name as creator_name FROM venture_standups vs LEFT JOIN contacts c ON vs.created_by = c.cid WHERE vs.venture_id = ? ORDER BY vs.year DESC, vs.week_number DESC`,
    args: [venture_id],
  });
}

/** Insert a weekly venture standup. */
export async function insertVentureStandup({ venture_id, week_number, year, top_priorities, expected_deliverables, weekly_priorities, created_by }) {
  return db.execute({
    sql: "INSERT INTO venture_standups (venture_id, week_number, year, top_priorities, expected_deliverables, weekly_priorities, created_by) VALUES (?,?,?,?,?,?,?)",
    args: [venture_id, week_number, year, top_priorities || null, expected_deliverables || null, weekly_priorities || null, created_by],
  });
}

// ── GET/POST /api/ventures/[id]/retros ───────────────────────────────────────

/** Internal ventures.id by VNT code — retros resolveVentureDbId helper. */
export async function getVentureDbIdForRetros(venture_id) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ?",
    args: [venture_id],
  });
}

/** Retro row id for a venture/week (current-week submitted check). */
export async function getRetroForWeek(venture_id, week_number, year) {
  return db.execute({
    sql: "SELECT id FROM venture_retros WHERE venture_id = ? AND week_number = ? AND year = ? LIMIT 1",
    args: [venture_id, week_number, year],
  });
}

/** All venture retros with creator names, newest week/year first. */
export async function listVentureRetrosWithCreators(venture_id) {
  return db.execute({
    sql: "SELECT vr.*, c.name as creator_name FROM venture_retros vr LEFT JOIN contacts c ON vr.created_by = c.cid WHERE vr.venture_id = ? ORDER BY vr.year DESC, vr.week_number DESC",
    args: [venture_id],
  });
}

/** Insert a weekly venture retro. */
export async function insertVentureRetro({ venture_id, week_number, year, completed_tasks, outstanding_tasks, carry_forward_notes, created_by }) {
  return db.execute({
    sql: "INSERT INTO venture_retros (venture_id, week_number, year, completed_tasks, outstanding_tasks, carry_forward_notes, created_by) VALUES (?,?,?,?,?,?,?)",
    args: [venture_id, week_number, year, completed_tasks || null, outstanding_tasks || null, carry_forward_notes || null, created_by],
  });
}

// ── GET /api/ventures/[id]/calendar ──────────────────────────────────────────

/** Internal ventures.id by VNT code — calendar resolveVentureDbId helper. */
export async function getVentureDbIdForCalendar(venture_id) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ?",
    args: [venture_id],
  });
}

/** Venture tasks with due dates (calendar events). */
export async function listVentureTasksWithDueDates(venture_id) {
  return db.execute({
    sql: "SELECT id, title, due_date as date, status, priority FROM venture_tasks WHERE venture_id = ? AND due_date IS NOT NULL ORDER BY due_date",
    args: [venture_id],
  });
}

/** Venture milestones with target dates (calendar events). */
export async function listVentureMilestonesWithTargetDates(venture_id) {
  return db.execute({
    sql: "SELECT id, title, target_date as date, status FROM venture_milestones WHERE venture_id = ? AND target_date IS NOT NULL ORDER BY target_date",
    args: [venture_id],
  });
}

/** Venture action plans with deadlines (calendar events). */
export async function listVentureActionPlansWithDeadlines(venture_id) {
  return db.execute({
    sql: "SELECT id, title, deadline as date, status, priority FROM venture_action_plans WHERE venture_id = ? AND deadline IS NOT NULL ORDER BY deadline",
    args: [venture_id],
  });
}

/** Coaching sessions with session dates (calendar events). */
export async function listVentureCoachingSessionsForCalendar(venture_id) {
  return db.execute({
    sql: `SELECT vcs.id, CONCAT(c.name, ' Coaching') as title, vcs.session_date as date, c.name as advisor_name, vcs.location, vcs.meeting_link, vcs.start_time FROM venture_coaching_sessions vcs LEFT JOIN contacts c ON vcs.advisor_contact_id = c.cid WHERE vcs.venture_id = ? AND vcs.session_date IS NOT NULL ORDER BY vcs.session_date`,
    args: [venture_id],
  });
}

/** Coaching follow-up dates as separate calendar events. */
export async function listVentureCoachingFollowUpDates(venture_id) {
  return db.execute({
    sql: `SELECT vcs.id, CONCAT('Follow-up: ', c.name) as title, vcs.follow_up_date as date, c.name as advisor_name FROM venture_coaching_sessions vcs LEFT JOIN contacts c ON vcs.advisor_contact_id = c.cid WHERE vcs.venture_id = ? AND vcs.follow_up_date IS NOT NULL ORDER BY vcs.follow_up_date`,
    args: [venture_id],
  });
}

