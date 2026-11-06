jest.mock("@/models/investor/introductions", () => ({
  insertIntroductionRequest: jest.fn(),
  listIntroductionRequests: jest.fn(),
  listInvestorIntroductionRequests: jest.fn(),
  getIntroductionRequestById: jest.fn(),
  markIntroductionReviewStarted: jest.fn(),
  updateIntroductionDecision: jest.fn(),
  findActiveIntroductionRequest: jest.fn(),
  withdrawIntroductionRequest: jest.fn(),
}));
jest.mock("@/models/investor/dealFlow", () => ({
  findLiveDealFlowEntryForVenture: jest.fn(),
}));
jest.mock("@/models/investorRelations", () => ({
  upsertRelationshipWorkspace: jest.fn(),
  getPipelineById: jest.fn(),
  insertWorkspaceCreatedTimeline: jest.fn(),
  getInvestorUserIdByProfileId: jest.fn(),
  notifyIntroductionApproved: jest.fn(),
}));
jest.mock("@/models/investor/diligenceAndPipeline/pipeline", () => ({
  findInvestmentPipelineForInvestorVenture: jest.fn(),
  upsertInvestmentPipeline: jest.fn(),
}));
jest.mock("@/models/investor/venturesAndUpdates", () => ({
  findVisibleInvestorVenture: jest.fn(),
}));
jest.mock("@/services/investor/activity", () => ({
  emitInvestorEvent: jest.fn(),
}));

const introModel = require("@/models/investor/introductions");
const dealFlowModel = require("@/models/investor/dealFlow");
const pipelineModel = require("@/models/investor/diligenceAndPipeline/pipeline");
const ventureModel = require("@/models/investor/venturesAndUpdates");
const {
  decideIntroduction,
  requestIntroduction,
  withdrawMyIntroduction,
} = require("@/services/investor/introductions");

describe("investor introductions", () => {
  beforeEach(() => jest.clearAllMocks());

  it("creates an introduction against a visible live deal and UUID pipeline row", async () => {
    ventureModel.findVisibleInvestorVenture.mockResolvedValue({ rows: [{ id: "venture-uuid" }] });
    dealFlowModel.findLiveDealFlowEntryForVenture.mockResolvedValue({
      rows: [{ id: 21, venture_id: "venture-uuid" }],
    });
    introModel.findActiveIntroductionRequest.mockResolvedValue({ rows: [] });
    pipelineModel.findInvestmentPipelineForInvestorVenture.mockResolvedValue({
      rows: [{ id: "pipeline-uuid", stage: "interested" }],
    });
    introModel.insertIntroductionRequest.mockResolvedValue({
      rows: [{ id: 4, venture_id: "venture-uuid", investor_profile_id: "profile-uuid" }],
    });

    const result = await requestIntroduction({
      investorId: "profile-uuid",
      ventureId: "venture-uuid",
      dealFlowEntryId: 21,
      message: "Interested",
      session: { cid: "user-uuid" },
    });

    expect(result.ok).toBe(true);
    expect(ventureModel.findVisibleInvestorVenture).toHaveBeenCalledWith("venture-uuid", "deal_flow_only");
    expect(dealFlowModel.findLiveDealFlowEntryForVenture).toHaveBeenCalledWith("venture-uuid", 21);
    expect(introModel.insertIntroductionRequest).toHaveBeenCalledWith({
      investorProfileId: "profile-uuid",
      ventureId: "venture-uuid",
      dealFlowEntryId: 21,
      pipelineId: "pipeline-uuid",
      message: "Interested",
    });
  });

  it("does not create duplicate active requests", async () => {
    ventureModel.findVisibleInvestorVenture.mockResolvedValue({ rows: [{ id: "venture-uuid" }] });
    dealFlowModel.findLiveDealFlowEntryForVenture.mockResolvedValue({ rows: [{ id: 21 }] });
    introModel.findActiveIntroductionRequest.mockResolvedValue({ rows: [{ id: 4 }] });

    const result = await requestIntroduction({
      investorId: "profile-uuid",
      ventureId: "venture-uuid",
    });

    expect(result).toMatchObject({ ok: false, status: 409 });
    expect(pipelineModel.findInvestmentPipelineForInvestorVenture).not.toHaveBeenCalled();
    expect(introModel.insertIntroductionRequest).not.toHaveBeenCalled();
  });

  it("rejects a request for a venture outside the investor's visible deal flow", async () => {
    ventureModel.findVisibleInvestorVenture.mockResolvedValue({ rows: [] });

    const result = await requestIntroduction({
      investorId: "profile-uuid",
      ventureId: "venture-uuid",
    });

    expect(result).toMatchObject({ ok: false, status: 404 });
    expect(dealFlowModel.findLiveDealFlowEntryForVenture).not.toHaveBeenCalled();
  });

  it("withdraws only the caller's submitted request", async () => {
    introModel.withdrawIntroductionRequest.mockResolvedValue({
      rows: [{ id: 4, venture_id: "venture-uuid", status: "withdrawn" }],
    });

    const result = await withdrawMyIntroduction({
      id: "4",
      investorId: "profile-uuid",
      session: { cid: "user-uuid" },
    });

    expect(result).toMatchObject({ ok: true, request: { status: "withdrawn" } });
    expect(introModel.withdrawIntroductionRequest).toHaveBeenCalledWith({
      id: "4",
      investorProfileId: "profile-uuid",
    });
  });

  it("does not report success when the requested decision conflicts with a final decision", async () => {
    introModel.getIntroductionRequestById.mockResolvedValue({
      rows: [{ id: 4, status: "approved", investor_profile_id: "profile-uuid" }],
    });

    const result = await decideIntroduction({
      id: 4,
      decision: "declined",
      session: { cid: "studio-user" },
    });

    expect(result).toMatchObject({ ok: false, status: 409 });
    expect(introModel.updateIntroductionDecision).not.toHaveBeenCalled();
  });

  it("treats a repeated matching final decision as idempotent", async () => {
    const request = { id: 4, status: "approved" };
    introModel.getIntroductionRequestById.mockResolvedValue({ rows: [request] });

    const result = await decideIntroduction({
      id: 4,
      decision: "approved",
      session: { cid: "studio-user" },
    });

    expect(result).toMatchObject({ ok: true, request, alreadyDecided: true });
    expect(introModel.updateIntroductionDecision).not.toHaveBeenCalled();
  });
});
