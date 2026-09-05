import db from "@/lib/db";

/**
 * Venture workspace model — data access for the venture workspace controllers
 * (`src/app/api/ventures/route.js` and the `[id]` routes for members, dashboard,
 * progress, tasks, blockers, standups, retros, calendar, milestones, followups
 * and action-plans).
 *
 * Each function wraps exactly one SQL statement. SQL is byte-identical to the
 * queries that used to live inline in the controllers, so behavior is unchanged.
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 *
 * Note: extraction is strictly 1:1 with the original inline call sites, so a
 * handful of lookups (e.g. the ventures.id-by-code resolvers) intentionally
 * repeat the same SQL across functions. Queries that also exist in
 * "@/lib/ventures" or "@/models/ventures" are kept here without cross-file
 * coupling.
 */

// ── GET/POST/PUT /api/ventures ───────────────────────────────────────────────

/** Ventures list with founder/member counts and optional directory filters. */
export async function listVenturesWithCounts({ effectiveContactId, status, search }) {
  let sql = `
      SELECT v.*,
        (SELECT COUNT(*) FROM venture_members vm WHERE vm.venture_id = v.venture_id AND vm.member_type = 'founder' AND vm.removed_at IS NULL) as founder_count,
        (SELECT COUNT(*) FROM venture_members vm WHERE vm.venture_id = v.venture_id AND vm.member_type != 'founder' AND vm.removed_at IS NULL) as member_count
      FROM ventures v WHERE 1=1
    `;
  const args = [];

  if (effectiveContactId) {
    sql += " AND v.venture_id IN (SELECT vm.venture_id FROM venture_members vm WHERE vm.user_cid = ? OR vm.contact_id = ?)";
    args.push(effectiveContactId, effectiveContactId);
  }

  if (status) {
    sql += " AND v.status = ?";
    args.push(status);
  }

  if (search) {
    sql += " AND (LOWER(v.name) LIKE ? OR LOWER(v.venture_id) LIKE ? OR LOWER(v.industry) LIKE ?)";
    const searchPattern = `%${search.toLowerCase()}%`;
    args.push(searchPattern, searchPattern, searchPattern);
  }

  sql += " ORDER BY v.created_at DESC";

  return db.execute({ sql, args });
}

/** Create a venture row — retired direct-create fallback (dead code in controller). */
export async function insertVenture(venture) {
  const {
    venture_id,
    name,
    description,
    industry,
    business_stage,
    website,
    mission,
    vision,
    sector,
    program_id,
    origin_team_id,
  } = venture;
  return db.execute({
    sql: `INSERT INTO ventures (venture_id, name, description, industry, business_stage, website, mission, vision, sector, program_id, origin_team_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW()) RETURNING id`,
    args: [venture_id, name, description || null, industry || null, business_stage || "idea", website || null, mission || null, vision || null, sector || null, program_id || null, origin_team_id || null],
  });
}

/** Add the venture creator as a founder member (ON CONFLICT DO NOTHING). */
export async function addCreatorAsVentureFounder({ venture_id, cid }) {
  return db.execute({
    sql: `INSERT INTO venture_members (venture_id, contact_id, user_cid, role) VALUES (?, ?, ?, 'founder') ON CONFLICT DO NOTHING`,
    args: [venture_id, cid, cid],
  });
}

/** contact_timeline 'venture_created' event (retired POST fallback path). */
export async function recordVentureCreatedTimeline({ contact_cid, name, industry, venture_id }) {
  return db.execute({
    sql: `INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, context_id, actor_id, metadata)
                VALUES (?, 'venture_created', ?, 'ventures', ?, ?, ?::jsonb)`,
    args: [contact_cid, `Founded "${name}"`, venture_id, contact_cid, JSON.stringify({ venture_name: name, industry })],
  });
}

/** contact_timeline 'venture_updated' event after a PUT update. */
export async function recordVentureUpdatedTimeline({ contact_cid, venture_id, updated_fields }) {
  return db.execute({
    sql: `INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, context_id, actor_id, metadata)
                  VALUES (?, 'venture_updated', ?, 'ventures', ?, ?, ?::jsonb)`,
    args: [contact_cid, `Updated venture ${venture_id}`, venture_id, contact_cid, JSON.stringify({ updated_fields })],
  });
}

// ── GET/POST/PATCH /api/ventures/[id]/members ────────────────────────────────

/** Internal ventures.id for a VNT code — members resolveDbId helper. */
export async function getVentureInternalIdByCode(venture_id) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ?",
    args: [venture_id],
  });
}

/** VNT code for an internal ventures.id — members resolveVentureCode helper. */
export async function getVentureCodeByInternalId(id) {
  return db.execute({
    sql: "SELECT venture_id FROM ventures WHERE id = ?",
    args: [id],
  });
}

/** Active founder count by VNT code — last-founder-removal guard. */
export async function countActiveFoundersByVentureCode(venture_id) {
  return db.execute({
    sql: "SELECT COUNT(*) as cnt FROM venture_members WHERE venture_id = ? AND member_type = 'founder' AND removed_at IS NULL",
    args: [venture_id],
  });
}

/** Membership row by VNT code + contact id — view-access check. */
export async function findActiveVentureMember(venture_id, contact_id) {
  return db.execute({
    sql: "SELECT id FROM venture_members WHERE venture_id = ? AND contact_id = ? AND removed_at IS NULL LIMIT 1",
    args: [venture_id, contact_id],
  });
}

/** Founder membership row by VNT code + contact id — mutation-access check. */
export async function findActiveVentureFounder(venture_id, contact_id) {
  return db.execute({
    sql: "SELECT id FROM venture_members WHERE venture_id = ? AND contact_id = ? AND member_type = 'founder' AND removed_at IS NULL LIMIT 1",
    args: [venture_id, contact_id],
  });
}

/** Internal ventures.id by VNT code — GET members roster lookup. */
export async function getVentureInternalIdByVentureCode(venture_id) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ?",
    args: [venture_id],
  });
}

/** Active roster with contact name/email (joins contacts). */
export async function listVentureMembersWithContactInfo(venture_id) {
  return db.execute({
    sql: `
        SELECT vm.*, c.name as contact_name, c.email as contact_email
        FROM venture_members vm
        LEFT JOIN contacts c ON vm.contact_id = c.cid
        WHERE vm.venture_id = ? AND vm.removed_at IS NULL
        ORDER BY vm.member_type, vm.joined_at DESC
      `,
    args: [venture_id],
  });
}

/** Contact existence check before adding a member by contact_id. */
export async function getContactByCid(cid) {
  return db.execute({
    sql: "SELECT cid FROM contacts WHERE cid = ?",
    args: [cid],
  });
}

/** Add a venture_members row (identity already resolved by the controller). */
export async function insertVentureMember({ venture_id, contact_id, member_type, role, permissions, invited_by }) {
  return db.execute({
    sql: `INSERT INTO venture_members (venture_id, contact_id, member_type, role, permissions, invited_by)
              VALUES (?, ?, ?, ?, ?, ?)`,
    args: [venture_id, contact_id, member_type, role || null, permissions || "edit", invited_by || null],
  });
}

/** Founder/role row for a member being removed (PATCH remove path). */
export async function getVentureMemberForMutation(member_id, venture_id) {
  return db.execute({
    sql: "SELECT member_type, contact_id, role FROM venture_members WHERE id = ? AND venture_id = ?",
    args: [member_id, venture_id],
  });
}

/** Soft-remove a member by setting removed_at. */
export async function removeVentureMember(member_id, venture_id) {
  return db.execute({
    sql: "UPDATE venture_members SET removed_at = NOW() WHERE id = ? AND venture_id = ?",
    args: [member_id, venture_id],
  });
}

/** contact_id of a member row (PATCH role/permissions update path). */
export async function getVentureMemberContactId(member_id, venture_id) {
  return db.execute({
    sql: "SELECT contact_id FROM venture_members WHERE id = ? AND venture_id = ?",
    args: [member_id, venture_id],
  });
}

/** Apply controller-built SET clauses to a venture_members row. */
export async function updateVentureMemberFields(updates, args) {
  return db.execute({
    sql: `UPDATE venture_members SET ${updates.join(", ")} WHERE id = ? AND venture_id = ?`,
    args,
  });
}

// ── GET /api/ventures/[id]/dashboard ─────────────────────────────────────────

/** Internal ventures.id by VNT code — dashboard resolve step (dbId). */
export async function getVentureDbIdByVentureCode(venture_id) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ?",
    args: [venture_id],
  });
}

/** Venture info card row (dashboard venture widget). */
export async function getVentureInfoForDashboard(venture_id) {
  return db.execute({
    sql: "SELECT company_name, venture_id, industry, business_stage, status, created_at, description, website, logo_url, registration_number FROM ventures WHERE venture_id = ?",
    args: [venture_id],
  });
}

/** Member contact/user ids for a venture (notification recipients). */
export async function listVentureMemberNotificationRecipients(venture_id) {
  return db.execute({
    sql: "SELECT contact_id, user_cid FROM venture_members WHERE venture_id = ? AND removed_at IS NULL",
    args: [venture_id],
  });
}

/** Recent bell notifications for the venture's member ids (+ 'sa'). */
export async function getRecentNotificationsForMembers(recipientIds) {
  let sql, args;
  if (recipientIds.length > 0) {
    sql = `SELECT id, title, message, type, is_read, created_at
                FROM v2_notifications
                WHERE recipient_id IN (${recipientIds.map(() => "?").join(", ")}) OR recipient_id = 'sa'
                ORDER BY created_at DESC LIMIT 10`;
    args = recipientIds;
  } else {
    sql = `SELECT id, title, message, type, is_read, created_at
                FROM v2_notifications
                WHERE recipient_id = 'sa'
                ORDER BY created_at DESC LIMIT 10`;
    args = [];
  }
  return db.execute({ sql, args });
}

/** Recent venture_activity_log rows for the dashboard widget. */
export async function listRecentVentureActivity(venture_id) {
  return db.execute({
    sql: `SELECT id, action, actor_name, details, created_at
                FROM venture_activity_log WHERE venture_id = ?
                ORDER BY created_at DESC LIMIT 10`,
    args: [venture_id],
  });
}

/** Recent non-deleted venture_documents (dashboard data room). */
export async function listRecentVentureDocuments(venture_id) {
  return db.execute({
    sql: "SELECT id, title, category, file_name, file_type, file_size, uploaded_by, created_at FROM venture_documents WHERE venture_id = ? AND is_deleted = false ORDER BY created_at DESC LIMIT 5",
    args: [venture_id],
  });
}

/** Recent venture_documents fallback query (no is_deleted filter). */
export async function listRecentVentureDocumentsUnfiltered(venture_id) {
  return db.execute({
    sql: "SELECT id, title, category, file_name, file_type, file_size, uploaded_by, created_at FROM venture_documents WHERE venture_id = ? ORDER BY created_at DESC LIMIT 5",
    args: [venture_id],
  });
}

/** Upcoming calendar_events for a venture (dashboard meetings widget). */
export async function listUpcomingVentureMeetings(venture_id) {
  return db.execute({
    sql: `SELECT id, title, description, event_date, event_time, status, type
                FROM calendar_events WHERE venture_id = ? AND event_date >= CURRENT_DATE
                ORDER BY event_date ASC LIMIT 5`,
    args: [venture_id],
  });
}

/** Latest venture KPI assignments joined to their definitions (by internal id). */
export async function getVentureKpiSummary(dbId) {
  return db.execute({
    sql: `SELECT d.name, d.unit, d.auto_calc_source, a.target_value, a.current_value, a.updated_at
                FROM venture_kpi_assignments a
                JOIN venture_kpi_definitions d ON d.id = a.kpi_definition_id
                WHERE a.venture_id::text = ?
                ORDER BY a.updated_at DESC LIMIT 5`,
    args: [dbId],
  });
}

/** Advisor count for a venture (internal id). */
export async function countVentureAdvisors(dbId) {
  return db.execute({
    sql: "SELECT COUNT(*) AS n FROM venture_advisors WHERE venture_id::text = ?",
    args: [dbId],
  });
}

/** Coaching session count for a venture (internal id). */
export async function countVentureCoachingSessions(dbId) {
  return db.execute({
    sql: "SELECT COUNT(*) AS n FROM venture_coaching_sessions WHERE venture_id::text = ?",
    args: [dbId],
  });
}

/** Active coach assignment count for a venture (internal id). */
export async function countActiveVentureCoachAssignments(dbId) {
  return db.execute({
    sql: "SELECT COUNT(*) AS n FROM venture_coach_assignments WHERE venture_id::text = ? AND status = 'active'",
    args: [dbId],
  });
}

// ── GET /api/ventures/[id]/progress ──────────────────────────────────────────

/** Internal ventures.id by VNT code — progress resolveVentureDbId helper. */
export async function getVentureDbIdForProgress(venture_id) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ?",
    args: [venture_id],
  });
}

/** Venture task total/done counts for the progress widget. */
export async function getVentureTaskCompletionCounts(dbId) {
  return db.execute({
    sql: "SELECT COUNT(*) as total, SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done FROM venture_tasks WHERE venture_id = ?",
    args: [dbId],
  });
}

/** Average milestone progress for a venture. */
export async function getAverageVentureMilestoneProgress(dbId) {
  return db.execute({
    sql: "SELECT AVG(progress) as avg_progress FROM venture_milestones WHERE venture_id = ?",
    args: [dbId],
  });
}

/** Standup count for a venture (progress widget). */
export async function countVentureStandupsByVentureId(dbId) {
  return db.execute({
    sql: "SELECT COUNT(*) as count FROM venture_standups WHERE venture_id = ?",
    args: [dbId],
  });
}

/** Retro count for a venture (progress widget). */
export async function countVentureRetrosByVentureId(dbId) {
  return db.execute({
    sql: "SELECT COUNT(*) as count FROM venture_retros WHERE venture_id = ?",
    args: [dbId],
  });
}

/** Profile-score fields of a venture by internal id. */
export async function getVentureProfileFields(dbId) {
  return db.execute({
    sql: "SELECT name, description, mission, vision, industry, sector, business_stage, website FROM ventures WHERE id = ?",
    args: [dbId],
  });
}

/** Active founder count by VNT code (progress founders %, arg is the VNT code). */
export async function countVentureFoundersByCode(venture_id) {
  return db.execute({
    sql: "SELECT COUNT(*) as count FROM venture_members WHERE venture_id = ? AND member_type = 'founder' AND removed_at IS NULL",
    args: [venture_id],
  });
}

/** Non-deleted document count for a venture (progress widget). */
export async function countVentureDocumentsByVentureId(dbId) {
  return db.execute({
    sql: "SELECT COUNT(*) as count FROM venture_documents WHERE venture_id = ? AND is_deleted = false",
    args: [dbId],
  });
}

/** Business-model existence row for a venture (progress widget). */
export async function getFirstVentureBusinessModelId(dbId) {
  return db.execute({
    sql: "SELECT id FROM venture_business_models WHERE venture_id = ? LIMIT 1",
    args: [dbId],
  });
}

/** Customer interview count for a venture (progress widget). */
export async function countVentureCustomerInterviews(dbId) {
  return db.execute({
    sql: "SELECT COUNT(*) as count FROM venture_customer_interviews WHERE venture_id = ?",
    args: [dbId],
  });
}

/** Validation count for a venture (progress widget). */
export async function countVentureValidations(dbId) {
  return db.execute({
    sql: "SELECT COUNT(*) as count FROM venture_validations WHERE venture_id = ?",
    args: [dbId],
  });
}

/** PMF assessment count for a venture (progress widget). */
export async function countVenturePmfAssessments(dbId) {
  return db.execute({
    sql: "SELECT COUNT(*) as count FROM venture_pmf_assessments WHERE venture_id = ?",
    args: [dbId],
  });
}

// ── GET/POST/PATCH/DELETE /api/ventures/[id]/tasks ───────────────────────────

/** Internal ventures.id by VNT code — tasks resolveVentureDbId helper. */
export async function getVentureDbIdForTasks(venture_id) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ?",
    args: [venture_id],
  });
}

/** Insert a venture task review (staff accept/reject/revision). */
export async function insertVentureTaskReview({ task_id, reviewer_cid, reviewer_name, decision, comments }) {
  return db.execute({
    sql: `INSERT INTO venture_task_reviews (task_id, reviewer_cid, reviewer_name, decision, comments, created_at)
            VALUES (?, ?, ?, ?, ?, NOW())`,
    args: [parseInt(task_id), reviewer_cid || null, reviewer_name || null, decision, comments || null],
  });
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

// ── GET/POST/PATCH /api/ventures/[id]/milestones ─────────────────────────────

/** Internal ventures.id by VNT code — milestones GET resolver. */
export async function getVentureDbIdForMilestoneList(venture_id) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ?",
    args: [venture_id],
  });
}

/** All venture milestones, newest first. */
export async function listVentureMilestones(venture_id) {
  return db.execute({
    sql: "SELECT * FROM venture_milestones WHERE venture_id = ? ORDER BY created_at DESC",
    args: [venture_id],
  });
}

/** Internal ventures.id by VNT code — milestones POST resolver. */
export async function getVentureDbIdForMilestoneCreate(venture_id) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ?",
    args: [venture_id],
  });
}

/** Insert a venture milestone (defaults: not_started / progress 0). */
export async function insertVentureMilestone({ id, venture_id, title, description, target_date, created_by }) {
  return db.execute({
    sql: `INSERT INTO venture_milestones (id, venture_id, title, description, target_date, status, progress, created_by) VALUES (?, ?, ?, ?, ?, 'not_started', 0, ?)`,
    args: [id, venture_id, title, description || null, target_date || null, created_by || null],
  });
}

/** Apply controller-built SET clauses to a venture milestone row. */
export async function updateVentureMilestoneFields(updates, args) {
  return db.execute({
    sql: `UPDATE venture_milestones SET ${updates.join(", ")} WHERE id = ?`,
    args,
  });
}

// ── GET /api/ventures/[id]/followups ─────────────────────────────────────────

/** Internal ventures.id by VNT code — followups GET resolver. */
export async function getVentureDbIdForFollowups(venture_id) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ?",
    args: [venture_id],
  });
}

/** Follow-ups for a venture (v2_followups via its venture_id column). */
export async function listVentureFollowups(venture_id) {
  return db.execute({
    sql: "SELECT * FROM v2_followups WHERE venture_id = ? ORDER BY created_at DESC",
    args: [venture_id],
  });
}

// ── GET/POST/PATCH /api/ventures/[id]/action-plans ───────────────────────────

/** Internal ventures.id by VNT code — action-plans resolveVentureDbId helper. */
export async function getVentureDbIdForActionPlans(venture_id) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ?",
    args: [venture_id],
  });
}

/** Venture action plans with owner names, optionally scoped to a milestone. */
export async function listVentureActionPlans(venture_id, milestone_id) {
  let sql, args;
  if (milestone_id) {
    sql = `SELECT ap.*, c.name as owner_name FROM venture_action_plans ap LEFT JOIN contacts c ON ap.owner_contact_id = c.cid WHERE ap.venture_id = ? AND ap.milestone_id = ? ORDER BY ap.created_at DESC`;
    args = [venture_id, milestone_id];
  } else {
    sql = `SELECT ap.*, c.name as owner_name FROM venture_action_plans ap LEFT JOIN contacts c ON ap.owner_contact_id = c.cid WHERE ap.venture_id = ? ORDER BY ap.created_at DESC`;
    args = [venture_id];
  }
  return db.execute({ sql, args });
}

/** Insert a venture action plan (priority defaults to 'medium'). */
export async function insertVentureActionPlan({ venture_id, milestone_id, title, priority, deadline, owner_contact_id, created_by }) {
  return db.execute({
    sql: `INSERT INTO venture_action_plans (venture_id, milestone_id, title, priority, deadline, owner_contact_id, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [venture_id, milestone_id || null, title, priority || "medium", deadline || null, owner_contact_id || null, created_by],
  });
}

/** Apply controller-built SET clauses to a venture action plan row. */
export async function updateVentureActionPlanFields(updates, args) {
  return db.execute({
    sql: `UPDATE venture_action_plans SET ${updates.join(", ")} WHERE id = ? AND venture_id = ?`,
    args,
  });
}
