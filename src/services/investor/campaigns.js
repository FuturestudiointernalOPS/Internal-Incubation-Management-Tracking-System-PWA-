/**
 * Investor service — fundraising campaigns.
 *
 * Layer (see docs/LAYER_SPLIT.md): the DECISIONS live here — the own-scope
 * resolution of the list, the input normalisation, the investor/venture
 * preference match, the funding-milestone crossing, and the publish /
 * milestone notifications. Every statement lives in
 * `@/models/investorRelations` and `@/models/investor`. No SQL, no HTTP.
 */

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

// The internal roles that see every campaign.
const MANAGEMENT_ROLES = ["super_admin", "staff", "program_manager"];

/**
 * Whether an approved investor's preferences match a venture. An investor who
 * set NO preference is notified for every campaign (the documented fallback).
 */
export function investorMatchesCampaignVenture(investor, venture) {
  const industries = investor.industries || [];
  const countries = investor.countries || [];
  const stages = investor.startup_stages || [];

  let matches = false;
  if (industries.length > 0) {
    matches =
      matches ||
      industries.some((industry) =>
        (venture.industry || "").toLowerCase().includes(industry.toLowerCase()),
      );
  }
  if (countries.length > 0) {
    matches =
      matches ||
      countries.some(
        (country) => (venture.country || "").toUpperCase() === country.toUpperCase(),
      );
  }
  if (stages.length > 0) {
    matches =
      matches ||
      stages.some((stage) =>
        (venture.business_stage || "").toLowerCase().includes(stage.toLowerCase()),
      );
  }

  return matches || (industries.length === 0 && countries.length === 0 && stages.length === 0);
}

/**
 * The funding milestone (25 / 50 / 75 / 100) a raise crossed between the old and
 * the new figures, or 0 when none was crossed.
 */
export function detectFundingMilestone({
  oldRaised,
  oldTarget,
  newRaised,
  newTarget,
  milestones = [25, 50, 75, 100],
}) {
  for (const milestone of milestones) {
    const oldPct = (oldRaised / oldTarget) * 100;
    const newPct = (newRaised / newTarget) * 100;
    if (oldPct < milestone && newPct >= milestone) return milestone;
  }
  return 0;
}

/** The campaign fields as the repository expects them (parsed, defaulted). */
export function normalizeCampaignInput(body) {
  const {
    venture_id,
    name,
    target_raise,
    min_investment,
    max_investment,
    currency,
    visibility,
    opening_date,
    closing_date,
  } = body;

  return {
    venture_id,
    name,
    target_raise: target_raise ? parseFloat(target_raise) : null,
    min_investment: min_investment ? parseFloat(min_investment) : null,
    max_investment: max_investment ? parseFloat(max_investment) : null,
    currency: currency || "USD",
    visibility: visibility || "public",
    opening_date: opening_date || null,
    closing_date: closing_date || null,
  };
}

/**
 * The campaigns a caller may list. Management sees everything; every other
 * session is scoped to the ventures it is engaged with in the pipeline, and a
 * caller with no investor profile sees an empty list.
 */
export async function listCampaignsForViewer({ ventureId, status, session }) {
  const management = MANAGEMENT_ROLES.includes(session?.role);
  let investorId = null;

  if (!management) {
    const profileResult = await getInvestorProfileIdByUserIdForPipelineList(
      session.cid || session.id,
    );
    if (profileResult.rows.length === 0) return { ok: true, campaigns: [] };
    investorId = profileResult.rows[0].id;
  }

  const result = await listFundraisingCampaigns({ ventureId, status, investorId });
  return { ok: true, campaigns: result.rows };
}

/** Create a campaign (super admin only — the gate stays in the controller). */
export async function createCampaign(body) {
  const input = normalizeCampaignInput(body);
  if (!input.venture_id || !input.name) {
    return { ok: false, status: 400, error: "venture_id and name are required" };
  }

  const result = await insertFundraisingCampaign(
    input.venture_id,
    input.name,
    input.target_raise,
    input.min_investment,
    input.max_investment,
    input.currency,
    input.visibility,
    input.opening_date,
    input.closing_date,
  );
  return { ok: true, campaign: result.rows[0] };
}

/**
 * Update a campaign, then run the two notification passes: the "campaign went
 * active" investor match, and the funding-milestone watchers. Both are
 * best-effort — a notification failure never blocks the update.
 */
export async function updateCampaignAndNotify(body) {
  const { id, status, current_raised, target_raise, min_investment, max_investment, name, visibility } =
    body;
  if (!id) return { ok: false, status: 400, error: "campaign id required" };

  let oldRaised = 0;
  let oldTarget = 0;

  // If updating current_raised, fetch the old value first for milestone detection.
  if (current_raised !== undefined) {
    try {
      const fundingSnapshot = await getCampaignFundingSnapshot(id);
      if (fundingSnapshot.rows.length > 0) {
        oldRaised = parseFloat(fundingSnapshot.rows[0].current_raised || 0);
        oldTarget = parseFloat(fundingSnapshot.rows[0].target_raise || 0);
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

  if (result.updated === false) return { ok: false, status: 400, error: "Nothing to update" };
  if (result.rows.length === 0) return { ok: false, status: 404, error: "Campaign not found" };

  const campaign = result.rows[0];

  // Campaign went active → notify the investors whose preferences match.
  if (status === "active") {
    try {
      const ventureInfo = await getCampaignVentureProfile(campaign.venture_id);
      const venture = ventureInfo.rows[0];
      if (!venture) throw new Error("Venture not found");

      const investors = await listApprovedInvestorsWithPreferences();
      for (const investor of investors.rows) {
        if (investorMatchesCampaignVenture(investor, venture)) {
          await notifyInvestorOfNewCampaign(
            investor.user_id,
            `New Investment Opportunity: ${venture.name}`,
            `${venture.name} (${venture.industry || "Unknown"}, ${venture.country || "N/A"}) has opened a fundraising campaign: ${campaign.name}. Target: $${Number(campaign.target_raise || 0).toLocaleString()}.`,
          );
        }
      }
    } catch (error) {
      console.error("Campaign publish notify error:", error.message);
    }
  }

  // Funding milestones → notify the investors watching the venture.
  if (current_raised !== undefined && oldTarget > 0) {
    try {
      const newRaised = parseFloat(campaign.current_raised || 0);
      const newTarget = parseFloat(campaign.target_raise || oldTarget);
      const milestoneHit = detectFundingMilestone({
        oldRaised,
        oldTarget,
        newRaised,
        newTarget,
      });

      if (milestoneHit > 0) {
        const ventureInfo = await getVentureNameForMilestoneAlert(campaign.venture_id);
        const ventureName = ventureInfo.rows[0]?.name || "Venture";

        const watchers = await listInvestorsWatchingVenture(campaign.venture_id);
        for (const watcher of watchers.rows) {
          await notifyInvestorOfFundingMilestone(
            watcher.user_id,
            `Funding Milestone: ${milestoneHit}% \u2014 ${ventureName}`,
            `${ventureName}'s fundraising campaign has reached ${milestoneHit}% of its $${newTarget.toLocaleString()} target ($${newRaised.toLocaleString()} raised).`,
          );
        }
      }
    } catch (error) {
      console.error("Milestone notify error:", error.message);
    }
  }

  return { ok: true, campaign };
}
