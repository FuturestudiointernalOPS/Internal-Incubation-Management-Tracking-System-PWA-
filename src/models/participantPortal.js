import db from "@/lib/db";

/**
 * Participant portal model — data access for the participant-facing
 * controllers under `src/app/api/participant/` and
 * `src/app/api/participant-programs/`:
 *
 *   src/app/api/participant/progress/route.js          (12 queries)
 *   src/app/api/participant/home/route.js              (10 queries)
 *   src/app/api/participant/assignments/route.js       (10 queries)
 *   src/app/api/participant/rituals/standup/route.js   ( 2 queries)
 *   src/app/api/participant/rituals/retro/route.js     ( 2 queries)
 *   src/app/api/participant/rituals/reflect/route.js   ( 2 queries)
 *   src/app/api/participant/rituals/checkin/route.js   ( 2 queries)
 *   src/app/api/participant/timeline/route.js          ( 1 query)
 *   src/app/api/participant/certificates/route.js      ( 1 query)
 *   src/app/api/participant-programs/route.js          (10 queries)
 *   src/app/api/participant-programs/bulk/route.js     ( 5 queries)
 *
 * Each function wraps exactly one SQL statement extracted 1:1 from the
 * controller that used to call it (SQL byte-identical, args order/count
 * identical), so behavior is unchanged. Queries that look duplicated across
 * routes are still extracted one function per occurrence, per the MVC
 * refactor extraction rules.
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 */

// ── GET /api/participant/progress ────────────────────────────────────────────

/** Contact row (cid, name, email, program_id, group_name) for a participant. */
export async function getProgressContactByCid(cid) {
  return db.execute({
    sql: "SELECT cid, name, email, program_id, group_name FROM contacts WHERE cid = ?",
    args: [cid],
  });
}

/** Full program row matched by text-cast id. */
export async function getProgressProgramById(programId) {
  return db.execute({
    sql: "SELECT * FROM v2_programs WHERE id::text = ?",
    args: [programId],
  });
}

/** Sessions of a program ordered by week number. */
export async function getProgressSessionsByProgramId(programId) {
  return db.execute({
    sql: "SELECT * FROM v2_sessions WHERE program_id::text = ? ORDER BY week_number ASC",
    args: [programId],
  });
}

/** Document requirements (deliverables) of a program, oldest first. */
export async function getProgressDeliverablesByProgramId(programId) {
  return db.execute({
    sql: "SELECT * FROM v2_document_requirements WHERE program_id::text = ? ORDER BY created_at ASC",
    args: [programId],
  });
}

/** A participant's submissions in one program, newest first. */
export async function getProgressSubmissionsByProgram(participantId, programId) {
  return db.execute({
    sql: "SELECT * FROM v2_submissions WHERE participant_id::text = ? AND program_id::text = ? ORDER BY created_at DESC",
    args: [participantId, programId],
  });
}

/** Attendance rows for a participant in one program. */
export async function getProgressAttendanceByProgram(programId, participantId) {
  return db.execute({
    sql: "SELECT a.* FROM v2_attendance a WHERE a.program_id::text = ? AND a.participant_id::text = ?",
    args: [programId, participantId],
  });
}

/** KPIs of a program. */
export async function getProgressKpisByProgramId(programId) {
  return db.execute({
    sql: "SELECT * FROM v2_kpis WHERE program_id::text = ?",
    args: [programId],
  });
}

/** Standups submitted by a user, newest first. */
export async function getProgressStandupsByUser(userId) {
  return db.execute({
    sql: "SELECT * FROM v2_standups WHERE user_id = ? ORDER BY created_at DESC",
    args: [userId],
  });
}

/** Checkins of a participant in one program, newest first. */
export async function getProgressCheckinsByParticipantProgram(participantId, programId) {
  return db.execute({
    sql: "SELECT * FROM v2_checkins WHERE participant_id = ? AND program_id = ? ORDER BY created_at DESC",
    args: [participantId, programId],
  });
}

/** Retros submitted by a user, newest first. */
export async function getProgressRetrosByUser(userId) {
  return db.execute({
    sql: "SELECT * FROM v2_retros WHERE user_id = ? ORDER BY created_at DESC",
    args: [userId],
  });
}

/** Reflections submitted by a user, newest first. */
export async function getProgressReflectionsByUser(userId) {
  return db.execute({
    sql: "SELECT * FROM v2_reflections WHERE user_id = ? ORDER BY created_at DESC",
    args: [userId],
  });
}

/** Total attendance rows for a program (used to detect attendance tracking). */
export async function countProgressAttendanceByProgramId(programId) {
  return db.execute({
    sql: "SELECT COUNT(*) AS total FROM v2_attendance WHERE program_id::text = ?",
    args: [programId],
  });
}

// ── GET /api/participant/home ────────────────────────────────────────────────

/** Contact row (incl. program_name/role) for a participant. */
export async function getHomeContactByCid(cid) {
  return db.execute({
    sql: "SELECT cid, name, email, group_name, program_id, program_name, role FROM contacts WHERE cid = ?",
    args: [cid],
  });
}

/** Full program row matched by text-cast id. */
export async function getHomeProgramById(programId) {
  return db.execute({
    sql: "SELECT * FROM v2_programs WHERE id::text = ?",
    args: [programId],
  });
}

/** Sessions of a program ordered by week number then start time. */
export async function getHomeSessionsByProgramId(programId) {
  return db.execute({
    sql: "SELECT * FROM v2_sessions WHERE program_id::text = ? ORDER BY week_number ASC, start_at ASC",
    args: [programId],
  });
}

/** Document requirements (deliverables) of a program, oldest first. */
export async function getHomeDeliverablesByProgramId(programId) {
  return db.execute({
    sql: "SELECT * FROM v2_document_requirements WHERE program_id::text = ? ORDER BY created_at ASC",
    args: [programId],
  });
}

/** A participant's submissions in one program. */
export async function getHomeSubmissionsByParticipantProgram(participantId, programId) {
  return db.execute({
    sql: "SELECT * FROM v2_submissions WHERE participant_id::text = ? AND program_id::text = ?",
    args: [participantId, programId],
  });
}

/** Attendance of a participant joined to the sessions of one program. */
export async function getHomeAttendanceByProgram(participantId, programId) {
  return db.execute({
    sql: "SELECT a.* FROM v2_attendance a JOIN v2_sessions s ON a.session_id::text = s.id::text WHERE a.participant_id::text = ? AND s.program_id::text = ?",
    args: [participantId, programId],
  });
}

/** KPIs of a program. */
export async function getHomeKpisByProgramId(programId) {
  return db.execute({
    sql: "SELECT * FROM v2_kpis WHERE program_id::text = ?",
    args: [programId],
  });
}

/** Total attendance rows for a program (used to detect attendance tracking). */
export async function countHomeAttendanceByProgramId(programId) {
  return db.execute({
    sql: "SELECT COUNT(*) AS total FROM v2_attendance WHERE program_id::text = ?",
    args: [programId],
  });
}

/** Latest announcements addressed to a participant (by cid/email or 'all'). */
export async function getHomeNotifications(participantId, email) {
  return db.execute({
    sql: "SELECT * FROM v2_notifications WHERE recipient_id = ? OR recipient_id = 'all' OR recipient_id = ? ORDER BY created_at DESC LIMIT 10",
    args: [participantId, email],
  });
}

/** Upcoming v2_events across the given program ids. */
export async function getHomeEventsByProgramIds(programIdList) {
  const placeholders = programIdList.map(() => "?").join(",");
  return db.execute({
    sql: `SELECT * FROM v2_events WHERE program_id IN (${placeholders}) AND start_time IS NOT NULL ORDER BY start_time ASC`,
    args: programIdList,
  });
}

// ── GET/POST /api/participant/assignments ────────────────────────────────────

/** Ensure the participant+program submissions index exists. */
export async function ensureSubmissionParticipantProgramIndex() {
  return db.execute("CREATE INDEX IF NOT EXISTS idx_v2_submissions_participant_program ON v2_submissions(participant_id, program_id)");
}

/** Ensure the deliverable submissions index exists. */
export async function ensureSubmissionDeliverableIndex() {
  return db.execute("CREATE INDEX IF NOT EXISTS idx_v2_submissions_deliverable ON v2_submissions(deliverable_id)");
}

/** Contact row (incl. team ids) for a participant. */
export async function getAssignmentsContactByCid(cid) {
  return db.execute({
    sql: "SELECT cid, email, program_id, group_name, v2_team_id, team_id FROM contacts WHERE cid = ?",
    args: [cid],
  });
}

/** Program id + name. */
export async function getAssignmentsProgramById(programId) {
  return db.execute({
    sql: "SELECT id, name FROM v2_programs WHERE id = ?",
    args: [programId],
  });
}

/** Document requirements (deliverables) of a program, oldest first. */
export async function getAssignmentsDeliverablesByProgramId(programId) {
  return db.execute({
    sql: "SELECT * FROM v2_document_requirements WHERE program_id = ? ORDER BY created_at ASC",
    args: [programId],
  });
}

/** A participant's submissions in one program, newest first. */
export async function getAssignmentsSubmissionsByProgram(participantId, programId) {
  return db.execute({
    sql: "SELECT * FROM v2_submissions WHERE participant_id::text = ? AND program_id = ? ORDER BY created_at DESC",
    args: [participantId, programId],
  });
}

/** Existing submission of a participant for one deliverable (version history). */
export async function getExistingSubmission(participantId, deliverableId) {
  return db.execute({
    sql: "SELECT id, file_url, version FROM v2_submissions WHERE participant_id = ? AND deliverable_id = ?",
    args: [participantId, deliverableId],
  });
}

/** Archive the previous version of a submission before a new one is uploaded. */
export async function archiveSubmissionVersion(submissionId, participantId, deliverableId, fileUrl, version) {
  return db.execute({
    sql: "INSERT INTO v2_submission_versions (submission_id, participant_id, deliverable_id, file_url, version) VALUES (?, ?, ?, ?, ?)",
    args: [submissionId, participantId, deliverableId, fileUrl, version],
  });
}

/** Update an existing submission with a new file, resetting it to pending. */
export async function updateSubmissionVersion(fileUrl, submissionId) {
  return db.execute({
    sql: "UPDATE v2_submissions SET file_url = ?, status = 'pending', version = COALESCE(version, 1) + 1, updated_at = NOW() WHERE id = ?",
    args: [fileUrl, submissionId],
  });
}

/** Record a first submission for a participant+deliverable. */
export async function insertSubmission(participantId, programId, deliverableId, fileUrl) {
  return db.execute({
    sql: "INSERT INTO v2_submissions (participant_id, program_id, deliverable_id, file_url, status, version) VALUES (?, ?, ?, ?, 'pending', 1)",
    args: [participantId, programId, deliverableId, fileUrl],
  });
}

// ── GET/POST /api/participant/rituals/standup ────────────────────────────────

/** Standups for a user, optionally filtered by week number, newest first. */
export async function getStandupsByUserAndWeek(userId, weekNum) {
  let sql = "SELECT * FROM v2_standups WHERE user_id = ?";
  const args = [userId];
  if (weekNum) {
    sql += " AND week_number = ?";
    args.push(parseInt(weekNum));
  }
  sql += " ORDER BY created_at DESC";
  return db.execute({ sql, args });
}

/** Record a participant's standup for a week. */
export async function createStandup(userId, userName, weekNumber, year) {
  return db.execute({
    sql: "INSERT INTO v2_standups (user_id, user_name, week_number, year) VALUES (?, ?, ?, ?)",
    args: [userId, userName, weekNumber, year],
  });
}

// ── GET/POST /api/participant/rituals/retro ──────────────────────────────────

/** Retros for a user, optionally filtered by week number, newest first. */
export async function getRetrosByUserAndWeek(userId, weekNum) {
  let sql = "SELECT * FROM v2_retros WHERE user_id = ?";
  const args = [userId];
  if (weekNum) {
    sql += " AND week_number = ?";
    args.push(parseInt(weekNum));
  }
  sql += " ORDER BY created_at DESC";
  return db.execute({ sql, args });
}

/** Record a participant's retrospective for a week. */
export async function createRetro(userId, userName, weekNumber, year) {
  return db.execute({
    sql: "INSERT INTO v2_retros (user_id, user_name, week_number, year) VALUES (?, ?, ?, ?)",
    args: [userId, userName, weekNumber, year],
  });
}

// ── GET/POST /api/participant/rituals/reflect ────────────────────────────────

/** Reflections for a user, optionally filtered by week number, newest first. */
export async function getReflectionsByUserAndWeek(userId, weekNum) {
  let sql = "SELECT * FROM v2_reflections WHERE user_id = ?";
  const args = [userId];
  if (weekNum) {
    sql += " AND week_number = ?";
    args.push(parseInt(weekNum));
  }
  sql += " ORDER BY created_at DESC";
  return db.execute({ sql, args });
}

/** Record a participant's reflection for a week. */
export async function createReflection(userId, userName, content, weekNumber, year) {
  return db.execute({
    sql: "INSERT INTO v2_reflections (user_id, user_name, content, week_number, year) VALUES (?, ?, ?, ?, ?)",
    args: [userId, userName, content, weekNumber, year],
  });
}

// ── GET/POST /api/participant/rituals/checkin ────────────────────────────────

/** Checkins for a participant, optionally filtered by program, newest first. */
export async function getCheckinsByParticipantAndProgram(participantId, programId) {
  let sql = "SELECT * FROM v2_checkins WHERE participant_id = ?";
  const args = [participantId];
  if (programId) {
    sql += " AND program_id = ?";
    args.push(programId);
  }
  sql += " ORDER BY created_at DESC";
  return db.execute({ sql, args });
}

/** Record a participant's daily checkin for a program. */
export async function createCheckin(participantId, programId, status, notes) {
  return db.execute({
    sql: "INSERT INTO v2_checkins (participant_id, program_id, checkin_date, status, notes) VALUES (?, ?, CURRENT_DATE, ?, ?)",
    args: [participantId, programId, status, notes],
  });
}

// ── GET /api/participant/timeline ────────────────────────────────────────────

/** The user's own contact timeline (non-crm entries), newest first. */
export async function getParticipantTimeline(cid, limit) {
  return db.execute({
    sql: `SELECT id, event_type, description, context_module, context_id, created_at
            FROM contact_timeline
            WHERE contact_cid = ?
              AND (context_module IS NULL OR context_module != 'crm')
            ORDER BY created_at DESC
            LIMIT ?`,
    args: [cid, limit],
  });
}

// ── GET /api/participant/certificates ────────────────────────────────────────

/** Certificates issued to a participant (participant_programs rows). */
export async function getParticipantCertificates(cid) {
  return db.execute({
    sql: `SELECT CAST(pp.program_id AS TEXT) AS program_id,
                   p.name AS program_name,
                   pp.certificate_issued,
                   pp.completed_at,
                   pp.accepted_at
            FROM participant_programs pp
            JOIN v2_programs p ON CAST(p.id AS TEXT) = CAST(pp.program_id AS TEXT)
            WHERE pp.participant_id = ? AND pp.certificate_issued = true
            ORDER BY p.name ASC`,
    args: [cid],
  });
}

// ── GET/POST/DELETE /api/participant-programs ────────────────────────────────

/** Program assignments optionally filtered by participant and/or program. */
export async function getParticipantProgramAssignments(participantId, programId) {
  let sql = `
      SELECT pp.*, p.name AS program_name, p.status AS program_status
      FROM participant_programs pp
      LEFT JOIN v2_programs p ON pp.program_id = p.id
      WHERE 1=1
    `;
  const args = [];

  if (participantId) {
    sql += " AND pp.participant_id = ?";
    args.push(participantId);
  }

  if (programId) {
    sql += " AND pp.program_id = ?";
    args.push(programId);
  }

  sql += " ORDER BY pp.assigned_at DESC";

  return db.execute({ sql, args });
}

/** Program existence check before assigning. */
export async function getProgramById(programId) {
  return db.execute({
    sql: "SELECT id FROM v2_programs WHERE id = ?",
    args: [programId],
  });
}

/** Email of a contact (used to detect facilitator/participant conflicts). */
export async function getContactEmailByCid(participantId) {
  return db.execute({
    sql: "SELECT email FROM contacts WHERE cid = ? LIMIT 1",
    args: [participantId],
  });
}

/** Conflict check: is this contact already a facilitator of the program? */
export async function checkFacilitatorConflict(programId, participantId, participantEmail) {
  return db.execute({
    sql: `SELECT 1 FROM v2_program_staff
                WHERE CAST(program_id AS TEXT) = ? AND role = 'facilitator'
                  AND (staff_id = ? OR LOWER(TRIM(staff_id)) = LOWER(TRIM(?)))
                LIMIT 1`,
    args: [String(programId), participantId, participantEmail],
  });
}

/** Enroll a participant in a program (idempotent). */
export async function insertParticipantProgram(participantId, programId) {
  return db.execute({
    sql: `INSERT INTO participant_programs (participant_id, program_id)
                VALUES (?, ?)
                ON CONFLICT (participant_id, program_id) DO NOTHING`,
    args: [participantId, programId],
  });
}

/** Audit-log a participant → program assignment. */
export async function insertAssignmentAudit(participantId, programId, performedBy) {
  return db.execute({
    sql: `INSERT INTO participant_program_audit (participant_id, program_id, action, performed_by)
                VALUES (?, ?, 'assigned', ?)`,
    args: [participantId, programId, performedBy],
  });
}

/** Timeline event for a participant enrollment. */
export async function insertEnrollmentTimeline(participantId, programId) {
  return db.execute({
    sql: `INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, context_id, actor_id, metadata)
                  VALUES (?, 'participant_enrolled', 'Enrolled in program', 'programs', ?, 'system', '{}'::jsonb)`,
    args: [participantId, programId],
  });
}

/** Remove a participant from a program. */
export async function deleteParticipantProgram(participantId, programId) {
  return db.execute({
    sql: "DELETE FROM participant_programs WHERE participant_id = ? AND program_id = ?",
    args: [participantId, programId],
  });
}

/** Audit-log a participant ← program removal. */
export async function insertRemovalAudit(participantId, programId, performedBy) {
  return db.execute({
    sql: `INSERT INTO participant_program_audit (participant_id, program_id, action, performed_by)
            VALUES (?, ?, 'removed', ?)`,
    args: [participantId, programId, performedBy],
  });
}

/** Timeline event for a participant withdrawal. */
export async function insertWithdrawalTimeline(participantId, programId) {
  return db.execute({
    sql: `INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, context_id, actor_id, metadata)
              VALUES (?, 'participant_withdrawn', 'Withdrawn from program', 'programs', ?, 'system', '{}'::jsonb)`,
    args: [participantId, programId],
  });
}

// ── POST /api/participant-programs/bulk ──────────────────────────────────────

/** Program existence check before a bulk add. */
export async function getBulkProgramById(programId) {
  return db.execute({
    sql: "SELECT id FROM v2_programs WHERE id = ?",
    args: [programId],
  });
}

/** Conflict check for a bulk add: is this contact already a facilitator? */
export async function checkBulkFacilitatorConflict(programId, participantId) {
  return db.execute({
    sql: "SELECT 1 FROM v2_program_staff WHERE CAST(program_id AS TEXT) = ? AND role = 'facilitator' AND (staff_id = ? OR LOWER(TRIM(staff_id)) = LOWER(TRIM(?))) LIMIT 1",
    args: [String(programId), participantId, participantId],
  });
}

/** Bulk-enroll a participant in a program (idempotent). */
export async function insertBulkParticipantProgram(participantId, programId) {
  return db.execute({
    sql: `INSERT INTO participant_programs (participant_id, program_id)
                  VALUES (?, ?)
                  ON CONFLICT (participant_id, program_id) DO NOTHING`,
    args: [participantId, programId],
  });
}

/** Bulk-remove a participant from a program. */
export async function deleteBulkParticipantProgram(participantId, programId) {
  return db.execute({
    sql: "DELETE FROM participant_programs WHERE participant_id = ? AND program_id = ?",
    args: [participantId, programId],
  });
}

/** Audit-log a bulk add/remove (action passed by the controller). */
export async function insertBulkAudit(participantId, programId, auditAction, performedBy) {
  return db.execute({
    sql: `INSERT INTO participant_program_audit (participant_id, program_id, action, performed_by)
                VALUES (?, ?, ?, ?)`,
    args: [participantId, programId, auditAction, performedBy],
  });
}

// ── GET /api/participant/full-state — legacy participant portal bundle ───────

/** Participant cid looked up by email (falls back to the email itself in the controller). */
export async function getFullStateContactCidByEmail(email) {
  return db.execute({
    sql: "SELECT cid FROM contacts WHERE email = ?",
    args: [email],
  });
}

/** Program row looked up by name for the full-state bundle. */
export async function getFullStateProgramByName(groupName) {
  return db.execute({
    sql: "SELECT * FROM v2_programs WHERE name = ?",
    args: [groupName],
  });
}

/** Submissions of a participant (matched by text-cast id) for the full-state bundle. */
export async function getFullStateSubmissionsByParticipant(cid) {
  return db.execute({
    sql: "SELECT * FROM v2_submissions WHERE participant_id::text = ?",
    args: [cid],
  });
}

/** Sessions of a program for the full-state bundle. */
export async function getFullStateSessionsByProgram(groupName) {
  return db.execute({
    sql: "SELECT * FROM v2_sessions WHERE program_id = ?",
    args: [groupName],
  });
}

/** Notifications addressed to a recipient, newest first (full-state bundle). */
export async function getFullStateNotificationsByRecipient(email) {
  return db.execute({
    sql: "SELECT * FROM v2_notifications WHERE recipient_id = ? ORDER BY created_at DESC",
    args: [email],
  });
}

/** KPIs of a program for the full-state bundle. */
export async function getFullStateKpisByProgram(groupName) {
  return db.execute({
    sql: "SELECT * FROM v2_kpis WHERE program_id = ?",
    args: [groupName],
  });
}

/** Document requirements of a program for the full-state bundle. */
export async function getFullStateDocumentsByProgram(groupName) {
  return db.execute({
    sql: "SELECT * FROM v2_document_requirements WHERE program_id = ?",
    args: [groupName],
  });
}

/** Follow-ups of a program, newest first, limited to 3 (full-state bundle). */
export async function getFullStateFollowupsByProgram(groupName) {
  return db.execute({
    sql: "SELECT * FROM v2_followups WHERE program_id = ? ORDER BY created_at DESC LIMIT 3",
    args: [groupName],
  });
}

/** Team whose handler belongs to the group name (case-insensitive), limited to 1. */
export async function getFullStateTeamByGroupName(groupName) {
  return db.execute({
    sql: "SELECT t.* FROM v2_teams t JOIN contacts c ON c.cid = t.handler_id WHERE UPPER(TRIM(c.group_name)) = UPPER(TRIM(?)) LIMIT 1",
    args: [groupName],
  });
}

/** Family row by name (full-state bundle; controller swallows failures with a catch). */
export async function getFullStateFamilyByName(groupName) {
  return db.execute({
    sql: "SELECT * FROM families WHERE name = ?",
    args: [groupName],
  });
}

// ── GET/POST /api/participant/submissions ────────────────────────────────────

/** Submissions for a team OR a participant, optionally narrowed to one program. */
export async function getSubmissionsByParticipantOrTeam(teamId, participantId, programId) {
  let query =
    "SELECT *, document_id AS requirement_id FROM v2_submissions WHERE ";
  let args = [];

  if (teamId) {
    query += "team_id = ?";
    args.push(teamId);
  } else {
    query += "participant_id = ?";
    args.push(participantId);
  }

  if (programId) {
    query += " AND program_id = ?";
    args.push(programId);
  }

  return db.execute({ sql: query, args });
}

/** View-only gate: program/person-level completion status for a participant submission. */
export async function getSubmissionProgramCompletionStatus(participantCid, programId) {
  return db.execute({
    sql: `SELECT COALESCE(pp.status, p.status) AS status
              FROM v2_programs p
              LEFT JOIN participant_programs pp
                ON pp.program_id::text = p.id::text AND pp.participant_id = ?
              WHERE p.id::text = ?
              LIMIT 1`,
    args: [String(participantCid), String(programId)],
  });
}

/** Record a participant/team submission against a program deliverable. */
export async function insertParticipantSubmission(participantId, teamId, programId, requirementId, fileUrl) {
  return db.execute({
    sql: "INSERT INTO v2_submissions (participant_id, team_id, program_id, deliverable_id, file_url, status) VALUES (?, ?, ?, ?, ?, 'pending')",
    args: [
      participantId || null,
      teamId || null,
      programId,
      requirementId,
      fileUrl || null,
    ],
  });
}

// ── GET /api/participant/followups ───────────────────────────────────────────

/** Follow-up events (v2_events) for one participant, soonest-scheduled first. */
export async function getFollowupEventsByParticipant(cid) {
  return db.execute({
    sql: `SELECT e.id, e.title, e.description, e.start_time, e.end_time,
                 e.event_type, e.location as meeting_link, e.created_by, e.program_id,
                 p.name as program_name
          FROM v2_events e
          LEFT JOIN v2_programs p ON e.program_id::text = p.id::text
          WHERE e.event_type = 'followup'
            AND e.participant_id = ?
          ORDER BY e.start_time DESC`,
    args: [cid],
  });
}

/** Follow-up table rows (v2_followups joined to submissions) for one participant. */
export async function getFollowupTableRowsByParticipant(cid) {
  return db.execute({
    sql: `SELECT f.id as fu_id, f.comment, f.scheduled_at, f.duration_minutes, 
                   f.meeting_link, f.notes, f.status as fu_status,
                   p.name as program_name
            FROM v2_followups f
            LEFT JOIN v2_programs p ON f.program_id::text = p.id::text
            LEFT JOIN v2_submissions s ON f.submission_id::text = s.id::text
            WHERE s.participant_id = ?
            ORDER BY f.scheduled_at DESC`,
    args: [cid],
  });
}
