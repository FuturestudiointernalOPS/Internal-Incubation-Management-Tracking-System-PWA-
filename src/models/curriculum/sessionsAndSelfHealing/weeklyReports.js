import db from "@/lib/db";

/**
 * List weekly reports, newest first, optionally narrowed to one program and/or
 * one week. The row shape is the stored `v2_weekly_reports` row (the
 * `teacher_id` / `teacher_name` columns are storage and keep their names).
 */
export async function listWeeklyReports(programId, weekNumber) {
  let sql = "SELECT * FROM v2_weekly_reports WHERE 1=1";
  const args = [];

  if (programId) {
    sql += " AND program_id = ?";
    args.push(programId);
  }
  if (weekNumber) {
    sql += " AND week_number = ?";
    args.push(parseInt(weekNumber));
  }

  sql += " ORDER BY created_at DESC";

  return db.execute({ sql, args });
}

/** Upsert a weekly PM report keyed on (program_id, week_number, teacher_id). */
export async function upsertWeeklyReport(
  programId,
  weekNumber,
  teacherId,
  teacherName,
  progressNotes,
  receptionScore,
  weekStatus,
  weekRating,
  mainTopic,
  assignmentGiven,
  assignmentKpiIds,
  assignmentObjective,
  assignmentOutcome,
  attendanceLevel,
  participationLevel,
  participantsNeedAttention,
  participantsAttentionNotes,
  standoutParticipants,
  standoutNotes,
  deliveryQuality,
  participantUnderstanding,
  deliveryChallenges,
  deliveryChallengeNote,
  hadIssues,
  issueTypes,
  requiresAdminAttention,
  additionalIssueNote,
  programOnTrack,
  plannedAdjustments,
  attachmentType,
  attachmentUrl,
) {
  return db.execute({
    sql: `INSERT INTO v2_weekly_reports
                  (program_id, week_number, teacher_id, teacher_name, progress_notes, reception_score,
                   week_status, week_rating, main_topic,
                   assignment_given, assignment_kpi_ids, assignment_objective, assignment_outcome,
                   attendance_level, participation_level,
                   participants_need_attention, participants_attention_notes,
                   standout_participants, standout_notes,
                   delivery_quality, participant_understanding,
                   delivery_challenges, delivery_challenge_note,
                   had_issues, issue_types, requires_admin_attention, additional_issue_note,
                   program_on_track, planned_adjustments,
                   attachment_type, attachment_url)
                  VALUES (?, ?, ?, ?, ?, ?,
                   ?, ?, ?,
                   ?, ?, ?, ?,
                   ?, ?,
                   ?, ?,
                   ?, ?,
                   ?, ?,
                   ?, ?,
                   ?, ?,
                   ?, ?, ?, ?,
                   ?, ?)
                  ON CONFLICT (program_id, week_number, teacher_id)
                  DO UPDATE SET
                    teacher_name = EXCLUDED.teacher_name,
                    progress_notes = EXCLUDED.progress_notes,
                    reception_score = EXCLUDED.reception_score,
                    week_status = EXCLUDED.week_status,
                    week_rating = EXCLUDED.week_rating,
                    main_topic = EXCLUDED.main_topic,
                    assignment_given = EXCLUDED.assignment_given,
                    assignment_kpi_ids = EXCLUDED.assignment_kpi_ids,
                    assignment_objective = EXCLUDED.assignment_objective,
                    assignment_outcome = EXCLUDED.assignment_outcome,
                    attendance_level = EXCLUDED.attendance_level,
                    participation_level = EXCLUDED.participation_level,
                    participants_need_attention = EXCLUDED.participants_need_attention,
                    participants_attention_notes = EXCLUDED.participants_attention_notes,
                    standout_participants = EXCLUDED.standout_participants,
                    standout_notes = EXCLUDED.standout_notes,
                    delivery_quality = EXCLUDED.delivery_quality,
                    participant_understanding = EXCLUDED.participant_understanding,
                    delivery_challenges = EXCLUDED.delivery_challenges,
                    delivery_challenge_note = EXCLUDED.delivery_challenge_note,
                    had_issues = EXCLUDED.had_issues,
                    issue_types = EXCLUDED.issue_types,
                    requires_admin_attention = EXCLUDED.requires_admin_attention,
                    additional_issue_note = EXCLUDED.additional_issue_note,
                    program_on_track = EXCLUDED.program_on_track,
                    planned_adjustments = EXCLUDED.planned_adjustments,
                    attachment_type = EXCLUDED.attachment_type,
                    attachment_url = EXCLUDED.attachment_url`,
    args: [
      programId,
      weekNumber,
      teacherId,
      teacherName,
      progressNotes,
      receptionScore,
      weekStatus,
      weekRating,
      mainTopic,
      assignmentGiven,
      assignmentKpiIds,
      assignmentObjective,
      assignmentOutcome,
      attendanceLevel,
      participationLevel,
      participantsNeedAttention,
      participantsAttentionNotes,
      standoutParticipants,
      standoutNotes,
      deliveryQuality,
      participantUnderstanding,
      deliveryChallenges,
      deliveryChallengeNote,
      hadIssues,
      issueTypes,
      requiresAdminAttention,
      additionalIssueNote,
      programOnTrack,
      plannedAdjustments,
      attachmentType,
      attachmentUrl,
    ],
  });
}
