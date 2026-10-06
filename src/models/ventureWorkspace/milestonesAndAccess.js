import db from "@/lib/db";

// ── GET/POST/PATCH /api/ventures/[id]/milestones ─────────────────────────────

/** Internal ventures.id by VNT code — milestones GET resolver. */
export async function getVentureDbIdForMilestoneList(venture_id) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ?",
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

/** All milestones of a Venture db id, newest first. */
export async function listVentureMilestonesByDbId(ventureDbId) {
  return db.execute({ sql: "SELECT * FROM venture_milestones WHERE venture_id = ? ORDER BY created_at DESC", args: [ventureDbId] });
}

/** Whether a journey stage belongs to a Venture db id. */
export async function ventureJourneyStageExists(stageId, ventureDbId) {
  return db.execute({ sql: "SELECT 1 FROM venture_journey_stages WHERE id = ? AND venture_id = ?", args: [stageId, ventureDbId] });
}

/** Insert one milestone (id supplied by the caller). */
export async function insertVentureMilestone({
  id,
  ventureDbId,
  title,
  description,
  targetDate,
  status,
  createdBy,
  journeyStageId,
  objective,
  startDate,
  priority,
  ownerCid,
  ownerName,
  displayOrder,
}) {
  return db.execute({
    sql: `INSERT INTO venture_milestones (id, venture_id, title, description, target_date, status, progress, created_by, journey_stage_id, objective, start_date, priority, owner_cid, owner_name, display_order) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, ventureDbId, title, description, targetDate, status, createdBy, journeyStageId, objective, startDate, priority, ownerCid, ownerName, displayOrder],
  });
}

/** The BEFORE state of a milestone, for field-level history. */
export async function getVentureMilestoneBeforeUpdate(milestoneId, ventureDbId) {
  return db.execute({
    sql: `SELECT title, description, objective, status, progress, target_date, start_date,
                 priority, owner_cid, owner_name, journey_stage_id, display_order
            FROM venture_milestones WHERE id = ? AND venture_id = ?`,
    args: [milestoneId, ventureDbId],
  });
}

/** The Venture's db id + code by code-or-uuid id (milestone completion authority). */
export async function getVentureIdAndCode(id) {
  return db.execute({
    sql: "SELECT id, venture_id FROM ventures WHERE venture_id = ? OR id::text = ?",
    args: [id, id],
  });
}

/** Apply controller-built SET clauses to a milestone row. */
export async function updateVentureMilestoneFields(updates, args) {
  return db.execute({
    sql: `UPDATE venture_milestones SET ${updates.join(", ")} WHERE id = ? AND venture_id = ?`,
    args,
  });
}

/** The legacy-schema fallback: the same update without the updated_at clause. */
export async function updateVentureMilestoneValueFields(valueClauses, args) {
  return db.execute({
    sql: `UPDATE venture_milestones SET ${valueClauses.join(", ")} WHERE id = ? AND venture_id = ?`,
    args,
  });
}

/** A milestone's title + journey stage, by id. */
export async function getVentureMilestoneTitleAndStage(milestoneId) {
  return db.execute({
    sql: "SELECT title, journey_stage_id FROM venture_milestones WHERE id = ?",
    args: [milestoneId],
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

// ── GET /api/ventures/assigned ───────────────────────────────────────────────

/** A staff member's active Venture assignments, optionally filtered to one Venture. */
export async function listVenturesAssignedToStaff(staffCid, ventureFilter) {
  let sql = `
      SELECT a.id, a.responsibility_code, vr.name AS responsibility_name,
             a.scope_type, a.scope_ref_type, a.scope_ref_id, a.notes, a.created_at AS assigned_at,
             v.venture_id, v.company_name, v.name, v.status, v.business_stage, v.industry, v.country
      FROM venture_staff_assignments a
      JOIN ventures v ON v.venture_id = a.venture_id
      LEFT JOIN venture_responsibilities vr ON vr.code = a.responsibility_code
      WHERE a.staff_contact_id = ? AND a.status = 'active'
    `;
  const args = [staffCid];
  if (ventureFilter) {
    sql += " AND a.venture_id = ?";
    args.push(ventureFilter);
  }
  sql += " ORDER BY v.company_name NULLS LAST, v.name NULLS LAST, a.id DESC";

  return db.execute({ sql, args });
}

// ── GET /api/ventures/[id]/my-access ─────────────────────────────────────────

/** The canonical VNT code for a code-or-uuid id, or none. */
export async function getVentureCodeByIdOrCode(id) {
  return db.execute({
    sql: "SELECT venture_id FROM ventures WHERE venture_id = ? OR id::text = ? LIMIT 1",
    args: [id, id],
  });
}

/** A contact's active assignment rows for one Venture (my-access facts). */
export async function listActiveVentureAssignmentsForAccess(ventureCode, cid) {
  return db.execute({
    sql: `SELECT responsibility_code, scope_type, scope_ref_type, scope_ref_id
                FROM venture_staff_assignments
                WHERE venture_id = ? AND staff_contact_id = ? AND status = 'active'`,
    args: [ventureCode, cid],
  });
}

// ── GET /api/ventures/[id]/history ───────────────────────────────────────────

/** Whether a contact is an active member of a Venture (by code or either cid column). */
export async function isActiveVentureMember(ventureId, cid) {
  return db.execute({
    sql: "SELECT 1 FROM venture_members WHERE venture_id = ? AND (contact_id = ? OR user_cid = ?) AND removed_at IS NULL LIMIT 1",
    args: [ventureId, cid || "", cid || ""],
  });
}

// ── GET /api/ventures/[id]/venture-history ───────────────────────────────────

/** Internal ventures.id for a code-or-uuid id, or none. */
export async function getVentureDbIdByCodeOrId(id) {
  return db.execute({
    sql: "SELECT id FROM ventures WHERE venture_id = ? OR id::text = ?",
    args: [id, id],
  });
}

/** Venture history events for the given owner ids (code + internal id). */
export async function listVentureHistoryEvents(owners) {
  return db.execute({
    sql: `SELECT event_type, description, metadata, created_by, created_at
              FROM venture_history WHERE venture_id IN (${owners.map(() => "?").join(", ")})
              ORDER BY created_at ASC LIMIT 300`,
    args: owners,
  });
}

/** A Venture's readable internal notes (venture-history, staff only). */
export async function listVentureHistoryNotes(owners) {
  return db.execute({
    sql: `SELECT id, title, body, author_name, scope_ref_type, scope_ref_id, created_at
                  FROM venture_notes WHERE venture_id IN (${owners.map(() => "?").join(", ")}) AND is_archived = FALSE
                  ORDER BY created_at DESC LIMIT 50`,
    args: owners,
  });
}

/** A Venture's submission review decisions (venture-history). */
export async function listVentureHistoryReviewDecisions(owners) {
  return db.execute({
    sql: `SELECT s.version, s.status, s.review_decision, s.review_comment, s.reviewed_at,
                     s.submitted_by_name, s.reviewed_by, s.created_at,
                     t.title AS task_title
              FROM venture_task_submissions s
              JOIN venture_tasks t ON t.id = s.task_id
              WHERE t.venture_id IN (${owners.map(() => "?").join(", ")}) AND s.review_decision IS NOT NULL
              ORDER BY s.reviewed_at DESC NULLS LAST LIMIT 100`,
    args: owners,
  });
}

/** A Venture's session notes (venture-history, staff only). */
export async function listVentureHistorySessionNotes(owners) {
  return db.execute({
    sql: `SELECT sn.id, sn.note_type, sn.content, sn.author_name, sn.created_at,
                         s.title AS session_title, s.start_time, s.journey_stage_id, s.milestone_ref
                  FROM venture_session_notes sn
                  JOIN venture_sessions s ON s.id = sn.session_id
                  WHERE s.venture_id IN (${owners.map(() => "?").join(", ")})
                  ORDER BY sn.created_at DESC LIMIT 50`,
    args: owners,
  });
}

// ── POST /api/ventures/[id]/coach-invite ─────────────────────────────────────

/** Company/name of a Venture by code-or-uuid id (coach invite label). */
export async function getVentureNameByIdOrCode(id) {
  return db.execute({
    sql: "SELECT company_name, name FROM ventures WHERE venture_id = ? OR id::text = ?",
    args: [id, id],
  });
}

// ── GET/POST/PATCH /api/ventures/[id]/staff-assignments ──────────────────────

/** Existing Venture code check before assigning staff. */
export async function getVentureCodeForAssignment(ventureId) {
  return db.execute({
    sql: "SELECT venture_id FROM ventures WHERE venture_id = ?",
    args: [ventureId],
  });
}

/** Live contact check before assigning staff. */
export async function getLiveContactByCid(cid) {
  return db.execute({
    sql: "SELECT cid FROM contacts WHERE cid = ? AND deleted = 0",
    args: [cid],
  });
}

/** An existing active assignment of the same person / responsibility / scope. */
export async function findDuplicateVentureAssignment({
  ventureId,
  staffContactId,
  responsibilityCode,
  scopeType,
  scopeRefId,
}) {
  return db.execute({
    sql: `SELECT 1 FROM venture_staff_assignments
            WHERE venture_id = ? AND staff_contact_id = ? AND responsibility_code = ?
              AND scope_type = ? AND COALESCE(scope_ref_id,'') = COALESCE(?, '') AND status = 'active'`,
    args: [ventureId, staffContactId, responsibilityCode, scopeType, scopeRefId],
  });
}

/** Task totals (all + completed) for a venture, the completed statuses injected. */
export async function countVentureTasksWithCompletedStatuses(dbId, completedStatuses) {
  const completedSet = completedStatuses.map(() => "?").join(", ");
  return db.execute({
    sql: `SELECT COUNT(*) as total, SUM(CASE WHEN status IN (${completedSet}) THEN 1 ELSE 0 END) as done FROM venture_tasks WHERE venture_id = ?`,
    args: [...completedStatuses, dbId],
  });
}

// ── GET/POST/PATCH /api/ventures/[id]/members ────────────────────────────────

/** Existence check: a Venture by its VNT code. */
export async function getVentureByCode(ventureId) {
  return db.execute({ sql: "SELECT id FROM ventures WHERE venture_id = ?", args: [ventureId] });
}

/** A Venture's active roster with contact names/emails, grouped by type. */
export async function listVentureMembersWithContacts(ventureCode) {
  return db.execute({
    sql: `
        SELECT vm.*, c.name as contact_name, c.email as contact_email
        FROM venture_members vm
        LEFT JOIN contacts c ON vm.contact_id = c.cid
        WHERE vm.venture_id = ? AND vm.removed_at IS NULL
        ORDER BY vm.member_type, vm.joined_at DESC
      `,
    args: [ventureCode],
  });
}

/** Existing active roster row whose contact email matches (case-insensitive). */
export async function findVentureMemberByEmail(ventureCode, email) {
  return db.execute({
    sql: `SELECT 1 FROM venture_members vm
            JOIN contacts c ON c.cid = COALESCE(vm.contact_id, vm.user_cid)
            WHERE vm.venture_id = ? AND vm.removed_at IS NULL AND LOWER(c.email) = LOWER(?)
            LIMIT 1`,
    args: [ventureCode, email],
  });
}

/** A Venture's display name (company_name first, legacy name fallback). */
export async function getVentureDisplayNameByCode(ventureCode) {
  return db.execute({
    sql: "SELECT COALESCE(NULLIF(company_name, ''), name) AS venture_name FROM ventures WHERE venture_id = ? LIMIT 1",
    args: [ventureCode],
  });
}

/** One roster row (type, contact, role) of a Venture, by id. */
export async function getVentureMemberById(memberId, ventureId) {
  return db.execute({
    sql: "SELECT member_type, contact_id, role FROM venture_members WHERE id = ? AND venture_id = ?",
    args: [memberId, ventureId],
  });
}

/** The contact id behind one roster row, by id. */
export async function getVentureMemberContactId(memberId, ventureId) {
  return db.execute({
    sql: "SELECT contact_id FROM venture_members WHERE id = ? AND venture_id = ?",
    args: [memberId, ventureId],
  });
}

/** Soft-remove one roster row. */
export async function archiveVentureMember(memberId, ventureId) {
  return db.execute({
    sql: "UPDATE venture_members SET removed_at = NOW() WHERE id = ? AND venture_id = ?",
    args: [memberId, ventureId],
  });
}

/** Apply controller-built SET clauses to a roster row. */
export async function updateVentureMemberFields(updates, args) {
  return db.execute({
    sql: `UPDATE venture_members SET ${updates.join(", ")} WHERE id = ? AND venture_id = ?`,
    args,
  });
}

// ── POST /api/ventures/[id]/milestones/archive ───────────────────────────────

/** Milestones of a Venture (by code-or-uuid) among the given ids, with the Venture's db id. */
export async function listMilestonesForArchive(id, ids) {
  return db.execute({
    sql: `SELECT m.id, m.title, m.journey_stage_id, v.id AS venture_db_id FROM venture_milestones m
          JOIN ventures v ON (m.venture_id::text = v.id::text OR m.venture_id::text = v.venture_id)
          WHERE (v.venture_id = ? OR v.id::text = ?)
            AND m.id::text = ANY(?)`,
    args: [id, id, ids],
  });
}
