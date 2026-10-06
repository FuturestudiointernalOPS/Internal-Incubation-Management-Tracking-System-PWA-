/**
 * VENTURE INVESTMENT ANALYTICS & REPORTS.
 *
 * The full investment analytics aggregation (readiness, match, pipeline, data
 * room, funnel, monthly activity and funding trends) and the export summary
 * derived from it.
 *
 * The decisions — the engagement/win rates, the per-section safe fallbacks and
 * the summary KPI shaping — live here; every statement is in
 * `@/models/ventureInvestmentAnalyticsStore`. Nothing here runs SQL.
 *
 * This module used to be re-exported through `@/lib/ventures`; that barrel is
 * gone (CH-4) and importers read this module directly. See docs/LAYER_SPLIT.md.
 */

import {
  selectAnalyticsReadinessScore,
  selectAnalyticsMatchTotals,
  countEngagedMatches,
  selectAnalyticsPipelineTotals,
  countAnalyticsDocuments,
  countDocumentViews,
  countDocumentDownloads,
  countPitchDeckViews,
  selectAnalyticsPipelineFunnel,
  selectMonthlyMatchActivity,
  selectFundingTrend,
} from "@/models/ventureInvestmentAnalyticsStore";

/**
 * Full investment analytics aggregation for a venture.
 * Aggregates data from: Investment Readiness, Investor Matching, Data Room, Fundraising Pipeline.
 */
export async function getInvestmentAnalytics(ventureId) {
  const results = {};

  // 1. Investment Readiness
  try {
    const assessmentResult = await selectAnalyticsReadinessScore(ventureId);
    results.readiness_score = assessmentResult.rows[0]?.overall_score || 0;
  } catch { results.readiness_score = 0; }

  // 2. Investor Matches
  try {
    const matchResult = await selectAnalyticsMatchTotals(ventureId);
    const matches = matchResult.rows[0] || {};
    results.total_matches = parseInt(matches.t) || 0;
    results.avg_match_score = Math.round(parseFloat(matches.avg) || 0);

    const engagement = await countEngagedMatches(ventureId);
    const engaged = parseInt(engagement.rows[0]?.c || 0);
    results.investor_engagement_score = results.total_matches > 0 ? Math.round((engaged / results.total_matches) * 100) : 0;
  } catch { results.total_matches = 0; results.avg_match_score = 0; results.investor_engagement_score = 0; }

  // 3. Fundraising Pipeline
  try {
    const pipelineResult = await selectAnalyticsPipelineTotals(ventureId);
    const pipelineTotals = pipelineResult.rows[0] || {};
    results.active_opportunities = parseInt(pipelineTotals.active) || 0;
    results.total_opportunities = parseInt(pipelineTotals.total) || 0;
    results.closed_investments = parseInt(pipelineTotals.won) || 0;
    results.pipeline_value = parseFloat(pipelineTotals.pipeline_value) || 0;
    results.closed_value = parseFloat(pipelineTotals.closed_value) || 0;
    results.avg_probability = Math.round(parseFloat(pipelineTotals.avg_prob) || 0);
    results.win_rate = (parseInt(pipelineTotals.won) + parseInt(pipelineTotals.lost)) > 0
      ? Math.round((parseInt(pipelineTotals.won) / (parseInt(pipelineTotals.won) + parseInt(pipelineTotals.lost))) * 100) : 0;
  } catch { results.active_opportunities = 0; results.pipeline_value = 0; results.win_rate = 0; results.closed_investments = 0; }

  // 4. Data Room
  try {
    const documentResult = await countAnalyticsDocuments(ventureId);
    results.documents_uploaded = parseInt(documentResult.rows[0]?.t || 0);

    const views = await countDocumentViews(ventureId);
    results.documents_viewed = parseInt(views.rows[0]?.c || 0);

    const downloads = await countDocumentDownloads(ventureId);
    results.documents_downloaded = parseInt(downloads.rows[0]?.c || 0);

    const pitch = await countPitchDeckViews(ventureId);
    results.pitch_deck_views = parseInt(pitch.rows[0]?.c || 0);
  } catch { results.documents_uploaded = 0; results.documents_viewed = 0; results.documents_downloaded = 0; results.pitch_deck_views = 0; }

  // 5. Pipeline Funnel (stage distribution)
  try {
    const funnel = await selectAnalyticsPipelineFunnel(ventureId);
    results.pipeline_funnel = (funnel.rows || []).map((row) => ({ stage: row.stage, count: parseInt(row.count), value: parseFloat(row.value) }));
  } catch { results.pipeline_funnel = []; }

  // 6. Monthly activity trend
  try {
    const trend = await selectMonthlyMatchActivity(ventureId).catch(() => ({ rows: [] }));
    results.monthly_activity = (trend.rows || []).map((row) => ({
      month: row.month, activities: parseInt(row.activities), created: parseInt(row.created), viewed: parseInt(row.viewed),
    }));
  } catch { results.monthly_activity = []; }

  // 7. Funding trend (closed deals over time)
  try {
    const fundingTrend = await selectFundingTrend(ventureId).catch(() => ({ rows: [] }));
    results.funding_trend = (fundingTrend.rows || []).map((row) => ({
      month: row.month, deals: parseInt(row.deals), amount: parseFloat(row.amount),
    }));
  } catch { results.funding_trend = []; }

  return results;
}

/**
 * Generate a report summary (for export).
 */
export async function getInvestmentReportSummary(ventureId) {
  const analytics = await getInvestmentAnalytics(ventureId);

  const summary = {
    generated_at: new Date().toISOString(),
    kpis: {
      "Investment Readiness": `${analytics.readiness_score || 0}%`,
      "Investor Matches": analytics.total_matches || 0,
      "Avg Match Score": `${analytics.avg_match_score || 0}%`,
      "Active Opportunities": analytics.active_opportunities || 0,
      "Pipeline Value": `$${(analytics.pipeline_value || 0).toLocaleString()}`,
      "Closed Investments": analytics.closed_investments || 0,
      "Closed Value": `$${(analytics.closed_value || 0).toLocaleString()}`,
      "Win Rate": `${analytics.win_rate || 0}%`,
      "Investor Engagement": `${analytics.investor_engagement_score || 0}%`,
      "Documents Uploaded": analytics.documents_uploaded || 0,
      "Documents Viewed": analytics.documents_viewed || 0,
      "Documents Downloaded": analytics.documents_downloaded || 0,
      "Pitch Deck Views": analytics.pitch_deck_views || 0,
    },
  };

  return summary;
}
