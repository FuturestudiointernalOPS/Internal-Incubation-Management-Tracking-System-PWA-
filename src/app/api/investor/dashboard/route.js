import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";

/** GET /api/investor/dashboard — investor's personalized dashboard data */
export async function GET(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("investor", "view");
    if (capError) return capError;

    const session = await getSession();
    const user = session;

    // 1. Get investor profile
    const profileRes = await db.execute({
      sql: `SELECT ip.*, ipr.industries, ipr.countries, ipr.startup_stages
            FROM investor_profiles ip
            LEFT JOIN investor_preferences ipr ON ipr.investor_id = ip.id
            WHERE ip.user_id = ?`,
      args: [user.cid || user.id],
    });

    const profile = profileRes.rows[0];
    if (!profile) {
      return NextResponse.json({ success: true, profile: null, pipeline: [], watchlist: [], recommendations: [], stats: {} });
    }

    // 2. Investment pipeline
    const pipelineRes = await db.execute({
      sql: `SELECT ip.*, p.name as venture_name, p.status as venture_status
            FROM investment_pipeline ip
            LEFT JOIN v2_programs p ON ip.venture_id = p.id
            WHERE ip.investor_id = ?
            ORDER BY ip.stage_changed_at DESC`,
      args: [profile.id],
    });

    // 3. Watchlist — enriched with venture details, campaign, KPIs
    const watchlistRes = await db.execute({
      sql: `SELECT iw.*, p.name as venture_name, p.status as venture_status,
                    p.industry, p.country, p.business_stage, p.completion_index,
                    p.funding_requirement, p.description,
                    fc.id as campaign_id, fc.name as campaign_name, fc.status as campaign_status,
                    fc.target_raise, fc.current_raised, fc.min_investment,
                    fc.opening_date, fc.closing_date,
                    (SELECT COUNT(*) FROM investment_pipeline WHERE venture_id = iw.venture_id AND stage NOT IN ('declined'))::int as investor_count
             FROM investor_watchlist iw
             LEFT JOIN v2_programs p ON iw.venture_id = p.id
             LEFT JOIN fundraising_campaigns fc ON fc.venture_id = iw.venture_id AND fc.status = 'active'
             WHERE iw.investor_id = ?
             ORDER BY iw.created_at DESC`,
      args: [profile.id],
    });

    // 4. Intelligent Recommendations with match scoring
    let recommendations = [];
    try {
      const industries = profile.industries || [];
      const countries = profile.countries || [];
      const stages = profile.startup_stages || [];
      const ticketMin = profile.ticket_size_min;
      const ticketMax = profile.ticket_size_max;

      // Fetch all active ventures
      const allRes = await db.execute({
        sql: `SELECT p.id, p.name, p.description, p.status, p.industry,
                     p.country, p.completion_index, p.business_stage,
                     p.funding_requirement, p.created_at,
                     (SELECT COUNT(*) FROM investment_pipeline WHERE venture_id = p.id) as investor_interest_count
              FROM v2_programs p
              WHERE p.status = 'active' AND p.is_archived = 0
              ORDER BY p.created_at DESC LIMIT 50`,
        args: [],
      });

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
    const statsRes = await db.execute({
      sql: `SELECT
              COUNT(*) FILTER (WHERE stage = 'invested') as invested_count,
              COUNT(*) FILTER (WHERE stage IN ('due_diligence','negotiation')) as active_evaluations,
              COUNT(*) as total_pipeline
            FROM investment_pipeline WHERE investor_id = ?`,
      args: [profile.id],
    });

    const watchlistCount = await db.execute({
      sql: "SELECT COUNT(*) as count FROM investor_watchlist WHERE investor_id = ?",
      args: [profile.id],
    });

    // 6. Active fundraising campaigns
    let campaigns = [];
    try {
      const campaignsRes = await db.execute({
        sql: `SELECT fc.*, p.name as venture_name, p.industry, p.country, p.business_stage,
                     p.funding_requirement, p.completion_index,
                     (SELECT COUNT(*) FROM investment_pipeline WHERE venture_id = fc.venture_id AND stage NOT IN ('declined'))::int as investor_count,
                     (SELECT COUNT(*) FROM investment_pipeline WHERE venture_id = fc.venture_id AND stage IN ('due_diligence','negotiation'))::int as active_dd_count
              FROM fundraising_campaigns fc
              LEFT JOIN v2_programs p ON fc.venture_id = p.id
              WHERE fc.status = 'active' AND (fc.visibility = 'public' OR fc.visibility = 'invite_only')
              ORDER BY fc.created_at DESC LIMIT 20`,
        args: [],
      });
      campaigns = campaignsRes.rows;
    } catch (_) {}

    // 7. Relationship workspaces & meetings
    let relationships = [];
    try {
      const relRes = await db.execute({
        sql: `SELECT rw.*, p.name as venture_name, p.industry,
                     rm.name as relationship_manager_name,
                     (SELECT COUNT(*) FROM relationship_meetings WHERE workspace_id = rw.id AND status = 'scheduled')::int as upcoming_meetings
              FROM relationship_workspaces rw
              LEFT JOIN v2_programs p ON rw.venture_id = p.id
              LEFT JOIN contacts rm ON rw.relationship_manager_id = rm.cid
              WHERE rw.investor_id = ? AND rw.status = 'active'
              ORDER BY rw.updated_at DESC`,
        args: [profile.id],
      });

      // Fetch upcoming meetings for each workspace
      for (const rel of relRes.rows) {
        const mtgs = await db.execute({
          sql: `SELECT id, meeting_type, scheduled_date, scheduled_time, status, location
                FROM relationship_meetings
                WHERE workspace_id = ? AND status = 'scheduled'
                ORDER BY scheduled_date ASC LIMIT 3`,
          args: [rel.id],
        });
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
