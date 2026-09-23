import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

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
import { requireInvestorSelfServiceAuthorization } from "@/models/authorization/investorSelfService";

/** GET /api/investor/dashboard — investor's personalized dashboard data */
export async function GET(_req) {
  try {
    await initDb();
    const capError = await requireInvestorSelfServiceAuthorization("view");
    if (capError) return capError;

    const session = await getSession();
    const user = session;

    // 1. Get investor profile
    const profileResult = await getInvestorDashboardProfile(user.cid || user.id);

    const profile = profileResult.rows[0];
    if (!profile) {
      return NextResponse.json({ success: true, profile: null, pipeline: [], watchlist: [], recommendations: [], stats: {} });
    }

    // 2. Investment pipeline
    const pipelineResult = await listInvestorPipelineEntries(profile.id);

    // 3. Watchlist — enriched with venture details, campaign, KPIs
    const watchlistResult = await listInvestorWatchlist(profile.id);

    // 4. Intelligent Recommendations with match scoring
    let recommendations = [];
    try {
      const industries = profile.industries || [];
      const countries = profile.countries || [];
      const stages = profile.startup_stages || [];
      const ticketMin = profile.ticket_size_min;
      const ticketMax = profile.ticket_size_max;

      // Fetch all active ventures
      const allVenturesResult = await listActiveVenturesForRecommendations();

      // Score each venture
      recommendations = allVenturesResult.rows.map(venture => {
        let score = 0;
        const reasons = [];

        // Industry match (weight: 30)
        if (industries.length > 0) {
          const match = industries.some(industry =>
            (venture.industry || "").toLowerCase().includes(industry.toLowerCase())
          );
          if (match) { score += 30; reasons.push(`Industry: ${venture.industry}`); }
        }

        // Country match (weight: 25)
        if (countries.length > 0) {
          const match = countries.some(country =>
            (venture.country || "").toUpperCase() === country.toUpperCase()
          );
          if (match) { score += 25; reasons.push(`Country: ${venture.country}`); }
        }

        // Stage match (weight: 20)
        if (stages.length > 0) {
          const match = stages.some(stage =>
            (venture.business_stage || "").toLowerCase().includes(stage.toLowerCase())
          );
          if (match) { score += 20; reasons.push(`Stage: ${venture.business_stage}`); }
        }

        // Ticket size match (weight: 15)
        if (ticketMin || ticketMax) {
          const funding = parseFloat(venture.funding_requirement) || 0;
          if ((!ticketMin || funding >= ticketMin) && (!ticketMax || funding <= ticketMax)) {
            score += 15;
            reasons.push(funding > 0 ? `Funding: $${funding.toLocaleString()}` : "Funding: matches range");
          }
        }

        // Completion bonus (weight: 10)
        const completion = parseFloat(venture.completion_index) || 0;
        if (completion >= 80) { score += 10; reasons.push(`Readiness: ${completion}%`); }
        else if (completion >= 50) { score += 5; reasons.push(`Progress: ${completion}%`); }

        return { ...venture, match_score: score, match_reasons: reasons };
      });

      // Sort by score descending, only include if has preferences or score > 0
      if (industries.length > 0 || countries.length > 0 || stages.length > 0) {
        recommendations = recommendations
          .filter(recommendation => recommendation.match_score > 0)
          .sort((first, second) => second.match_score - first.match_score);
      } else {
        // No preferences: show all but sorted by completion
        recommendations = recommendations.sort((first, second) => parseFloat(second.completion_index || 0) - parseFloat(first.completion_index || 0));
      }
    } catch (_) {}

    // 5. Stats
    const statsResult = await getInvestorPipelineStats(profile.id);

    const watchlistCount = await countInvestorWatchlist(profile.id);

    // 6. Active fundraising campaigns
    let campaigns = [];
    try {
      const campaignsResult = await listActiveFundraisingCampaigns();
      campaigns = campaignsResult.rows;
    } catch (_) {}

    // 7. Relationship workspaces & meetings
    let relationships = [];
    try {
      const relationshipsResult = await listActiveInvestorRelationshipWorkspaces(profile.id);

      // Fetch upcoming meetings for each workspace
      for (const relationship of relationshipsResult.rows) {
        const meetings = await listUpcomingRelationshipMeetings(relationship.id);
        relationship.next_meetings = meetings.rows;
      }
      relationships = relationshipsResult.rows;
    } catch (_) {}

    return NextResponse.json({
      success: true,
      profile,
      pipeline: pipelineResult.rows,
      watchlist: watchlistResult.rows,
      recommendations,
      campaigns,
      relationships,
      stats: { ...statsResult.rows[0], watchlist_count: parseInt(watchlistCount.rows[0]?.count || 0) },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
