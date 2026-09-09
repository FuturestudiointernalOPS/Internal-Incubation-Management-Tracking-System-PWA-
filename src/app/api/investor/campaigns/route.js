import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import {
  getCampaignFundingSnapshot,
  getCampaignVentureProfile,
  getVentureNameForMilestoneAlert,
  insertFundraisingCampaign,
  listApprovedInvestorsWithPreferences,
  listFundraisingCampaigns,
  listInvestorsWatchingVenture,
  notifyInvestorOfFundingMilestone,
  notifyInvestorOfNewCampaign,
  updateFundraisingCampaign,
} from "@/models/investorRelations";
import { getInvestorProfileIdByUserIdForPipelineList } from "@/models/investor";

/**
 * GET /api/investor/campaigns
 * List fundraising campaigns. Optional query params: venture_id, status.
 */
export async function GET(req) {
  try {
    await initDb();
    // Phase 1.5: authentication only — scoping is derived below.
    const authError = await requireAuth();
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const ventureId = searchParams.get("venture_id");
    const status = searchParams.get("status");

    const session = await getSession();
    const user = session;
    const management = ["super_admin", "staff", "program_manager"].includes(user?.role);

    // Phase 1.5: management sees all campaigns (as before); every other
    // session — legacy investor role or a member with an investor context —
    // is scoped to campaigns for ventures it is engaged with in the pipeline.
    let investorId = null;
    if (!management) {
      const profile = await getInvestorProfileIdByUserIdForPipelineList(user.cid || user.id);
      if (profile.rows.length === 0) {
        return NextResponse.json({ success: true, campaigns: [] });
      }
      investorId = profile.rows[0].id;
    }

    const result = await listFundraisingCampaigns({ ventureId, status, investorId });
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

    const result = await insertFundraisingCampaign(
      venture_id,
      name,
      target_raise ? parseFloat(target_raise) : null,
      min_investment ? parseFloat(min_investment) : null,
      max_investment ? parseFloat(max_investment) : null,
      currency || "USD",
      visibility || "public",
      opening_date || null,
      closing_date || null,
    );

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

    let oldRaised = 0;
    let oldTarget = 0;

    // If updating current_raised, fetch old value first for milestone detection
    if (current_raised !== undefined) {
      try {
        const old = await getCampaignFundingSnapshot(id);
        if (old.rows.length > 0) {
          oldRaised = parseFloat(old.rows[0].current_raised || 0);
          oldTarget = parseFloat(old.rows[0].target_raise || 0);
        }
      } catch (_) {}
    }

    const result = await updateFundraisingCampaign(id, {
      status,
      current_raised,
      target_raise,
      min_investment,
      max_investment,
      name,
      visibility,
    });

    if (result.updated === false) {
      return NextResponse.json({ success: false, error: "Nothing to update" }, { status: 400 });
    }

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Campaign not found" }, { status: 404 });
    }

    const campaign = result.rows[0];

    // If campaign status changed to "active", notify matching investors
    if (status === "active") {
      try {
        // Get venture info
        const ventureInfo = await getCampaignVentureProfile(campaign.venture_id);
        const venture = ventureInfo.rows[0];
        if (!venture) throw new Error("Venture not found");

        // Find investors whose preferences match this venture
        const investors = await listApprovedInvestorsWithPreferences();

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
            await notifyInvestorOfNewCampaign(
              inv.user_id,
              `New Investment Opportunity: ${venture.name}`,
              `${venture.name} (${venture.industry || "Unknown"}, ${venture.country || "N/A"}) has opened a fundraising campaign: ${campaign.name}. Target: $${Number(campaign.target_raise || 0).toLocaleString()}.`,
            );
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
          const ventureInfo = await getVentureNameForMilestoneAlert(campaign.venture_id);
          const ventureName = ventureInfo.rows[0]?.name || "Venture";

          // Notify all investors watching this venture
          const watchers = await listInvestorsWatchingVenture(campaign.venture_id);

          for (const w of watchers.rows) {
            await notifyInvestorOfFundingMilestone(
              w.user_id,
              `Funding Milestone: ${milestoneHit}% \u2014 ${ventureName}`,
              `${ventureName}'s fundraising campaign has reached ${milestoneHit}% of its $${newTarget.toLocaleString()} target ($${newRaised.toLocaleString()} raised).`,
            );
          }
        }
      } catch (e) { console.error("Milestone notify error:", e.message); }
    }

    return NextResponse.json({ success: true, campaign });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
