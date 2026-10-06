/**
 * Investor portal — the DECISIONS of the remaining investor surfaces.
 *
 * These used to sit inline in the `api/investor/*` controllers. They now live
 * in `src/services/investor/**`. This suite pins the observable behaviour: the
 * own-scope bindings, the refusal statuses and the dispatch by type.
 *
 * The organization, password-setup and dashboard surfaces are in
 * investor-portal.account.test.js.
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

const investor = require("@/models/investor");
const relations = require("@/models/investorRelations");
const scope = require("@/models/authorization/investorScope");

const session = { cid: "C1", id: "C1", role: "member" };

beforeEach(() => {
  jest.clearAllMocks();
});

const { listEvaluationsForViewer, createEvaluation } = require("@/services/investor/evaluation");
const { listDecisionsForViewer, recordDecision } = require("@/services/investor/decisions");
const { toggleWatchlist } = require("@/services/investor/watchlist");
const { saveInvestorPreferences } = require("@/services/investor/preferences");
const {
  listInvestorMeetingsForViewer,
  createInvestorMeeting,
} = require("@/services/investor/meetings");

describe("evaluation", () => {
  it("requires a pipeline", async () => {
    expect(await listEvaluationsForViewer({ pipelineId: null, session })).toEqual({
      ok: false,
      status: 400,
      error: "pipeline_id required",
    });
  });

  it("refuses another investor's pipeline with a 404", async () => {
    scope.resolveInvestorScope.mockResolvedValue({ management: false, profileId: 7 });
    scope.investorOwnsPipeline.mockResolvedValue(false);

    expect(await listEvaluationsForViewer({ pipelineId: "p9", session })).toEqual({
      ok: false,
      status: 404,
      error: "errors.notFound",
    });
    expect(investor.listFounderEvaluationsByPipelineId).not.toHaveBeenCalled();
  });

  it("returns the evaluations of the caller's own pipeline", async () => {
    scope.resolveInvestorScope.mockResolvedValue({ management: true, profileId: null });
    investor.listFounderEvaluationsByPipelineId.mockResolvedValue({ rows: [{ id: "f1" }] });
    investor.listRiskAssessmentsByPipelineId.mockResolvedValue({ rows: [{ id: "r1" }] });

    expect(await listEvaluationsForViewer({ pipelineId: "p1", session })).toEqual({
      ok: true,
      founder_evaluations: [{ id: "f1" }],
      risk_assessments: [{ id: "r1" }],
    });
  });

  it("requires pipeline and type on write", async () => {
    expect(await createEvaluation({ pipelineId: null, type: "founder", fields: {}, session })).toEqual(
      { ok: false, status: 400, error: "pipeline_id and type required" },
    );
  });

  it("dispatches a founder evaluation", async () => {
    scope.resolveInvestorScope.mockResolvedValue({ management: true, profileId: null });
    investor.createFounderEvaluation.mockResolvedValue({ rows: [{ id: "e1" }] });

    const result = await createEvaluation({
      pipelineId: "p1",
      type: "founder",
      fields: { founder_name: "Ada" },
      session,
    });

    expect(result).toEqual({ ok: true, evaluation: { id: "e1" } });
    expect(investor.createFounderEvaluation).toHaveBeenCalledWith(
      expect.objectContaining({ pipeline_id: "p1", founder_name: "Ada", created_by: "C1" }),
    );
  });

  it("requires a founder name", async () => {
    scope.resolveInvestorScope.mockResolvedValue({ management: true, profileId: null });

    expect(
      await createEvaluation({ pipelineId: "p1", type: "founder", fields: {}, session }),
    ).toEqual({ ok: false, status: 400, error: "founder_name required" });
  });

  it("dispatches a risk assessment", async () => {
    scope.resolveInvestorScope.mockResolvedValue({ management: true, profileId: null });
    investor.upsertRiskAssessment.mockResolvedValue({ rows: [{ id: "r1" }] });

    const result = await createEvaluation({
      pipelineId: "p1",
      type: "risk",
      fields: { risk_category: "market", risk_description: "slow" },
      session,
    });

    expect(result).toEqual({ ok: true, evaluation: { id: "r1" } });
    expect(investor.upsertRiskAssessment).toHaveBeenCalledWith(
      expect.objectContaining({ pipeline_id: "p1", risk_category: "market" }),
    );
  });

  it("rejects an unknown type", async () => {
    scope.resolveInvestorScope.mockResolvedValue({ management: true, profileId: null });

    expect(
      await createEvaluation({ pipelineId: "p1", type: "nope", fields: {}, session }),
    ).toEqual({ ok: false, status: 400, error: "Invalid type. Use 'founder' or 'risk'" });
  });
});

describe("decisions", () => {
  it("returns empty lists for a caller with no profile", async () => {
    relations.getInvestorProfileIdForDecisions.mockResolvedValue({ rows: [] });

    const result = await listDecisionsForViewer({ session });

    expect(result.decisions).toEqual([]);
    expect(result.history).toEqual([]);
    expect(result.stats).toEqual({
      total_invested: 0,
      total_capital: 0,
      total_declined: 0,
      total_decisions: 0,
    });
  });

  it("assembles the caller's decisions, history and stats", async () => {
    relations.getInvestorProfileIdForDecisions.mockResolvedValue({ rows: [{ id: 7 }] });
    relations.listInvestorDecisions.mockResolvedValue({ rows: [{ id: "d1" }] });
    relations.listInvestorHistoryTimeline.mockResolvedValue({ rows: [{ id: "h1" }] });
    relations.getInvestorDecisionStats.mockResolvedValue({ rows: [{ total_decisions: 3 }] });

    expect(await listDecisionsForViewer({ session })).toEqual({
      ok: true,
      decisions: [{ id: "d1" }],
      history: [{ id: "h1" }],
      stats: { total_decisions: 3 },
    });
  });

  it("requires a pipeline and a decision type", async () => {
    expect(await recordDecision({ pipelineId: null, session })).toEqual({
      ok: false,
      status: 400,
      error: "pipeline_id and decision_type required",
    });
  });

  it("rejects an invalid decision type", async () => {
    expect(await recordDecision({ pipelineId: "p1", decisionType: "maybe", session })).toEqual({
      ok: false,
      status: 400,
      error: "Invalid decision_type",
    });
  });

  it("records the decision and moves the pipeline to the mapped stage", async () => {
    scope.resolveInvestorScope.mockResolvedValue({ management: true, profileId: null });

    const result = await recordDecision({
      pipelineId: "p1",
      decisionType: "invest",
      investmentAmount: 100,
      session,
    });

    expect(result).toEqual({ ok: true });
    expect(relations.recordInvestmentDecision).toHaveBeenCalledWith("p1", "invest", 100, null);
    expect(relations.updatePipelineStageAfterDecision).toHaveBeenCalledWith("invested", "p1");
  });
});

describe("watchlist", () => {
  it("requires a venture", async () => {
    expect(await toggleWatchlist({ ventureId: null, session })).toEqual({
      ok: false,
      status: 400,
      error: "venture_id required",
    });
  });

  it("404s a caller with no profile", async () => {
    relations.getInvestorProfileIdForWatchlist.mockResolvedValue({ rows: [] });

    expect(await toggleWatchlist({ ventureId: "v1", session })).toEqual({
      ok: false,
      status: 404,
      error: "Profile not found",
    });
  });

  it("removes an existing entry", async () => {
    relations.getInvestorProfileIdForWatchlist.mockResolvedValue({ rows: [{ id: 7 }] });
    relations.findWatchlistEntry.mockResolvedValue({ rows: [{ id: "w1" }] });

    expect(await toggleWatchlist({ ventureId: "v1", session })).toEqual({
      ok: true,
      action: "removed",
    });
    expect(relations.removeWatchlistEntry).toHaveBeenCalledWith(7, "v1");
    expect(relations.addWatchlistEntry).not.toHaveBeenCalled();
  });

  it("adds a missing entry", async () => {
    relations.getInvestorProfileIdForWatchlist.mockResolvedValue({ rows: [{ id: 7 }] });
    relations.findWatchlistEntry.mockResolvedValue({ rows: [] });

    expect(await toggleWatchlist({ ventureId: "v1", personalNotes: "hi", session })).toEqual({
      ok: true,
      action: "added",
    });
    expect(relations.addWatchlistEntry).toHaveBeenCalledWith(7, "v1", "hi");
  });
});

describe("preferences", () => {
  it("404s a caller with no profile", async () => {
    relations.getInvestorProfileIdForPreferences.mockResolvedValue({ rows: [] });

    expect(await saveInvestorPreferences({ body: {}, session })).toEqual({
      ok: false,
      status: 404,
      error: "Investor profile not found. Create profile first.",
    });
  });

  it("upserts with the defaults", async () => {
    relations.getInvestorProfileIdForPreferences.mockResolvedValue({ rows: [{ id: 7 }] });

    expect(await saveInvestorPreferences({ body: {}, session })).toEqual({ ok: true });
    expect(relations.upsertInvestorPreferencesWithPhilosophy).toHaveBeenCalledWith(
      7,
      [],
      [],
      [],
      null,
      null,
      null,
    );
  });
});

describe("investor meetings", () => {
  it("requires a venture for a self-service caller", async () => {
    scope.resolveInvestorScope.mockResolvedValue({ management: false, profileId: 7 });

    expect(await listInvestorMeetingsForViewer({ ventureId: null, session })).toEqual({
      ok: false,
      status: 400,
      error: "venture_id required",
    });
    expect(relations.listInvestorMeetingEvents).not.toHaveBeenCalled();
  });

  it("lets management read without a venture", async () => {
    scope.resolveInvestorScope.mockResolvedValue({ management: true, profileId: null });
    relations.listInvestorMeetingEvents.mockResolvedValue({ rows: [{ id: "m1" }] });

    expect(await listInvestorMeetingsForViewer({ ventureId: null, session })).toEqual({
      ok: true,
      meetings: [{ id: "m1" }],
    });
  });

  it("requires a title and a start time", async () => {
    expect(await createInvestorMeeting({ title: null, startTime: null, session })).toEqual({
      ok: false,
      status: 400,
      error: "Title and start_time required",
    });
  });

  it("schedules with the video default", async () => {
    relations.insertInvestorMeeting.mockResolvedValue({ rows: [{ id: "m1" }] });

    const result = await createInvestorMeeting({
      ventureId: "v1",
      title: "Intro",
      startTime: "2026-05-01T10:00:00Z",
      session,
    });

    expect(result).toEqual({ ok: true, meeting: { id: "m1" } });
    expect(relations.insertInvestorMeeting).toHaveBeenCalledWith(
      "v1",
      "Intro",
      null,
      "2026-05-01T10:00:00Z",
      null,
      "video",
      "C1",
    );
  });
});
