/**
 * Investor service — the personalized investor dashboard.
 *
 * Layer (see docs/LAYER_SPLIT.md): the DECISIONS live here — the recommendation
 * scoring (industry / country / stage / ticket-size / readiness weights) and its
 * ordering, plus the assembly of the pipeline, watchlist, campaigns and
 * relationship blocks. Every statement lives in `@/models/investor`. No SQL, no
 * HTTP.
 */

import {
  countInvestorWatchlist,
  getInvestorDashboardProfile,
  getInvestorPipelineStats,
  listActiveFundraisingCampaigns,
  listActiveInvestorRelationshipWorkspaces,
  listActiveVenturesForRecommendations,
  listInvestorPipelineEntries,
  listInvestorWatchlist,
  listUpcomingRelationshipMeetings,
} from "@/models/investor";

/**
 * Score each active venture against the investor's preferences and return them
 * in display order. With preferences, only the matching ventures are kept,
 * best score first; without preferences, everything is kept, most complete
 * first.
 */
export function scoreVentures({ profile, ventures }) {
  const industries = profile.industries || [];
  const countries = profile.countries || [];
  const stages = profile.startup_stages || [];
  const ticketMin = profile.ticket_size_min;
  const ticketMax = profile.ticket_size_max;

  let recommendations = ventures.map((venture) => {
    let score = 0;
    const reasons = [];

    // Industry match (weight: 30)
    if (industries.length > 0) {
      const match = industries.some((industry) =>
        (venture.industry || "").toLowerCase().includes(industry.toLowerCase()),
      );
      if (match) {
        score += 30;
        reasons.push(`Industry: ${venture.industry}`);
      }
    }

    // Country match (weight: 25)
    if (countries.length > 0) {
      const match = countries.some(
        (country) => (venture.country || "").toUpperCase() === country.toUpperCase(),
      );
      if (match) {
        score += 25;
        reasons.push(`Country: ${venture.country}`);
      }
    }

    // Stage match (weight: 20). Stages are a fixed vocabulary (Pre-Seed, Seed,
    // Series A/B, Growth), so they are compared exactly: a substring test would
    // let a "Seed" preference match a "Pre-Seed" venture.
    if (stages.length > 0) {
      const ventureStage = (venture.business_stage || "").trim().toLowerCase();
      const match =
        ventureStage !== "" &&
        stages.some((stage) => stage.trim().toLowerCase() === ventureStage);
      if (match) {
        score += 20;
        reasons.push(`Stage: ${venture.business_stage}`);
      }
    }

    // Ticket size match (weight: 15)
    if (ticketMin || ticketMax) {
      const funding = parseFloat(venture.funding_requirement) || 0;
      if ((!ticketMin || funding >= ticketMin) && (!ticketMax || funding <= ticketMax)) {
        score += 15;
        reasons.push(
          funding > 0 ? `Funding: $${funding.toLocaleString()}` : "Funding: matches range",
        );
      }
    }

    // Completion bonus (weight: 10)
    const completion = parseFloat(venture.completion_index) || 0;
    if (completion >= 80) {
      score += 10;
      reasons.push(`Readiness: ${completion}%`);
    } else if (completion >= 50) {
      score += 5;
      reasons.push(`Progress: ${completion}%`);
    }

    return { ...venture, match_score: score, match_reasons: reasons };
  });

  if (industries.length > 0 || countries.length > 0 || stages.length > 0) {
    recommendations = recommendations
      .filter((recommendation) => recommendation.match_score > 0)
      .sort((first, second) => second.match_score - first.match_score);
  } else {
    recommendations = recommendations.sort(
      (first, second) =>
        parseFloat(second.completion_index || 0) - parseFloat(first.completion_index || 0),
    );
  }

  return recommendations;
}

/**
 * Assemble the caller's dashboard: profile, pipeline, watchlist, scored
 * recommendations, active campaigns, relationship workspaces (each with its
 * upcoming meetings) and stats. A caller with no investor profile gets the
 * empty payload. The recommendation, campaign and relationship blocks are
 * each best-effort: a failure there never fails the whole dashboard.
 */
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

  const pipelineResult = await listInvestorPipelineEntries(profile.id);
  const watchlistResult = await listInvestorWatchlist(profile.id);

  let recommendations = [];
  try {
    const allVenturesResult = await listActiveVenturesForRecommendations();
    recommendations = scoreVentures({ profile, ventures: allVenturesResult.rows });
  } catch (_) {}

  const statsResult = await getInvestorPipelineStats(profile.id);
  const watchlistCount = await countInvestorWatchlist(profile.id);

  let campaigns = [];
  try {
    const campaignsResult = await listActiveFundraisingCampaigns();
    campaigns = campaignsResult.rows;
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
    profile,
    pipeline: pipelineResult.rows,
    watchlist: watchlistResult.rows,
    recommendations,
    campaigns,
    relationships,
    stats: {
      ...statsResult.rows[0],
      watchlist_count: parseInt(watchlistCount.rows[0]?.count || 0),
    },
  };
}
