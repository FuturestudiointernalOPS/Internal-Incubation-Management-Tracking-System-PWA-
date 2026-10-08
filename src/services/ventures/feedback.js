/**
 * VENTURE MENTOR FEEDBACK & ANALYTICS.
 *
 * The founder-to-coach feedback (submit with its session gate, read, list,
 * delete), the coach-analytics recalculation it triggers, and the mentor /
 * session / feedback analytics views.
 *
 * The decisions — the session-status gate, the rating range, the analytics
 * formulas (attendance, cancellation, satisfaction, engagement) — live here;
 * every statement is in `@/models/ventureFeedbackStore`. Nothing here runs SQL.
 *
 * This module used to be re-exported through `@/lib/ventures`; that barrel is
 * gone (CH-4) and importers read this module directly. See docs/LAYER_SPLIT.md.
 */

import {
  selectSessionStatus,
  upsertMentorFeedback,
  insertFeedbackActivity,
  selectFeedbackById,
  selectFeedbackList,
  deleteFeedbackRow,
  selectCoachRatingAverage,
  countCoachCompletedSessions,
  countCoachAttendedSessions,
  countCoachCancelledSessions,
  countCoachActiveAssignments,
  countCoachCompletedActionItems,
  sumCoachMentoringHours,
  selectCoachType,
  upsertMentorAnalytics,
  selectMentorAnalytics,
  countVentureSessions,
  countVentureSessionsCompleted,
  countVentureSessionsCancelled,
  countVentureSessionsNoShow,
  sumVentureSessionHours,
  selectVentureFeedbackAverage,
  selectFeedbackTrend,
  selectFeedbackDistribution,
} from "@/models/ventureFeedbackStore";

export async function submitFeedback({ sessionId, ventureId, coachId, founderCid, ratingOverall, ratingCommunication, ratingExpertise, ratingAvailability, ratingHelpfulness, comments, isAnonymous }) {
  const sessionResult = await selectSessionStatus(sessionId);
  if (sessionResult.rows.length === 0) throw new Error("Session not found.");
  if (!["completed", "in_progress"].includes(sessionResult.rows[0].status)) throw new Error("Feedback requires a completed or in-progress session.");
  if (!ratingOverall || ratingOverall < 1 || ratingOverall > 5) throw new Error("Rating must be 1-5.");

  const id = (await upsertMentorFeedback({
    sessionId, ventureId, coachId: coachId||null, founderCid: founderCid||null, ratingOverall,
    ratingCommunication: ratingCommunication||null, ratingExpertise: ratingExpertise||null,
    ratingAvailability: ratingAvailability||null, ratingHelpfulness: ratingHelpfulness||null,
    comments: comments||null, isAnonymous: isAnonymous?1:0,
  })).rows[0]?.id;
  if (coachId) await recalculateCoachAnalytics(coachId);
  await insertFeedbackActivity(id, coachId, ventureId, founderCid||"system");
  return { id };
}

export async function getFeedback(feedbackId) {
  const result = await selectFeedbackById(feedbackId);
  return result.rows[0] || null;
}

export async function listFeedback({ ventureId, coachId, sessionId }) {
  const result = await selectFeedbackList({ ventureId, coachId, sessionId });
  return result.rows || [];
}

export async function deleteFeedback(feedbackId) {
  const feedback = await getFeedback(feedbackId);
  if (!feedback) return { success: false };
  await deleteFeedbackRow(feedbackId);
  if (feedback.coach_id) await recalculateCoachAnalytics(feedback.coach_id);
  return { success: true };
}

async function recalculateCoachAnalytics(coachId) {
  if (!coachId) return;
  const [ratingResult, sessionResult, attendanceResult, cancelledResult, assignmentResult, actionItemResult, hoursResult] = await Promise.all([
    selectCoachRatingAverage(coachId),
    countCoachCompletedSessions(coachId),
    countCoachAttendedSessions(coachId),
    countCoachCancelledSessions(coachId),
    countCoachActiveAssignments(coachId),
    countCoachCompletedActionItems(coachId),
    sumCoachMentoringHours(coachId),
  ]);
  const averageRating = parseFloat(ratingResult.rows[0]?.r)||0;
  const feedbackCount = parseInt(ratingResult.rows[0]?.c)||0;
  const sessionsCompleted = parseInt(sessionResult.rows[0]?.c)||0;
  const attended = parseInt(attendanceResult.rows[0]?.a)||0;
  const cancelled = parseInt(cancelledResult.rows[0]?.c)||0;
  const totalSessions = sessionsCompleted + cancelled || 1;
  const coachTypeResult = await selectCoachType(coachId);
  const coachType = coachTypeResult.rows[0]?.coach_type || "coach";

  await upsertMentorAnalytics({
    coachId,
    coachType,
    averageRating: Math.round(averageRating*100)/100,
    sessionsCompleted,
    attendanceRate: sessionsCompleted>0?Math.round((attended/sessionsCompleted)*100):0,
    cancellationRate: Math.round((cancelled/totalSessions)*100),
    assignedVentures: parseInt(assignmentResult.rows[0]?.c)||0,
    completedActionItems: parseInt(actionItemResult.rows[0]?.c)||0,
    mentoringHours: Math.round(parseFloat(hoursResult.rows[0]?.h||0)*100)/100,
    founderSatisfaction: feedbackCount>0?Math.round(averageRating*20):0,
    engagementScore: Math.min(100, Math.round((sessionsCompleted*5)+(parseInt(assignmentResult.rows[0]?.c||0)*10)+(parseInt(actionItemResult.rows[0]?.c||0)*3)+(parseFloat(hoursResult.rows[0]?.h||0)*2))),
  });
}

export async function getMentorAnalytics(coachType) {
  const result = await selectMentorAnalytics(coachType);
  return (result.rows||[]).map((row) => ({...row, areas_of_expertise: typeof row.areas_of_expertise==="string"?JSON.parse(row.areas_of_expertise):(row.areas_of_expertise||[])}));
}

export async function getSessionAnalytics(ventureId) {
  const [totalResult, completedResult, cancelledResult, noShowResult, hoursResult, feedbackResult] = await Promise.all([
    countVentureSessions(ventureId),
    countVentureSessionsCompleted(ventureId),
    countVentureSessionsCancelled(ventureId),
    countVentureSessionsNoShow(ventureId),
    sumVentureSessionHours(ventureId),
    selectVentureFeedbackAverage(ventureId),
  ]);
  const total = parseInt(totalResult.rows[0]?.c||0);
  return {
    total_sessions: total, completed: parseInt(completedResult.rows[0]?.c||0),
    cancelled: parseInt(cancelledResult.rows[0]?.c||0), no_shows: parseInt(noShowResult.rows[0]?.c||0),
    total_hours: Math.round(parseFloat(hoursResult.rows[0]?.h||0)*10)/10,
    average_rating: parseFloat(feedbackResult.rows[0]?.r)||0, feedback_count: parseInt(feedbackResult.rows[0]?.c||0),
    completion_rate: total>0?Math.round((parseInt(completedResult.rows[0]?.c||0)/total)*100):0,
  };
}

export async function getFeedbackAnalytics(ventureId) {
  const [trend, dist] = await Promise.all([
    selectFeedbackTrend(ventureId),
    selectFeedbackDistribution(ventureId),
  ]);
  return { trend: trend.rows||[], distribution: dist.rows||[] };
}
