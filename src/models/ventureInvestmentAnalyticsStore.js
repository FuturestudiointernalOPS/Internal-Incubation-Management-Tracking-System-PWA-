/**
 * Venture investment analytics — statements (REPOSITORY layer).
 *
 * The data access behind `@/services/ventures/investmentAnalytics`: the
 * readiness / match / pipeline / data-room aggregates and the monthly activity
 * and funding trends.
 *
 * SQL is byte-identical to what used to sit inline in `src/lib/ventures.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";
import { resolveVentureInternalId } from "@/models/ventureIdentityStore";

/** A Venture's latest readiness score. */
export async function selectAnalyticsReadinessScore(ventureRef) {
  const ventureId = await resolveVentureInternalId(ventureRef);
  return db.execute({ sql: "SELECT overall_score FROM investment_assessments WHERE venture_id=? ORDER BY calculated_at DESC LIMIT 1", args: [ventureId] });
}

/** Match totals (count / average score) of a Venture. */
export async function selectAnalyticsMatchTotals(ventureRef) {
  const ventureId = await resolveVentureInternalId(ventureRef);
  return db.execute({ sql: "SELECT COUNT(*) as t, AVG(match_score) as avg FROM venture_investor_matches WHERE venture_id=?", args: [ventureId] });
}

/** Count the Venture's engaged matches. */
export async function countEngagedMatches(ventureRef) {
  const ventureId = await resolveVentureInternalId(ventureRef);
  return db.execute({
    sql: `SELECT COUNT(*) as c FROM venture_investor_matches WHERE venture_id=? AND (status='contacted' OR status='accepted' OR viewed_by_founder=TRUE)`,
    args: [ventureId],
  });
}

/** Pipeline totals (active / won / lost / values / probability). */
export async function selectAnalyticsPipelineTotals(ventureRef) {
  const ventureId = await resolveVentureInternalId(ventureRef);
  return db.execute({
    sql: `SELECT COUNT(*) as total,
       SUM(CASE WHEN stage NOT IN ('closed_won','closed_lost') THEN 1 ELSE 0 END) as active,
       SUM(CASE WHEN stage='closed_won' THEN 1 ELSE 0 END) as won,
       SUM(CASE WHEN stage='closed_lost' THEN 1 ELSE 0 END) as lost,
       SUM(CASE WHEN stage NOT IN ('closed_won','closed_lost') THEN expected_amount ELSE 0 END) as pipeline_value,
       SUM(CASE WHEN stage='closed_won' THEN expected_amount ELSE 0 END) as closed_value,
       AVG(probability) as avg_prob
       FROM fundraising_opportunities WHERE venture_id=?`,
    args: [ventureId],
  });
}

/** Count the Venture's live documents (soft-deleted rows excluded). */
export async function countAnalyticsDocuments(ventureRef) {
  // venture_documents is uuid since Phase 0; the analytics route carries the code and
  // the service swallows a failure into a zero, which reads as "no documents".
  const ventureId = await resolveVentureInternalId(ventureRef);
  return db.execute({
    sql: "SELECT COUNT(*) as t FROM venture_documents WHERE venture_id=? AND is_deleted = false",
    args: [ventureId],
  });
}

/**
 * Count the Venture's document views.
 *
 * The access journal stores the readable VNT code in its Venture column, while
 * this reader holds the internal id. Counting through the document join avoids
 * the identifier mismatch entirely and works whether the journal row was written
 * by the Data Room or by any older path.
 */
export async function countDocumentViews(ventureRef) {
  const ventureId = await resolveVentureInternalId(ventureRef);
  return db.execute({
    sql: `SELECT COUNT(*) as c
            FROM venture_document_access_logs al
            JOIN venture_documents d ON d.id = al.document_id
           WHERE d.venture_id = ? AND al.access_type='view'`,
    args: [ventureId],
  });
}

/** Count the Venture's document downloads. */
export async function countDocumentDownloads(ventureRef) {
  const ventureId = await resolveVentureInternalId(ventureRef);
  return db.execute({
    sql: `SELECT COUNT(*) as c
            FROM venture_document_access_logs al
            JOIN venture_documents d ON d.id = al.document_id
           WHERE d.venture_id = ? AND al.access_type='download'`,
    args: [ventureId],
  });
}

/** Count the Venture's pitch-deck views. */
export async function countPitchDeckViews(ventureRef) {
  const ventureId = await resolveVentureInternalId(ventureRef);
  return db.execute({ sql: "SELECT COUNT(*) as c FROM venture_document_access_logs al JOIN venture_documents d ON al.document_id=d.id WHERE d.venture_id=? AND d.is_pitch_deck=TRUE AND al.access_type='view'", args: [ventureId] });
}

/** Opportunity counts + values grouped by stage (analytics funnel). */
export async function selectAnalyticsPipelineFunnel(ventureRef) {
  const ventureId = await resolveVentureInternalId(ventureRef);
  return db.execute({
    sql: `SELECT stage, COUNT(*) as count, COALESCE(SUM(expected_amount),0) as value
       FROM fundraising_opportunities WHERE venture_id=? GROUP BY stage ORDER BY
       CASE stage WHEN 'prospect' THEN 0 WHEN 'contacted' THEN 1 WHEN 'meeting_scheduled' THEN 2
       WHEN 'pitch_delivered' THEN 3 WHEN 'due_diligence' THEN 4 WHEN 'negotiation' THEN 5
       WHEN 'term_sheet' THEN 6 WHEN 'closed_won' THEN 7 WHEN 'closed_lost' THEN 8 ELSE 9 END`,
    args: [ventureId],
  });
}

/** 12-month match-history activity of a Venture. */
export async function selectMonthlyMatchActivity(ventureRef) {
  const ventureId = await resolveVentureInternalId(ventureRef);
  return db.execute({
    sql: `SELECT DATE_TRUNC('month', created_at) as month, COUNT(*) as activities,
       SUM(CASE WHEN action LIKE '%CREATED%' OR action LIKE '%UPLOADED%' THEN 1 ELSE 0 END) as created,
       SUM(CASE WHEN action LIKE '%VIEWED%' THEN 1 ELSE 0 END) as viewed
       FROM venture_match_history WHERE venture_id=? AND created_at > NOW() - INTERVAL '12 months'
       GROUP BY month ORDER BY month`,
    args: [ventureId],
  });
}

/** 12-month funding trend (closed deals) of a Venture. */
export async function selectFundingTrend(ventureRef) {
  const ventureId = await resolveVentureInternalId(ventureRef);
  return db.execute({
    sql: `SELECT DATE_TRUNC('month', updated_at) as month, COUNT(*) as deals,
       COALESCE(SUM(expected_amount),0) as amount
       FROM fundraising_opportunities WHERE venture_id=? AND stage='closed_won'
       AND created_at > NOW() - INTERVAL '12 months'
       GROUP BY month ORDER BY month`,
    args: [ventureId],
  });
}
