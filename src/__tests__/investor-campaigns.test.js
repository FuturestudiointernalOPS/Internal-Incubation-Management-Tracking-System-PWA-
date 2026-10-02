/**
 * Investor campaigns — the DECISIONS.
 *
 * These used to sit inline in `src/app/api/investor/campaigns/route.js`. They
 * now live in `src/services/investor/campaigns.js`. This suite pins the
 * observable behaviour: the list scope, the input normalisation, the
 * investor/venture match, and the funding-milestone crossing.
 */

jest.mock("@/models/investorRelations", () => ({
  getCampaignFundingSnapshot: jest.fn(),
  getCampaignVentureProfile: jest.fn(),
  getVentureNameForMilestoneAlert: jest.fn(),
  insertFundraisingCampaign: jest.fn(),
  listApprovedInvestorsWithPreferences: jest.fn(),
  listFundraisingCampaigns: jest.fn(),
  listInvestorsWatchingVenture: jest.fn(),
  notifyInvestorOfFundingMilestone: jest.fn(),
  notifyInvestorOfNewCampaign: jest.fn(),
  updateFundraisingCampaign: jest.fn(),
}));

jest.mock("@/models/investor", () => ({
  getInvestorProfileIdByUserIdForPipelineList: jest.fn(),
}));

const relations = require("@/models/investorRelations");
const investorModel = require("@/models/investor");
const {
  investorMatchesCampaignVenture,
  detectFundingMilestone,
  normalizeCampaignInput,
  listCampaignsForViewer,
  createCampaign,
  updateCampaignAndNotify,
} = require("@/services/investor/campaigns");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("investorMatchesCampaignVenture", () => {
  const venture = { industry: "Fintech", country: "FR", business_stage: "Seed" };

  it("matches on any shared preference", () => {
    expect(investorMatchesCampaignVenture({ industries: ["fintech"] }, venture)).toBe(true);
    expect(investorMatchesCampaignVenture({ countries: ["fr"] }, venture)).toBe(true);
    expect(investorMatchesCampaignVenture({ startup_stages: ["seed"] }, venture)).toBe(true);
    expect(investorMatchesCampaignVenture({ industries: ["health"] }, venture)).toBe(false);
  });

  it("notifies an investor who set no preference at all", () => {
    expect(investorMatchesCampaignVenture({}, venture)).toBe(true);
  });
});

describe("detectFundingMilestone", () => {
  it("reports the milestone a raise crossed", () => {
    expect(detectFundingMilestone({ oldRaised: 10, oldTarget: 100, newRaised: 30, newTarget: 100 })).toBe(25);
    expect(detectFundingMilestone({ oldRaised: 40, oldTarget: 100, newRaised: 80, newTarget: 100 })).toBe(50);
    expect(detectFundingMilestone({ oldRaised: 10, oldTarget: 100, newRaised: 120, newTarget: 100 })).toBe(25);
  });

  it("reports nothing when no milestone was crossed", () => {
    expect(detectFundingMilestone({ oldRaised: 30, oldTarget: 100, newRaised: 40, newTarget: 100 })).toBe(0);
  });
});

describe("normalizeCampaignInput", () => {
  it("parses the numbers and applies the currency / visibility defaults", () => {
    expect(normalizeCampaignInput({ venture_id: "v1", name: "Round", target_raise: "100000" })).toEqual({
      venture_id: "v1",
      name: "Round",
      target_raise: 100000,
      min_investment: null,
      max_investment: null,
      currency: "USD",
      visibility: "public",
      opening_date: null,
      closing_date: null,
    });
  });
});

describe("listCampaignsForViewer", () => {
  it("lets management see everything", async () => {
    relations.listFundraisingCampaigns.mockResolvedValue({ rows: [{ id: "c1" }] });

    const result = await listCampaignsForViewer({ session: { role: "staff", cid: "u1" } });
    expect(result.campaigns).toEqual([{ id: "c1" }]);
    expect(investorModel.getInvestorProfileIdByUserIdForPipelineList).not.toHaveBeenCalled();
  });

  it("returns nothing for a non-management caller with no investor profile", async () => {
    investorModel.getInvestorProfileIdByUserIdForPipelineList.mockResolvedValue({ rows: [] });

    const result = await listCampaignsForViewer({ session: { role: "participant", cid: "u1" } });
    expect(result).toEqual({ ok: true, campaigns: [] });
    expect(relations.listFundraisingCampaigns).not.toHaveBeenCalled();
  });

  it("scopes a non-management caller to their investor profile", async () => {
    investorModel.getInvestorProfileIdByUserIdForPipelineList.mockResolvedValue({ rows: [{ id: "inv1" }] });
    relations.listFundraisingCampaigns.mockResolvedValue({ rows: [] });

    await listCampaignsForViewer({ session: { role: "participant", cid: "u1" } });
    expect(relations.listFundraisingCampaigns).toHaveBeenCalledWith({
      ventureId: undefined,
      status: undefined,
      investorId: "inv1",
    });
  });
});

describe("createCampaign", () => {
  it("requires a venture and a name", async () => {
    expect(await createCampaign({ name: "Round" })).toEqual({
      ok: false,
      status: 400,
      error: "venture_id and name are required",
    });
  });

  it("inserts with the normalised fields", async () => {
    relations.insertFundraisingCampaign.mockResolvedValue({ rows: [{ id: "c1" }] });

    const result = await createCampaign({ venture_id: "v1", name: "Round", target_raise: "500" });
    expect(result).toEqual({ ok: true, campaign: { id: "c1" } });
    expect(relations.insertFundraisingCampaign).toHaveBeenCalledWith(
      "v1",
      "Round",
      500,
      null,
      null,
      "USD",
      "public",
      null,
      null,
    );
  });
});

describe("updateCampaignAndNotify", () => {
  it("rejects an update with nothing to change", async () => {
    relations.updateFundraisingCampaign.mockResolvedValue({ updated: false });
    expect(await updateCampaignAndNotify({ id: "c1" })).toEqual({
      ok: false,
      status: 400,
      error: "Nothing to update",
    });
  });

  it("reports a missing campaign", async () => {
    relations.updateFundraisingCampaign.mockResolvedValue({ rows: [] });
    expect(await updateCampaignAndNotify({ id: "c1" })).toEqual({
      ok: false,
      status: 404,
      error: "Campaign not found",
    });
  });

  it("notifies the watchers when a funding milestone is crossed", async () => {
    relations.getCampaignFundingSnapshot.mockResolvedValue({
      rows: [{ current_raised: 10, target_raise: 100 }],
    });
    relations.updateFundraisingCampaign.mockResolvedValue({
      rows: [{ id: "c1", current_raised: 120, target_raise: 100, venture_id: "v1" }],
    });
    relations.getVentureNameForMilestoneAlert.mockResolvedValue({ rows: [{ name: "Acme" }] });
    relations.listInvestorsWatchingVenture.mockResolvedValue({ rows: [{ user_id: "u1" }] });

    const result = await updateCampaignAndNotify({ id: "c1", current_raised: 120 });

    expect(result.ok).toBe(true);
    expect(relations.notifyInvestorOfFundingMilestone).toHaveBeenCalledWith(
      "u1",
      expect.stringContaining("25%"),
      expect.stringContaining("Acme"),
    );
  });
});
