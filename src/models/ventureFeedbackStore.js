/**
 * Venture mentor feedback & analytics — statements (REPOSITORY layer).
 *
 * The data access behind `@/services/ventures/feedback`: the mentor feedback
 * rows, the coach-analytics roll-up reads and upsert, the mentor analytics view,
 * and the session / feedback analytics queries.
 *
 * SQL is byte-identical to what used to sit inline in `src/lib/ventures.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";

// ── Feedback rows ────────────────────────────────────────────────────────────

/** The status of a session. */
export function selectSessionStatus(sessionId) {
  return db.execute({ sql: "SELECT status FROM venture_sessions WHERE id = ?", args: [sessionId] });
}

/** Upsert one mentor feedback row, returning its id. */
export function upsertMentorFeedback({
  sessionId, ventureId, coachId, founderCid, ratingOverall, ratingCommunication,
  ratingExpertise, ratingAvailability, ratingHelpfulness, comments, isAnonymous,
}) {
  return db.execute({
    sql: `INSERT INTO venture_mentor_feedback (session_id, venture_id, coach_id, founder_cid, rating_overall, rating_communication, rating_expertise, rating_availability, rating_helpfulness, comments, is_anonymous)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (session_id, coach_id) DO UPDATE SET
          rating_overall=EXCLUDED.rating_overall, comments=EXCLUDED.comments, updated_at=NOW() RETURNING id`,
    args: [sessionId, ventureId, coachId, founderCid, ratingOverall, ratingCommunication, ratingExpertise, ratingAvailability, ratingHelpfulness, comments, isAnonymous],
  });
}

/** Append the FEEDBACK_SUBMITTED activity row. */
export function insertFeedbackActivity(feedbackId, coachId, ventureId, actorCid) {
  return db.execute({ sql: `INSERT INTO venture_feedback_activity (feedback_id, coach_id, venture_id, action, actor_cid) VALUES (?, ?, ?, 'FEEDBACK_SUBMITTED', ?)`, args: [feedbackId, coachId, ventureId, actorCid] });
}

/** One feedback row with its session title. */
export function selectFeedbackById(feedbackId) {
  return db.execute({ sql: "SELECT vmf.*, vs.title as session_title FROM venture_mentor_feedback vmf LEFT JOIN venture_sessions vs ON vmf.session_id = vs.id WHERE vmf.id = ?", args: [feedbackId] });
}

/** Feedback rows (optional filters), newest first. */
export function selectFeedbackList({ ventureId, coachId, sessionId } = {}) {
  let sql = `SELECT vmf.*, vs.title as session_title, vs.session_type, vc.full_name as coach_name FROM venture_mentor_feedback vmf LEFT JOIN venture_sessions vs ON vmf.session_id = vs.id LEFT JOIN venture_coaches vc ON vmf.coach_id = vc.id WHERE 1=1`;
  const args = [];
  if (ventureId) { sql += " AND vmf.venture_id = ?"; args.push(ventureId); }
  if (coachId) { sql += " AND vmf.coach_id = ?"; args.push(parseInt(coachId)); }
  if (sessionId) { sql += " AND vmf.session_id = ?"; args.push(parseInt(sessionId)); }
  sql += " ORDER BY vmf.created_at DESC LIMIT 50";
  return db.execute({ sql, args });
}

/** Delete one feedback row. */
export function deleteFeedbackRow(feedbackId) {
  return db.execute({ sql: "DELETE FROM venture_mentor_feedback WHERE id = ?", args: [feedbackId] });
}

// ── Coach-analytics reads ────────────────────────────────────────────────────

/** Average rating + count of a coach's feedback. */
export function selectCoachRatingAverage(coachId) {
  return db.execute({ sql: "SELECT AVG(rating_overall) as r, COUNT(*) as c FROM venture_mentor_feedback WHERE coach_id=?", args: [coachId] });
}

/** Completed session count of a coach. */
export function countCoachCompletedSessions(coachId) {
  return db.execute({ sql: "SELECT COUNT(*) as c FROM venture_sessions WHERE coach_id=? AND status='completed'", args: [coachId] });
}

/** Attended session count of a coach. */
export function countCoachAttendedSessions(coachId) {
  return db.execute({ sql: `SELECT COUNT(*) as a FROM venture_session_attendance WHERE session_id IN (SELECT id FROM venture_sessions WHERE coach_id=?) AND status='attended'`, args: [coachId] });
}

/** Cancelled session count of a coach. */
export function countCoachCancelledSessions(coachId) {
  return db.execute({ sql: "SELECT COUNT(*) as c FROM venture_sessions WHERE coach_id=? AND status='cancelled'", args: [coachId] });
}

/** Active assignment count of a coach. */
export function countCoachActiveAssignments(coachId) {
  return db.execute({ sql: "SELECT COUNT(*) as c FROM venture_coach_assignments WHERE coach_id=? AND status='active'", args: [coachId] });
}

/** Completed action-item count of a coach. */
export function countCoachCompletedActionItems(coachId) {
  return db.execute({ sql: `SELECT COUNT(*) as c FROM venture_session_action_items vai JOIN venture_sessions vs ON vai.session_id=vs.id WHERE vs.coach_id=? AND vai.status='completed'`, args: [coachId] });
}

/** Total mentoring hours of a coach. */
export function sumCoachMentoringHours(coachId) {
  return db.execute({ sql: `SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (end_time-start_time))/3600),0) as h FROM venture_sessions WHERE coach_id=? AND status='completed'`, args: [coachId] });
}

/** The coach type of a coach. */
export function selectCoachType(coachId) {
  return db.execute({ sql: "SELECT coach_type FROM venture_coaches WHERE id=?", args: [coachId] });
}

/** Upsert one coach-analytics row. */
export function upsertMentorAnalytics({
  coachId, coachType, averageRating, sessionsCompleted, attendanceRate, cancellationRate,
  assignedVentures, completedActionItems, mentoringHours, founderSatisfaction, engagementScore,
}) {
  return db.execute({
    sql: `INSERT INTO venture_mentor_analytics (coach_id, coach_type, average_rating, sessions_completed, attendance_rate, cancellation_rate, assigned_ventures, completed_action_items, mentoring_hours, founder_satisfaction, engagement_score, last_calculated)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
          ON CONFLICT (coach_id) DO UPDATE SET average_rating=EXCLUDED.average_rating, sessions_completed=EXCLUDED.sessions_completed,
          attendance_rate=EXCLUDED.attendance_rate, cancellation_rate=EXCLUDED.cancellation_rate,
          assigned_ventures=EXCLUDED.assigned_ventures, completed_action_items=EXCLUDED.completed_action_items,
          mentoring_hours=EXCLUDED.mentoring_hours, founder_satisfaction=EXCLUDED.founder_satisfaction,
          engagement_score=EXCLUDED.engagement_score, last_calculated=NOW(), updated_at=NOW()`,
    args: [coachId, coachType, averageRating, sessionsCompleted, attendanceRate, cancellationRate,
      assignedVentures, completedActionItems, mentoringHours, founderSatisfaction, engagementScore],
  });
}

/** The coach-analytics view for a coach type. */
export function selectMentorAnalytics(coachType) {
  return db.execute({
    sql: `SELECT vma.*, vc.full_name, vc.email, vc.photo_url, vc.organization, vc.areas_of_expertise FROM venture_mentor_analytics vma JOIN venture_coaches vc ON vma.coach_id = vc.id WHERE vma.coach_type=? AND vc.status='active' ORDER BY vma.engagement_score DESC LIMIT 50`,
    args: [coachType],
  });
}

// ── Session + feedback analytics ─────────────────────────────────────────────

/** Total session count of a Venture. */
export function countVentureSessions(ventureId) {
  return db.execute({ sql: "SELECT COUNT(*) as c FROM venture_sessions WHERE venture_id=?", args: [ventureId] });
}

/** Completed session count of a Venture. */
export function countVentureSessionsCompleted(ventureId) {
  return db.execute({ sql: "SELECT COUNT(*) as c FROM venture_sessions WHERE venture_id=? AND status='completed'", args: [ventureId] });
}

/** Cancelled session count of a Venture. */
export function countVentureSessionsCancelled(ventureId) {
  return db.execute({ sql: "SELECT COUNT(*) as c FROM venture_sessions WHERE venture_id=? AND status='cancelled'", args: [ventureId] });
}

/** No-show session count of a Venture. */
export function countVentureSessionsNoShow(ventureId) {
  return db.execute({ sql: "SELECT COUNT(*) as c FROM venture_sessions WHERE venture_id=? AND status='no_show'", args: [ventureId] });
}

/** Total completed session hours of a Venture. */
export function sumVentureSessionHours(ventureId) {
  return db.execute({ sql: `SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (end_time-start_time))/3600),0) as h FROM venture_sessions WHERE venture_id=? AND status='completed'`, args: [ventureId] });
}

/** Feedback average + count of a Venture. */
export function selectVentureFeedbackAverage(ventureId) {
  return db.execute({ sql: "SELECT AVG(rating_overall) as r, COUNT(*) as c FROM venture_mentor_feedback WHERE venture_id=?", args: [ventureId] });
}

/** 30-day feedback rating trend of a Venture. */
export function selectFeedbackTrend(ventureId) {
  return db.execute({ sql: `SELECT DATE(created_at) as d, AVG(rating_overall) as r, COUNT(*) as c FROM venture_mentor_feedback WHERE venture_id=? GROUP BY DATE(created_at) ORDER BY d LIMIT 30`, args: [ventureId] });
}

/** Feedback rating distribution of a Venture. */
export function selectFeedbackDistribution(ventureId) {
  return db.execute({ sql: `SELECT rating_overall, COUNT(*) as c FROM venture_mentor_feedback WHERE venture_id=? GROUP BY rating_overall ORDER BY rating_overall`, args: [ventureId] });
}
