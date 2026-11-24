/**
 * Investor service — the personalized investor dashboard.
 *
 * Layer (see docs/LAYER_SPLIT.md): the DECISIONS live here — the recommendation
 * scoring (industry / country / stage / ticket weights, adjusted by the
 * investor's visibility mode) and its ordering, plus the assembly of the
 * pipeline, watchlist, campaigns and relationship blocks. Every statement lives
 * in `@/models/investor`. No SQL, no HTTP.
 *
 * Phase 1–3: the payload is DTO-shaped (only investor-visible fields), and the
 * visibility mode is honoured — deal-flow-only recommendations come from live
 * deal flow, full-pipeline ones from the venture directory.
 */

import {
  countInvestorWatchlist,
  getInvestorDashboardProfile,
  getInvestorPipelineStats,
  listActiveDealFlowEntriesWithVenture,
  listActiveFundraisingCampaigns,
  listActiveInvestorRelationshipWorkspaces,
  listActiveVenturesForRecommendations,
  listInvestorPipelineEntries,
  listInvestorWatchlist,
  listUpcomingRelationshipMeetings,
} from "@/models/investor";
import {
  investorPipelineRow,
  investorVentureCard,
  investorWatchlistRow,
} from "@/services/investor/dto";

/**
 * Score each active venture against the investor's preferences and return them
 * in display order.
 *
 * Weights differ by visibility mode (spec §4.4):
 *   deal flow only — industry 40, country 30, ticket 30; no stage, no completion
 *   full pipeline  — industry 30, country 25, stage 20, ticket 25
 * The completion bonus is gone: completion is neither shown to investors nor
 * meaningful for a directory venture.
 */
export function scoreVentures({ profile, ventures, mode = "deal_flow_only" }) {
  const weights =
    mode === "deal_flow_only"
      ? { industry: 40, country: 30, stage: 0, ticket: 30 }
      : { industry: 30, country: 25, stage: 20, ticket: 25 };

  const industries = profile.industries || [];
  const countries = profile.countries || [];
  const stages = profile.startup_stages || [];
  const ticketMin = profile.ticket_size_min;
  const ticketMax = profile.ticket_size_max;

  let recommendations = ventures.map((venture) => {
    let score = 0;
    const reasons = [];

    if (industries.length > 0) {
      const match = industries.some((industry) =>
        (venture.industry || "").toLowerCase().includes(String(industry).toLowerCase()),
      );
      if (match) {
        score += weights.industry;
        reasons.push(`Industry: ${venture.industry}`);
      }
    }

    if (countries.length > 0) {
      const match = countries.some(
        (country) => (venture.country || "").toUpperCase() === String(country).toUpperCase(),
      );
      if (match) {
        score += weights.country;
        reasons.push(`Country: ${venture.country}`);
      }
    }

    if (weights.stage > 0 && stages.length > 0) {
      const ventureStage = (venture.business_stage || "").trim().toLowerCase();
      const match =
        ventureStage !== "" &&
        stages.some((stage) => stage.trim().toLowerCase() === ventureStage);
      if (match) {
        score += weights.stage;
        reasons.push(`Stage: ${venture.business_stage}`);
      }
    }

    if (ticketMin || ticketMax) {
      const raise = parseFloat(venture.raise_amount ?? venture.funding_requirement) || 0;
      if ((!ticketMin || raise >= ticketMin) && (!ticketMax || raise <= ticketMax)) {
        score += weights.ticket;
        reasons.push(raise > 0 ? `Funding: ${raise.toLocaleString()}` : "Funding: matches range");
      }
    }

    return { ...venture, match_score: score, match_reasons: reasons };
  });

  const hasPreferences =
    industries.length > 0 ||
    countries.length > 0 ||
    (weights.stage > 0 && stages.length > 0);

  if (hasPreferences) {
    recommendations = recommendations
      .filter((recommendation) => recommendation.match_score > 0)
      .sort((first, second) => second.match_score - first.match_score);
  }

  return recommendations;
}

/**
 * Assemble the caller's dashboard. A caller with no investor profile gets the
 * empty payload. Recommendation, campaign and relationship blocks are each
 * best-effort: a failure there never fails the whole dashboard.
 */
/**
 * The compact investor block the unified member dashboard shows.
 *
 * The full investor dashboard also carries campaigns, relationship workspaces
 * and their meetings (an N+1 by design, because every relationship shows its
 * next meetings). None of that belongs on a page that every member opens: the
 * unified dashboard needs the figures and a few led candidates, and the deal
 * flow / portfolio screens keep the browsing.
 *
 * Returns `null` when the person holds no investor profile, which is what makes
 * the section disappear entirely instead of rendering empty figures.
 */
export async function buildInvestorDashboardSummary({ session }) {
  const profileResult = await getInvestorDashboardProfile(session.cid || session.id);
  const profile = profileResult.rows[0];
  if (!profile) return null;

  const mode = profile.visibility_mode || "deal_flow_only";

  const [statsResult, watchlistCount] = await Promise.all([
    getInvestorPipelineStats(profile.id),
    countInvestorWatchlist(profile.id),
  ]);

  let recommendations = [];
  try {
    if (mode === "deal_flow_only") {
      const dealFlow = await listActiveDealFlowEntriesWithVenture();
      recommendations = scoreVentures({
        profile,
        mode,
        ventures: (dealFlow.rows || []).map((row) => ({
          ...row,
          raise_amount: row.target_amount,
        })),
      });
    } else {
      const allVentures = await listActiveVenturesForRecommendations();
      recommendations = scoreVentures({ profile, ventures: allVentures.rows, mode });
    }

    recommendations = recommendations.map((venture) =>
      investorVentureCard(venture, {
        mode,
        dealFlow:
          mode === "deal_flow_only"
            ? { target_amount: venture.raise_amount, currency: venture.currency }
            : null,
      }),
    );
  } catch (_) {}

  return {
    profile: {
      name: profile.full_name || profile.name || null,
      organization: profile.organization || null,
      visibility_mode: mode,
    },
    stats: {
      ...statsResult.rows[0],
      watchlist_count: parseInt(watchlistCount.rows[0]?.count || 0),
    },
    recommendations: recommendations.slice(0, 4),
  };
}

export async function buildInvestorDashboard({ session }) {
  const profileResult = await getInvestorDashboardProfile(session.cid || session.id);
  const profile = profileResult.rows[0];

  if (!profile) {
    return {
      profile: null,
      pipeline: [],
      watchlist: [],
      recommendations: [],
      campaigns: [],
      relationships: [],
      stats: {},
    };
  }

  const mode = profile.visibility_mode || "deal_flow_only";

  const pipelineResult = await listInvestorPipelineEntries(profile.id);
  const watchlistResult = await listInvestorWatchlist(profile.id);

  let recommendations = [];
  try {
    if (mode === "deal_flow_only") {
      const dealFlow = await listActiveDealFlowEntriesWithVenture();
      recommendations = scoreVentures({
        profile,
        mode,
        ventures: (dealFlow.rows || []).map((row) => ({
          ...row,
          raise_amount: row.target_amount,
        })),
      });
    } else {
      const allVentures = await listActiveVenturesForRecommendations();
      recommendations = scoreVentures({ profile, ventures: allVentures.rows, mode });
    }

    recommendations = recommendations.map((venture) =>
      investorVentureCard(venture, {
        mode,
        dealFlow:
          mode === "deal_flow_only"
            ? { target_amount: venture.raise_amount, currency: venture.currency }
            : null,
      }),
    );
  } catch (_) {}

  const statsResult = await getInvestorPipelineStats(profile.id);
  const watchlistCount = await countInvestorWatchlist(profile.id);

  let campaigns = [];
  try {
    campaigns = (await listActiveFundraisingCampaigns()).rows;
  } catch (_) {}

  let relationships = [];
  try {
    const relationshipsResult = await listActiveInvestorRelationshipWorkspaces(profile.id);
    for (const relationship of relationshipsResult.rows) {
      const meetings = await listUpcomingRelationshipMeetings(relationship.id);
      relationship.next_meetings = meetings.rows;
    }
    relationships = relationshipsResult.rows;
  } catch (_) {}

  return {
    profile: { ...profile, visibility_mode: mode },
    pipeline: pipelineResult.rows.map((row) => investorPipelineRow(row, { mode })),
    watchlist: watchlistResult.rows.map((row) => investorWatchlistRow(row, { mode })),
    recommendations,
    campaigns,
    relationships,
    stats: {
      ...statsResult.rows[0],
      watchlist_count: parseInt(watchlistCount.rows[0]?.count || 0),
    },
  };
}
