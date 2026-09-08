import db from "@/lib/db";

/**
 * Facilitation model — data access for the facilitation & evaluation controllers.
 *
 * Each function wraps exactly one SQL statement. SQL is byte-identical to the
 * queries that used to live inline in the controllers, so behavior is unchanged.
 *
 * Route → function map:
 *   src/app/api/facilitators/invite-bulk/route.js → findContactByEmailForInvite,
 *       isAlreadyFacilitatorInProgram, findParticipantConflictForFacilitatorInvite,
 *       getProgramForFacilitatorInvite, createFacilitatorContact,
 *       upsertFacilitatorProgramStaff, fillContactProgramLink,
 *       addFacilitatorContactRole, invalidatePasswordSetupTokens,
 *       createFacilitatorInviteToken, addFacilitatorAssignedTimelineEvent,
 *       addFacilitatorInvitedTimelineEvent
 *   src/app/api/facilitator-reviews/route.js → listFacilitatorReviews,
 *       ensureFacilitatorReviewColumn, findChangesRequestedReview,
 *       resetReviewForResubmission, createFacilitatorReview,
 *       getReviewProgramId, getProgramAssignedPmId, decideFacilitatorReview
 *   src/app/api/evaluation/route.js → getProgramEvaluationConfig,
 *       getSubmissionEvaluation, getProgramEvaluationConfigForValidation,
 *       updateSubmissionEvaluation, updateProgramGradingMode,
 *       updateProgramEvaluationConfig
 *   src/app/api/attendance/route.js → createAttendanceTable,
 *       addAttendanceProgramIdColumn, addAttendanceDateColumn,
 *       addAttendanceUpdatedAtColumn, dedupeLegacyAttendanceRows,
 *       createAttendanceUniqueIndex, getContactsInTeams,
 *       deleteAttendanceMark, insertAttendanceMark, getAttendanceSummary,
 *       listAttendance
 *   src/app/api/feedback/route.js → createFeedback, listFeedback
 *   src/app/api/deliverables/route.js → createDeliverable, listDeliverables
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 */

// ─────────────────────────────────────────────────────────────────────────────
// facilitators/invite-bulk
// ─────────────────────────────────────────────────────────────────────────────

/** Contact row (cid/name/password) for an invite email — detects existing contacts + activation state. */
export async function findContactByEmailForInvite(email) {
  return db.execute({
    sql: "SELECT cid, name, password FROM contacts WHERE email = ? AND deleted = 0 AND deleted_at IS NULL LIMIT 1",
    args: [email],
  });
}

/** Existence probe: is the contact already a facilitator of this program? */
export async function isAlreadyFacilitatorInProgram(programId, contactCid) {
  return db.execute({
    sql: "SELECT 1 FROM v2_program_staff WHERE program_id::text = ? AND staff_id::text = ? AND role = 'facilitator' LIMIT 1",
    args: [String(programId), String(contactCid)],
  });
}

/** Existence probe: is the contact/email already a participant of this program? */
export async function findParticipantConflictForFacilitatorInvite(contactCid, programId, email) {
  return db.execute({
    sql: `SELECT 1 FROM participant_programs WHERE participant_id::text = ? AND program_id::text = ?
          UNION
          SELECT 1 FROM v2_participants WHERE program_id::text = ? AND (email = ? OR user_id = ?)
          LIMIT 1`,
    args: [String(contactCid), String(programId), String(programId), email, String(contactCid)],
  });
}

/** Program name + facilitator default permissions for the invite flow. */
export async function getProgramForFacilitatorInvite(programId) {
  return db.execute({
    sql: "SELECT name, facilitator_default_permissions FROM v2_programs WHERE id::text = ?",
    args: [programId],
  });
}

/** Create the pending facilitator contact row. */
export async function createFacilitatorContact(contactCid, email) {
  return db.execute({
    sql: "INSERT INTO contacts (cid, name, email, role, status) VALUES (?, ?, ?, 'facilitator', 'pending')",
    args: [contactCid, "", email],
  });
}

/** Upsert the facilitator relationship on v2_program_staff with the program's default permissions. */
export async function upsertFacilitatorProgramStaff(programId, contactCid, defaultPerms) {
  return db.execute({
    sql: `INSERT INTO v2_program_staff (program_id, staff_id, role, permissions)
              VALUES (?, ?, 'facilitator', ?::jsonb)
              ON CONFLICT (program_id, staff_id)
              DO UPDATE SET role = EXCLUDED.role, permissions = EXCLUDED.permissions, updated_at = NOW()`,
    args: [programId, contactCid, JSON.stringify(defaultPerms)],
  });
}

/** Fill-only link of a contact to the program (skips contacts already linked elsewhere). */
export async function fillContactProgramLink(programId, contactCid) {
  return db.execute({
    sql: "UPDATE contacts SET program_id = ? WHERE cid = ? AND (program_id IS NULL OR TRIM(program_id) = '')",
    args: [programId, contactCid],
  });
}

/** Contextual facilitator role on contact_roles (insert only if no current one exists). */
export async function addFacilitatorContactRole(contactCid, programId, defaultPerms, assignedBy) {
  return db.execute({
    sql: `INSERT INTO contact_roles
                  (contact_cid, role, context_type, context_id, is_current, title, scope, status, capability_overrides, assigned_by)
                SELECT ?, 'facilitator', 'program', ?, true, 'facilitator', '{"type":"program"}'::jsonb, 'active', ?::jsonb, ?
                WHERE NOT EXISTS (
                  SELECT 1 FROM contact_roles cr
                  WHERE cr.contact_cid = ?
                    AND cr.role = 'facilitator'
                    AND cr.context_type = 'program'
                    AND cr.context_id = ?
                    AND cr.is_current = true
                )`,
    args: [contactCid, programId, JSON.stringify(defaultPerms), assignedBy, contactCid, programId],
  });
}

/** Expire any outstanding password-setup tokens for the contact before issuing a new one. */
export async function invalidatePasswordSetupTokens(contactCid) {
  return db.execute({
    sql: "UPDATE password_setup_tokens SET used = 1 WHERE contact_cid = ?",
    args: [contactCid],
  });
}

/** Issue a staff-invite password-setup token (48h expiry). */
export async function createFacilitatorInviteToken(token, tokenHash, contactCid) {
  return db.execute({
    sql: "INSERT INTO password_setup_tokens (token, token_hash, contact_cid, expires_at, token_type) VALUES (?, ?, ?, NOW() + INTERVAL '48 hours', 'staff_invite')",
    args: [token, tokenHash, contactCid],
  });
}

/** CRM history entry recording the facilitator assignment. */
export async function addFacilitatorAssignedTimelineEvent(contactCid, programName, programId, actorId) {
  return db.execute({
    sql: `INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, context_id, actor_id, metadata)
                VALUES (?, 'facilitator_assigned', ?, 'programs', ?, ?, '{}'::jsonb)`,
    args: [contactCid, `Assigned as facilitator to ${programName}`, programId, actorId],
  });
}

/** CRM history entry recording the invitation email. */
export async function addFacilitatorInvitedTimelineEvent(contactCid, programName, programId, actorId) {
  return db.execute({
    sql: `INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, context_id, actor_id, metadata)
                VALUES (?, 'invitation_sent', ?, 'programs', ?, ?, '{}'::jsonb)`,
    args: [contactCid, `Invited to facilitate ${programName}`, programId, actorId],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// facilitator-reviews
// ─────────────────────────────────────────────────────────────────────────────

/** Review rows filtered by program/facilitator/week, newest first; optionally restricted to one facilitator's own reviews. */
export async function listFacilitatorReviews(filters) {
  const { programId, facilitatorId, weekNumber, onlyOwn, ownCid } = filters;
  let sql = "SELECT * FROM program_facilitator_reviews WHERE 1=1";
  const args = [];

  if (programId) {
    sql += " AND CAST(program_id AS TEXT) = ?";
    args.push(String(programId));
  }
  if (facilitatorId) {
    sql += " AND facilitator_id = ?";
    args.push(facilitatorId);
  }
  if (weekNumber) {
    sql += " AND week_number = ?";
    args.push(parseInt(weekNumber));
  }

  // Non-management roles may only read their own reviews
  if (onlyOwn) {
    sql += " AND facilitator_id = ?";
    args.push(ownCid);
  }

  sql += " ORDER BY created_at DESC";
  return db.execute({ sql, args });
}

/** Idempotent add of one structured-review column (the route loops it over the column list). */
export async function ensureFacilitatorReviewColumn(col) {
  return db.execute(
    `ALTER TABLE program_facilitator_reviews ADD COLUMN IF NOT EXISTS ${col}`,
  );
}

/** Most recent review for a program/week still awaiting PM changes (respond-to-changes path). */
export async function findChangesRequestedReview(programId, facilitatorCid, weekNumber) {
  return db.execute({
    sql: `SELECT id FROM program_facilitator_reviews
              WHERE CAST(program_id AS TEXT) = ?
                AND facilitator_id = ?
                AND week_number = ?
                AND pm_decision = 'changes_requested'
              ORDER BY created_at DESC LIMIT 1`,
    args: [String(programId), facilitatorCid, weekNumber],
  });
}

/** Reset an existing review's fields for resubmission (clears the PM decision). */
export async function resetReviewForResubmission(reviewId, values) {
  return db.execute({
    sql: `UPDATE program_facilitator_reviews SET
                  participant_progress = ?, attendance_concerns = ?, assignment_performance = ?,
                  challenges = ?, participants_needing_intervention = ?, completed_work = ?,
                  needs_attention = ?, recommendations = ?,
                  overall_rating = ?, went_well = ?, struggles = ?, engagement = ?,
                  needs_attention_type = ?, needs_attention_note = ?, focus_next_week = ?,
                  additional_notes = ?, status = 'submitted',
                  pm_decision = NULL, pm_decision_note = NULL, pm_decision_by = NULL, pm_decision_at = NULL,
                  updated_at = NOW()
                WHERE id = ?`,
    args: [...values, reviewId],
  });
}

/** Create a facilitator review row, returning its id. */
export async function createFacilitatorReview(review) {
  return db.execute({
    sql: `INSERT INTO program_facilitator_reviews (
        program_id, facilitator_id, facilitator_name, week_number,
        participant_progress, attendance_concerns, assignment_performance,
        challenges, participants_needing_intervention, completed_work,
        needs_attention, recommendations,
        overall_rating, went_well, struggles, engagement,
        needs_attention_type, needs_attention_note, focus_next_week,
        additional_notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted') RETURNING id`,
    args: [
      review.program_id,
      review.facilitatorCid,
      review.facilitatorName,
      review.weekNumber,
      ...review.values,
    ],
  });
}

/** Review row's program id (used to gate PM decisions on program ownership). */
export async function getReviewProgramId(id) {
  return db.execute({
    sql: "SELECT program_id FROM program_facilitator_reviews WHERE id = ?",
    args: [id],
  });
}

/** Program row's assigned_pm_id (ownership check before a PM decision). */
export async function getProgramAssignedPmId(progId) {
  return db.execute({
    sql: "SELECT assigned_pm_id FROM v2_programs WHERE id = ?",
    args: [progId],
  });
}

/** Record a PM decision/action on a review row. */
export async function decideFacilitatorReview(review) {
  return db.execute({
    sql: `UPDATE program_facilitator_reviews SET
              pm_decision = ?,
              pm_decision_note = ?,
              pm_decision_by = ?,
              pm_decision_at = NOW(),
              status = 'decided',
              updated_at = NOW()
            WHERE id = ?`,
    args: [
      review.pm_decision || null,
      review.pm_decision_note || null,
      review.decidedBy || null,
      review.id,
    ],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// evaluation
// ─────────────────────────────────────────────────────────────────────────────

/** Program grading_mode + evaluation_config (GET: serve the evaluation config). */
export async function getProgramEvaluationConfig(programId) {
  return db.execute({
    sql: "SELECT grading_mode, evaluation_config FROM v2_programs WHERE id = ?",
    args: [programId],
  });
}

/** Evaluation rows for one submission, joined with its deliverable title. */
export async function getSubmissionEvaluation(submissionId) {
  return db.execute({
    sql: "SELECT s.evaluation_score, s.evaluation_data, d.title as deliverable_title FROM v2_submissions s LEFT JOIN v2_deliverables d ON s.deliverable_id = d.id WHERE s.id = ?",
    args: [submissionId],
  });
}

/** Program grading_mode + evaluation_config (PUT: fetch grading mode for score validation). */
export async function getProgramEvaluationConfigForValidation(programId) {
  return db.execute({
    sql: "SELECT grading_mode, evaluation_config FROM v2_programs WHERE id = ?",
    args: [programId],
  });
}

/** Attach an evaluation score/data to a submission. */
export async function updateSubmissionEvaluation(evaluation) {
  return db.execute({
    sql: `UPDATE v2_submissions SET
              evaluation_score = ?,
              evaluation_data = ?::jsonb,
              updated_at = NOW()
            WHERE id = ?`,
    args: [
      evaluation.score !== undefined ? evaluation.score : null,
      evaluation.evaluation_data ? JSON.stringify(evaluation.evaluation_data) : "{}",
      evaluation.submission_id,
    ],
  });
}

/** Configure the program's grading mode. */
export async function updateProgramGradingMode(programId, gradingMode) {
  return db.execute({
    sql: "UPDATE v2_programs SET grading_mode = ?, updated_at = NOW() WHERE id = ?",
    args: [gradingMode, programId],
  });
}

/** Configure the program's evaluation_config JSON. */
export async function updateProgramEvaluationConfig(programId, evaluationConfig) {
  return db.execute({
    sql: "UPDATE v2_programs SET evaluation_config = ?::jsonb, updated_at = NOW() WHERE id = ?",
    args: [JSON.stringify(evaluationConfig), programId],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// attendance
// ─────────────────────────────────────────────────────────────────────────────

/** Idempotent creation of the v2_attendance table. */
export async function createAttendanceTable() {
  return db.execute({
    sql: `CREATE TABLE IF NOT EXISTS v2_attendance (
          id SERIAL PRIMARY KEY,
          session_id TEXT NOT NULL,
          participant_id TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'neutral',
          created_at TIMESTAMPTZ DEFAULT NOW()
        )`,
    args: [],
  });
}

/** Idempotent add of the program_id column on v2_attendance. */
export async function addAttendanceProgramIdColumn() {
  return db.execute({ sql: "ALTER TABLE v2_attendance ADD COLUMN IF NOT EXISTS program_id TEXT", args: [] });
}

/** Idempotent add of the date column on v2_attendance. */
export async function addAttendanceDateColumn() {
  return db.execute({ sql: "ALTER TABLE v2_attendance ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE", args: [] });
}

/** Idempotent add of the updated_at column on v2_attendance. */
export async function addAttendanceUpdatedAtColumn() {
  return db.execute({ sql: "ALTER TABLE v2_attendance ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()", args: [] });
}

/** Remove legacy duplicate attendance marks (same session+date+participant), keeping the newest. */
export async function dedupeLegacyAttendanceRows() {
  return db.execute({
    sql: `DELETE FROM v2_attendance a USING v2_attendance b
              WHERE a.session_id = b.session_id AND a.date = b.date AND a.participant_id = b.participant_id
                AND a.updated_at < b.updated_at`,
    args: [],
  });
}

/** Uniqueness index enforcing one attendance mark per participant per session per day. */
export async function createAttendanceUniqueIndex() {
  return db.execute({
    sql: "CREATE UNIQUE INDEX IF NOT EXISTS uq_v2_attendance_session_date_participant ON v2_attendance (session_id, date, participant_id)",
    args: [],
  });
}

/** Contacts belonging to any of the given team ids (facilitator team scope). */
export async function getContactsInTeams(teamIds) {
  return db.execute({
    sql: "SELECT cid FROM contacts WHERE v2_team_id IN (" + teamIds.map(() => "?").join(",") + ")",
    args: teamIds,
  });
}

/** Delete a participant's attendance mark for a session/date (explicit clear + upsert path). */
export async function deleteAttendanceMark(sessionId, date, participantId) {
  return db.execute({
    sql: "DELETE FROM v2_attendance WHERE session_id = ? AND date = ? AND participant_id = ?",
    args: [sessionId, date, participantId],
  });
}

/** Insert one attendance mark. */
export async function insertAttendanceMark(attendance) {
  return db.execute({
    sql: "INSERT INTO v2_attendance (session_id, program_id, participant_id, status, date) VALUES (?, ?, ?, ?, ?)",
    args: [
      attendance.session_id,
      attendance.program_id || null,
      attendance.participant_id,
      attendance.status,
      attendance.date,
    ],
  });
}

/** Per-participant attendance rates for a program (optionally scoped to a facilitator's teams). */
export async function getAttendanceSummary(programId, facGroupFilter, facGroupArgs) {
  return db.execute({
    sql: `
          SELECT
            a.participant_id,
            c.name as participant_name,
            COUNT(*) as total_sessions,
            SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
            SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
            SUM(CASE WHEN a.status = 'excused' THEN 1 ELSE 0 END) as excused_count,
            SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late_count,
            ROUND(
              (SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END)::decimal / 
              NULLIF((SELECT COUNT(DISTINCT date) FROM v2_attendance WHERE program_id = a.program_id), 0)) * 100
            , 1) as attendance_rate
          FROM v2_attendance a
          LEFT JOIN contacts c ON a.participant_id::text = c.cid
          WHERE a.program_id = ? AND ${facGroupFilter ? facGroupFilter : "1=1"}
          GROUP BY a.participant_id, c.name, a.program_id
          ORDER BY attendance_rate DESC
        `,
    args: [programId, ...facGroupArgs],
  });
}

/** Attendance rows with participant name, filtered and ordered for the listing view. */
export async function listAttendance(filters) {
  const { sessionId, dateStr, programId, participantId, facGroupFilter, facGroupArgs } = filters;
  let sql = "SELECT a.*, c.name as participant_name FROM v2_attendance a LEFT JOIN contacts c ON a.participant_id::text = c.cid WHERE 1=1";
  const args = [];

  if (sessionId) {
    sql += " AND a.session_id = ?";
    args.push(sessionId);
  }
  if (dateStr) {
    sql += " AND a.date = ?";
    args.push(dateStr);
  }
  if (programId) {
    sql += " AND a.program_id = ?";
    args.push(programId);
  }
  if (participantId) {
    sql += " AND a.participant_id = ?";
    args.push(participantId);
  }
  if (facGroupFilter) {
    sql += " AND " + facGroupFilter;
    args.push(...facGroupArgs);
  }
  sql += " ORDER BY date DESC, created_at DESC";

  return db.execute({ sql, args });
}

// ─────────────────────────────────────────────────────────────────────────────
// feedback
// ─────────────────────────────────────────────────────────────────────────────

/** Create a feedback row, returning its id. */
export async function createFeedback(feedback) {
  return db.execute({
    sql: `INSERT INTO v2_feedback (program_id, participant_id, week_number, learnings, accomplishments, suggestions)
           VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
    args: [
      feedback.program_id,
      feedback.participant_id,
      feedback.week_number,
      feedback.learnings || null,
      feedback.accomplishments || null,
      feedback.suggestions || null,
    ],
  });
}

/** Feedback rows joined with participant name, newest first (optionally by program). */
export async function listFeedback(programId) {
  let sql = `SELECT f.*, c.name as participant_name
       FROM v2_feedback f
       LEFT JOIN contacts c ON f.participant_id = c.cid
       WHERE 1=1`;
  let args = [];
  if (programId) {
    sql += " AND f.program_id = ?";
    args.push(programId);
  }
  sql += " ORDER BY f.created_at DESC";

  return db.execute({ sql, args });
}

// ─────────────────────────────────────────────────────────────────────────────
// deliverables
// ─────────────────────────────────────────────────────────────────────────────

/** Create a deliverable row, returning its id. */
export async function createDeliverable(deliverable) {
  return db.execute({
    sql: `INSERT INTO v2_deliverables (program_id, title, description, week_number)
                 VALUES (?, ?, ?, ?) RETURNING id`,
    args: [
      deliverable.program_id,
      deliverable.title,
      deliverable.description || null,
      deliverable.week_number || 1,
    ],
  });
}

/** Deliverable rows ordered by week (optionally for one program). */
export async function listDeliverables(programId) {
  let sql = "SELECT * FROM v2_deliverables";
  let args = [];
  if (programId) {
    sql += " WHERE program_id = ?";
    args.push(programId);
  }
  sql += " ORDER BY week_number ASC";

  return db.execute({ sql, args });
}
