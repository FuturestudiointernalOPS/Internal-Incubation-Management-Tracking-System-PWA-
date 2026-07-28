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

    // 4. Recommendations — ventures matching investor preferences, or all if no prefs
    let recommendations = [];
    try {
      const hasPrefs = profile.industries?.length > 0 || profile.countries?.length > 0;
      let recSql = `SELECT p.id, p.name, p.description, p.status, p.industry,
                            p.country, p.created_at, p.completion_index,
                            (SELECT COUNT(*) FROM investment_pipeline WHERE venture_id = p.id) as investor_interest_count
                     FROM v2_programs p
                     WHERE p.status = 'active' AND p.is_archived = 0`;
      const recArgs = [];

      if (hasPrefs) {
        const industries = profile.industries || [];
        const countries = profile.countries || [];
        if (industries.length > 0) {
          recSql += ` AND (${industries.map(() => "p.industry ILIKE ?").join(" OR ")})`;
          industries.forEach(i => recArgs.push(`%${i}%`));
        }
        if (countries.length > 0) {
          recSql += ` AND (${countries.map(() => "p.country ILIKE ?").join(" OR ")})`;
          countries.forEach(c => recArgs.push(`%${c}%`));
        }
      }
      recSql += " ORDER BY p.created_at DESC LIMIT 20";

      const recRes = await db.execute({ sql: recSql, args: recArgs });
      recommendations = recRes.rows;
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
