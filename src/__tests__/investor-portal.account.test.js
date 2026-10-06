/**
 * Investor portal — organizations, password setup and the dashboard.
 *
 * These used to sit inline in the `api/investor/*` controllers. They now live
 * in `src/services/investor/**`. This suite pins the observable behaviour: the
 * own-scope bindings on every organization call, the one-time setup password,
 * and the dashboard recommendation scoring.
 *
 * The evaluation, decision, watchlist, preference and meeting surfaces are in
 * investor-portal.test.js.
 */

jest.mock("@/models/investor", () => ({
  createFounderEvaluation: jest.fn(),
  listFounderEvaluationsByPipelineId: jest.fn(),
  listRiskAssessmentsByPipelineId: jest.fn(),
  upsertRiskAssessment: jest.fn(),
  countInvestorWatchlist: jest.fn(),
  getInvestorDashboardProfile: jest.fn(),
  getInvestorPipelineStats: jest.fn(),
  listActiveFundraisingCampaigns: jest.fn(),
  listActiveInvestorRelationshipWorkspaces: jest.fn(),
  listActiveVenturesForRecommendations: jest.fn(),
  listInvestorPipelineEntries: jest.fn(),
  listInvestorWatchlist: jest.fn(),
  listUpcomingRelationshipMeetings: jest.fn(),
}));

jest.mock("@/models/investorRelations", () => ({
  getInvestorDecisionStats: jest.fn(),
  getInvestorProfileIdForDecisions: jest.fn(),
  listInvestorDecisions: jest.fn(),
  listInvestorHistoryTimeline: jest.fn(),
  recordInvestmentDecision: jest.fn(),
  updatePipelineStageAfterDecision: jest.fn(),
  addWatchlistEntry: jest.fn(),
  findWatchlistEntry: jest.fn(),
  getInvestorProfileIdForWatchlist: jest.fn(),
  removeWatchlistEntry: jest.fn(),
  getInvestorProfileIdForPreferences: jest.fn(),
  upsertInvestorPreferencesWithPhilosophy: jest.fn(),
  insertInvestorMeeting: jest.fn(),
  listInvestorMeetingEvents: jest.fn(),
  addOrganizationAdmin: jest.fn(),
  getInvestorProfileIdForOrgCreate: jest.fn(),
  getInvestorProfileIdForOrgList: jest.fn(),
  getOrganizationById: jest.fn(),
  insertOrganization: jest.fn(),
  listInvestorOrganizationsByMember: jest.fn(),
  listOrganizationMembers: jest.fn(),
  upsertOrganizationMember: jest.fn(),
  clearSetupTokenAndSetPassword: jest.fn(),
  findContactBySetupToken: jest.fn(),
}));

jest.mock("@/models/authorization/investorScope", () => ({
  resolveInvestorScope: jest.fn(),
  investorOwnsPipeline: jest.fn(),
  isSameInvestor: jest.fn(),
}));

jest.mock("@/server/auth/password", () => ({
  hashPassword: jest.fn(),
}));
const { hashPassword } = require("@/server/auth/password");
const investor = require("@/models/investor");
const relations = require("@/models/investorRelations");
const scope = require("@/models/authorization/investorScope");

const session = { cid: "C1", id: "C1", role: "member" };

beforeEach(() => {
  jest.clearAllMocks();
});

const {
  listOrganizationsForViewer,
  createOrganization,
  addOrganizationMember,
} = require("@/services/investor/organizations");
const { setupInvestorPassword } = require("@/services/investor/setupPassword");
const { scoreVentures, buildInvestorDashboard } = require("@/services/investor/dashboard");

describe("organizations", () => {
  it("refuses a detail the caller is not a member of", async () => {
    scope.resolveInvestorScope.mockResolvedValue({ management: false, profileId: 7 });
    scope.isSameInvestor.mockReturnValue(false);
    relations.listOrganizationMembers.mockResolvedValue({ rows: [{ investor_id: 9, role: "member" }] });

    expect(await listOrganizationsForViewer({ organizationId: "o1", session })).toEqual({
      ok: false,
      status: 404,
      error: "errors.notFound",
    });
  });

  it("returns the detail to a member", async () => {
    scope.resolveInvestorScope.mockResolvedValue({ management: false, profileId: 7 });
    scope.isSameInvestor.mockImplementation((a, b) => a === b);
    relations.listOrganizationMembers.mockResolvedValue({ rows: [{ investor_id: 7, role: "member" }] });
    relations.getOrganizationById.mockResolvedValue({ rows: [{ id: "o1" }] });

    expect(await listOrganizationsForViewer({ organizationId: "o1", session })).toEqual({
      ok: true,
      organization: { id: "o1" },
      members: [{ investor_id: 7, role: "member" }],
    });
  });

  it("returns an empty list when the caller has no profile", async () => {
    relations.getInvestorProfileIdForOrgList.mockResolvedValue({ rows: [] });

    expect(await listOrganizationsForViewer({ organizationId: null, session })).toEqual({
      ok: true,
      organizations: [],
    });
  });

  it("requires a name to create", async () => {
    expect(await createOrganization({ name: null, session })).toEqual({
      ok: false,
      status: 400,
      error: "Organization name required",
    });
  });

  it("creates the org and enrolls the caller as admin", async () => {
    relations.getInvestorProfileIdForOrgCreate.mockResolvedValue({ rows: [{ id: 7 }] });
    relations.insertOrganization.mockResolvedValue({ rows: [{ id: "o1" }] });

    expect(await createOrganization({ name: "Acme", session })).toEqual({
      ok: true,
      organization: { id: "o1" },
    });
    expect(relations.addOrganizationAdmin).toHaveBeenCalledWith("o1", 7);
  });

  it("only lets an organization admin add a member", async () => {
    scope.resolveInvestorScope.mockResolvedValue({ management: false, profileId: 7 });
    scope.isSameInvestor.mockImplementation((a, b) => a === b);
    relations.listOrganizationMembers.mockResolvedValue({ rows: [{ investor_id: 7, role: "member" }] });

    expect(
      await addOrganizationMember({ organizationId: "o1", investorProfileId: 9, session }),
    ).toEqual({ ok: false, status: 403, error: "errors.insufficientPermissions" });
    expect(relations.upsertOrganizationMember).not.toHaveBeenCalled();
  });

  it("lets an organization admin add a member", async () => {
    scope.resolveInvestorScope.mockResolvedValue({ management: false, profileId: 7 });
    scope.isSameInvestor.mockImplementation((a, b) => a === b);
    relations.listOrganizationMembers.mockResolvedValue({ rows: [{ investor_id: 7, role: "admin" }] });

    expect(
      await addOrganizationMember({ organizationId: "o1", investorProfileId: 9, role: "member", session }),
    ).toEqual({ ok: true });
    expect(relations.upsertOrganizationMember).toHaveBeenCalledWith("o1", 9, "member");
  });
});

describe("setup password", () => {
  it("requires a token and a password", async () => {
    expect(await setupInvestorPassword({ token: null, password: null })).toEqual({
      ok: false,
      status: 400,
      error: "Token and password are required.",
    });
  });

  it("enforces the minimum length", async () => {
    expect(await setupInvestorPassword({ token: "t", password: "123" })).toEqual({
      ok: false,
      status: 400,
      error: "Password must be at least 6 characters.",
    });
  });

  it("404s an unknown token", async () => {
    relations.findContactBySetupToken.mockResolvedValue({ rows: [] });

    expect(await setupInvestorPassword({ token: "t", password: "123456" })).toEqual({
      ok: false,
      status: 404,
      error: "Invalid or expired setup link.",
    });
  });

  it("410s an expired link", async () => {
    relations.findContactBySetupToken.mockResolvedValue({
      rows: [{ cid: "C1", setup_token_expires: "2000-01-01T00:00:00Z" }],
    });

    expect(await setupInvestorPassword({ token: "t", password: "123456" })).toEqual({
      ok: false,
      status: 410,
      error: "Setup link has expired. Please contact Future Studio.",
    });
  });

  it("hashes and stores the password", async () => {
    relations.findContactBySetupToken.mockResolvedValue({
      rows: [{ cid: "C1", setup_token_expires: "2999-01-01T00:00:00Z" }],
    });
    hashPassword.mockResolvedValue("HASH");

    expect(await setupInvestorPassword({ token: "t", password: "123456" })).toEqual({ ok: true });
    expect(relations.clearSetupTokenAndSetPassword).toHaveBeenCalledWith("HASH", "C1");
  });
});

describe("dashboard", () => {
  it("scores a venture against the investor's preferences", () => {
    const profile = {
      industries: ["fintech"],
      countries: ["CM"],
      startup_stages: ["seed"],
      ticket_size_min: 1000,
      ticket_size_max: 5000,
    };
    const ventures = [
      {
        id: "v1",
        industry: "Fintech",
        country: "cm",
        business_stage: "Seed",
        funding_requirement: 3000,
        completion_index: 85,
      },
    ];

    const [scored] = scoreVentures({ profile, ventures });

    expect(scored.match_score).toBe(100); // 30 + 25 + 20 + 15 + 10
    expect(scored.match_reasons).toHaveLength(5);
  });

  it("returns the empty payload for a caller with no profile", async () => {
    investor.getInvestorDashboardProfile.mockResolvedValue({ rows: [] });

    expect(await buildInvestorDashboard({ session })).toEqual({
      profile: null,
      pipeline: [],
      watchlist: [],
      recommendations: [],
      campaigns: [],
      relationships: [],
      stats: {},
    });
  });

  it("assembles the blocks and the watchlist count", async () => {
    investor.getInvestorDashboardProfile.mockResolvedValue({ rows: [{ id: 7 }] });
    investor.listInvestorPipelineEntries.mockResolvedValue({ rows: [{ id: "p1" }] });
    investor.listInvestorWatchlist.mockResolvedValue({ rows: [{ id: "w1" }] });
    investor.listActiveVenturesForRecommendations.mockResolvedValue({ rows: [] });
    investor.getInvestorPipelineStats.mockResolvedValue({ rows: [{ total_capital: 10 }] });
    investor.countInvestorWatchlist.mockResolvedValue({ rows: [{ count: "2" }] });
    investor.listActiveFundraisingCampaigns.mockResolvedValue({ rows: [{ id: "c1" }] });
    investor.listActiveInvestorRelationshipWorkspaces.mockResolvedValue({ rows: [{ id: "rw1" }] });
    investor.listUpcomingRelationshipMeetings.mockResolvedValue({ rows: [{ id: "m1" }] });

    const result = await buildInvestorDashboard({ session });

    expect(result.profile).toEqual({ id: 7 });
    expect(result.pipeline).toEqual([{ id: "p1" }]);
    expect(result.campaigns).toEqual([{ id: "c1" }]);
    expect(result.relationships).toEqual([{ id: "rw1", next_meetings: [{ id: "m1" }] }]);
    expect(result.stats).toEqual({ total_capital: 10, watchlist_count: 2 });
  });
});

