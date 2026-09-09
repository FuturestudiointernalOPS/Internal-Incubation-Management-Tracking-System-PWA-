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
export async function GET(req) {
  try {
    await initDb();
    const capError = await requireInvestorSelfServiceAuthorization("view");
    if (capError) return capError;

    const session = await getSession();
    const user = session;

    // 1. Get investor profile
    const profileRes = await getInvestorDashboardProfile(user.cid || user.id);

    const profile = profileRes.rows[0];
    if (!profile) {
      return NextResponse.json({ success: true, profile: null, pipeline: [], watchlist: [], recommendations: [], stats: {} });
    }

    // 2. Investment pipeline
    const pipelineRes = await listInvestorPipelineEntries(profile.id);

    // 3. Watchlist — enriched with venture details, campaign, KPIs
    const watchlistRes = await listInvestorWatchlist(profile.id);

    // 4. Intelligent Recommendations with match scoring
    let recommendations = [];
    try {
      const industries = profile.industries || [];
      const countries = profile.countries || [];
      const stages = profile.startup_stages || [];
      const ticketMin = profile.ticket_size_min;
      const ticketMax = profile.ticket_size_max;

      // Fetch all active ventures
      const allRes = await listActiveVenturesForRecommendations();

      // Score each venture
      recommendations = allRes.rows.map(v => {
        let score = 0;
        const reasons = [];

        // Industry match (weight: 30)
        if (industries.length > 0) {
          const match = industries.some(ind =>
            (v.industry || "").toLowerCase().includes(ind.toLowerCase())
          );
          if (match) { score += 30; reasons.push(`Industry: ${v.industry}`); }
        }

        // Country match (weight: 25)
        if (countries.length > 0) {
          const match = countries.some(c =>
            (v.country || "").toUpperCase() === c.toUpperCase()
          );
          if (match) { score += 25; reasons.push(`Country: ${v.country}`); }
        }

        // Stage match (weight: 20)
        if (stages.length > 0) {
          const match = stages.some(s =>
            (v.business_stage || "").toLowerCase().includes(s.toLowerCase())
          );
          if (match) { score += 20; reasons.push(`Stage: ${v.business_stage}`); }
        }

        // Ticket size match (weight: 15)
        if (ticketMin || ticketMax) {
          const funding = parseFloat(v.funding_requirement) || 0;
          if ((!ticketMin || funding >= ticketMin) && (!ticketMax || funding <= ticketMax)) {
            score += 15;
            reasons.push(funding > 0 ? `Funding: $${funding.toLocaleString()}` : "Funding: matches range");
          }
        }

        // Completion bonus (weight: 10)
        const completion = parseFloat(v.completion_index) || 0;
        if (completion >= 80) { score += 10; reasons.push(`Readiness: ${completion}%`); }
        else if (completion >= 50) { score += 5; reasons.push(`Progress: ${completion}%`); }

        return { ...v, match_score: score, match_reasons: reasons };
      });

      // Sort by score descending, only include if has preferences or score > 0
      if (industries.length > 0 || countries.length > 0 || stages.length > 0) {
        recommendations = recommendations
          .filter(r => r.match_score > 0)
          .sort((a, b) => b.match_score - a.match_score);
      } else {
        // No preferences: show all but sorted by completion
        recommendations = recommendations.sort((a, b) => parseFloat(b.completion_index || 0) - parseFloat(a.completion_index || 0));
      }
    } catch (_) {}

    // 5. Stats
    const statsRes = await getInvestorPipelineStats(profile.id);

    const watchlistCount = await countInvestorWatchlist(profile.id);

    // 6. Active fundraising campaigns
    let campaigns = [];
    try {
      const campaignsRes = await listActiveFundraisingCampaigns();
      campaigns = campaignsRes.rows;
    } catch (_) {}

    // 7. Relationship workspaces & meetings
    let relationships = [];
    try {
      const relRes = await listActiveInvestorRelationshipWorkspaces(profile.id);

      // Fetch upcoming meetings for each workspace
      for (const rel of relRes.rows) {
        const mtgs = await listUpcomingRelationshipMeetings(rel.id);
        rel.next_meetings = mtgs.rows;
      }
      relationships = relRes.rows;
    } catch (_) {}

    return NextResponse.json({
      success: true,
      profile,
      pipeline: pipelineRes.rows,
      watchlist: watchlistRes.rows,
      recommendations,
      campaigns,
      relationships,
      stats: { ...statsRes.rows[0], watchlist_count: parseInt(watchlistCount.rows[0]?.count || 0) },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
