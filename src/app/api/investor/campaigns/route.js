import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";

/**
 * GET /api/investor/campaigns
 * List fundraising campaigns. Optional query params: venture_id, status.
 */
export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "staff", "investor", "program_manager"]);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const ventureId = searchParams.get("venture_id");
    const status = searchParams.get("status");

    let sql = `SELECT fc.*, p.name as venture_name, p.industry, p.country, p.business_stage,
                      p.funding_requirement, p.completion_index,
                      (SELECT COUNT(*) FROM investment_pipeline WHERE venture_id = fc.venture_id AND stage NOT IN ('declined')) as investor_count,
                      (SELECT COUNT(*) FROM investment_pipeline WHERE venture_id = fc.venture_id AND stage IN ('due_diligence','negotiation')) as active_dd_count
               FROM fundraising_campaigns fc
               LEFT JOIN v2_programs p ON fc.venture_id = p.id
               WHERE 1=1`;
    const args = [];

    if (ventureId) {
      sql += " AND fc.venture_id = ?";
      args.push(ventureId);
    }
    if (status) {
      sql += " AND fc.status = ?";
      args.push(status);
    }

    sql += " ORDER BY fc.created_at DESC";

    const result = await db.execute({ sql, args });
    return NextResponse.json({ success: true, campaigns: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/investor/campaigns
 * Create a new fundraising campaign. Super admin only.
 */
export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const body = await req.json();
    const { venture_id, name, target_raise, min_investment, max_investment, currency, visibility, opening_date, closing_date } = body;

    if (!venture_id || !name) {
      return NextResponse.json({ success: false, error: "venture_id and name are required" }, { status: 400 });
    }

    const result = await db.execute({
      sql: `INSERT INTO fundraising_campaigns (venture_id, name, target_raise, min_investment, max_investment, currency, visibility, opening_date, closing_date, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
            RETURNING *`,
      args: [
        venture_id,
        name,
        target_raise ? parseFloat(target_raise) : null,
        min_investment ? parseFloat(min_investment) : null,
        max_investment ? parseFloat(max_investment) : null,
        currency || "USD",
        visibility || "public",
        opening_date || null,
        closing_date || null,
      ],
    });

    return NextResponse.json({ success: true, campaign: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * PUT /api/investor/campaigns
 * Update campaign status or details. Super admin only.
 */
export async function PUT(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const body = await req.json();
    const { id, status, current_raised, target_raise, min_investment, max_investment, name, visibility } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "campaign id required" }, { status: 400 });
    }

    // Build dynamic update
    const sets = [];
    const args = [];

    if (status) { sets.push("status = ?"); args.push(status); }
    if (current_raised !== undefined) { sets.push("current_raised = ?"); args.push(parseFloat(current_raised)); }
    if (target_raise !== undefined) { sets.push("target_raise = ?"); args.push(parseFloat(target_raise)); }
    if (min_investment !== undefined) { sets.push("min_investment = ?"); args.push(parseFloat(min_investment)); }
    if (max_investment !== undefined) { sets.push("max_investment = ?"); args.push(parseFloat(max_investment)); }
    if (name) { sets.push("name = ?"); args.push(name); }
    if (visibility) { sets.push("visibility = ?"); args.push(visibility); }

    if (sets.length === 0) {
      return NextResponse.json({ success: false, error: "Nothing to update" }, { status: 400 });
    }

    let oldRaised = 0;
    let oldTarget = 0;

    // If updating current_raised, fetch old value first for milestone detection
    if (current_raised !== undefined) {
      try {
        const old = await db.execute({
          sql: "SELECT current_raised, target_raise, venture_id FROM fundraising_campaigns WHERE id = ?",
          args: [id],
        });
        if (old.rows.length > 0) {
          oldRaised = parseFloat(old.rows[0].current_raised || 0);
          oldTarget = parseFloat(old.rows[0].target_raise || 0);
        }
      } catch (_) {}
    }

    sets.push("updated_at = NOW()");
    args.push(id);

    const result = await db.execute({
      sql: `UPDATE fundraising_campaigns SET ${sets.join(", ")} WHERE id = ? RETURNING *`,
      args,
    });

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Campaign not found" }, { status: 404 });
    }

    const campaign = result.rows[0];

    // If campaign status changed to "active", notify matching investors
    if (status === "active") {
      try {
        // Get venture info
        const ventureInfo = await db.execute({
          sql: "SELECT name, industry, country, business_stage FROM v2_programs WHERE id = ?",
          args: [campaign.venture_id],
        });
        const venture = ventureInfo.rows[0];
        if (!venture) throw new Error("Venture not found");

        // Find investors whose preferences match this venture
        const investors = await db.execute({
          sql: `SELECT DISTINCT ip.user_id, ip.id as profile_id, ipr.industries, ipr.countries, ipr.startup_stages
                FROM investor_profiles ip
                LEFT JOIN investor_preferences ipr ON ipr.investor_id = ip.id
                WHERE ip.approval_status = 'approved'`,
          args: [],
        });

        for (const inv of investors.rows) {
          let matches = false;
          const inds = inv.industries || [];
          const cntrs = inv.countries || [];
          const stages = inv.startup_stages || [];

          if (inds.length > 0) {
            matches = matches || inds.some(ind => (venture.industry || "").toLowerCase().includes(ind.toLowerCase()));
          }
          if (cntrs.length > 0) {
            matches = matches || cntrs.some(c => (venture.country || "").toUpperCase() === c.toUpperCase());
          }
          if (stages.length > 0) {
            matches = matches || stages.some(s => (venture.business_stage || "").toLowerCase().includes(s.toLowerCase()));
          }

          // Also notify all investors if preferences not set (fallback: notify all approved)
          if (matches || (inds.length === 0 && cntrs.length === 0 && stages.length === 0)) {
            await db.execute({
              sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at, link)
                    VALUES (?, ?, ?, 'investor', 0, NOW(), ?)`,
              args: [
                inv.user_id,
                `New Investment Opportunity: ${venture.name}`,
                `${venture.name} (${venture.industry || "Unknown"}, ${venture.country || "N/A"}) has opened a fundraising campaign: ${campaign.name}. Target: $${Number(campaign.target_raise || 0).toLocaleString()}.`,
                "/investor/dashboard?tab=discover",
              ],
            });
          }
        }
      } catch (e) { console.error("Campaign publish notify error:", e.message); }
    }

    // Smart alerts: notify watching investors when funding milestones are crossed
    if (current_raised !== undefined && oldTarget > 0) {
      try {
        const newRaised = parseFloat(campaign.current_raised || 0);
        const newTarget = parseFloat(campaign.target_raise || oldTarget);
        const milestones = [25, 50, 75, 100];
        let milestoneHit = 0;

        for (const m of milestones) {
          const oldPct = (oldRaised / oldTarget) * 100;
          const newPct = (newRaised / newTarget) * 100;
          if (oldPct < m && newPct >= m) {
            milestoneHit = m;
            break;
          }
        }

        if (milestoneHit > 0) {
          const ventureInfo = await db.execute({
            sql: "SELECT name FROM v2_programs WHERE id = ?",
            args: [campaign.venture_id],
          });
          const ventureName = ventureInfo.rows[0]?.name || "Venture";

          // Notify all investors watching this venture
          const watchers = await db.execute({
            sql: `SELECT DISTINCT ip.user_id FROM investor_watchlist iw
                  JOIN investor_profiles ip ON iw.investor_id = ip.id
                  WHERE iw.venture_id = ? AND ip.approval_status = 'approved'`,
            args: [campaign.venture_id],
          });

          for (const w of watchers.rows) {
            await db.execute({
              sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at, link)
                    VALUES (?, ?, ?, 'investor', 0, NOW(), ?)`,
              args: [
                w.user_id,
                `Funding Milestone: ${milestoneHit}% \u2014 ${ventureName}`,
                `${ventureName}'s fundraising campaign has reached ${milestoneHit}% of its $${newTarget.toLocaleString()} target ($${newRaised.toLocaleString()} raised).`,
                "/investor/dashboard?tab=watchlist",
              ],
            });
          }
        }
      } catch (e) { console.error("Milestone notify error:", e.message); }
    }

    return NextResponse.json({ success: true, campaign });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
