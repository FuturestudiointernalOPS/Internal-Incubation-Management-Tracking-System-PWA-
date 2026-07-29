import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";

/** GET /api/investor/dashboard — investor's personalized dashboard data */
export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "staff", "investor"]);
    if (authError) return authError;

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

    // 3. Watchlist
    const watchlistRes = await db.execute({
      sql: `SELECT iw.*, p.name as venture_name, p.status as venture_status
            FROM investor_watchlist iw
            LEFT JOIN v2_programs p ON iw.venture_id = p.id
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

    return NextResponse.json({
      success: true,
      profile,
      pipeline: pipelineRes.rows,
      watchlist: watchlistRes.rows,
      recommendations,
      stats: { ...statsRes.rows[0], watchlist_count: parseInt(watchlistCount.rows[0]?.count || 0) },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
