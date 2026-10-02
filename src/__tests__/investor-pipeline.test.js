/**
 * Investor pipeline — the DECISIONS.
 *
 * These used to sit inline in `src/app/api/investor/pipeline/route.js`. They now
 * live in `src/services/investor/pipeline.js`. This suite pins the observable
 * behaviour: the list scope, the stage rules, the invested-amount parsing, and
 * the meeting / invested cascades.
 */

jest.mock("@/models/investor", () => ({
  addInvestmentToActiveCampaign: jest.fn(),
  createInvestmentDecision: jest.fn(),
  getInvestmentNotificationInfo: jest.fn(),
  getInvestorProfileIdByUserId: jest.fn(),
  getInvestorProfileIdByUserIdForPipelineList: jest.fn(),
  getMeetingRequestInfo: jest.fn(),
  getRelationshipWorkspaceAssigneesForInvestment: jest.fn(),
  getRelationshipWorkspaceIdForInvestment: jest.fn(),
  insertInvestmentCommittedTimeline: jest.fn(),
  insertInvestmentConfirmedAdminNotification: jest.fn(),
  insertInvestmentConfirmedInvestorNotification: jest.fn(),
  insertInvestmentConfirmedStaffNotification: jest.fn(),
  insertInvestorMeetingPlaceholderEvent: jest.fn(),
  insertInvestorMeetingRequestNotification: jest.fn(),
  listAdminAndStaffCids: jest.fn(),
  listInvestmentPipeline: jest.fn(),
  listSuperAdminCids: jest.fn(),
  markRelationshipWorkspaceActiveInvestment: jest.fn(),
  upsertInvestmentPipeline: jest.fn(),
}));

const model = require("@/models/investor");
const {
  normalizePipelineStage,
  parseInvestedAmount,
  shouldResolvePipelineProfile,
  listPipelineForViewer,
  addOrUpdatePipeline,
} = require("@/services/investor/pipeline");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("stage and amount helpers", () => {
  it("defaults the stage to interested", () => {
    expect(normalizePipelineStage(null)).toBe("interested");
    expect(normalizePipelineStage("invested")).toBe("invested");
  });

  it("reads the invested amount from the amount, then the notes", () => {
    expect(parseInvestedAmount({ amount: "1000" })).toBe(1000);
    expect(parseInvestedAmount({ amount: "", notes: "3" })).toBe(3);
    expect(parseInvestedAmount({})).toBe(0);
  });
});

describe("shouldResolvePipelineProfile", () => {
  it("always resolves for a non-management caller", () => {
    expect(
      shouldResolvePipelineProfile({ management: false, ventureId: "v1", stage: "invested", role: "participant" }),
    ).toBe(true);
  });

  it("keeps management's historical branches", () => {
    expect(
      shouldResolvePipelineProfile({ management: true, ventureId: "v1", stage: null, role: "staff" }),
    ).toBe(false);
    expect(
      shouldResolvePipelineProfile({ management: true, ventureId: null, stage: "invested", role: "super_admin" }),
    ).toBe(false);
    expect(
      shouldResolvePipelineProfile({ management: true, ventureId: null, stage: "invested", role: "program_manager" }),
    ).toBe(true);
    expect(
      shouldResolvePipelineProfile({ management: true, ventureId: null, stage: null, role: "staff" }),
    ).toBe(true);
  });
});

describe("listPipelineForViewer", () => {
  it("returns nothing for a non-management caller with no investor profile", async () => {
    model.getInvestorProfileIdByUserIdForPipelineList.mockResolvedValue({ rows: [] });

    const result = await listPipelineForViewer({ session: { role: "participant", cid: "u1" } });
    expect(result).toEqual({ ok: true, pipeline: [] });
    expect(model.listInvestmentPipeline).not.toHaveBeenCalled();
  });

  it("lets management list by venture without resolving a profile", async () => {
    model.listInvestmentPipeline.mockResolvedValue({ rows: [{ id: "pl1" }] });

    const result = await listPipelineForViewer({
      ventureId: "v1",
      session: { role: "staff", cid: "u1" },
    });

    expect(result.pipeline).toEqual([{ id: "pl1" }]);
    expect(model.getInvestorProfileIdByUserIdForPipelineList).not.toHaveBeenCalled();
    expect(model.listInvestmentPipeline).toHaveBeenCalledWith({
      ventureId: "v1",
      stage: undefined,
      role: "staff",
      investorId: null,
    });
  });
});

describe("addOrUpdatePipeline", () => {
  it("requires an investor profile", async () => {
    model.getInvestorProfileIdByUserId.mockResolvedValue({ rows: [] });
    expect(await addOrUpdatePipeline({ ventureId: "v1", session: { cid: "u1" } })).toEqual({
      ok: false,
      status: 404,
      error: "Investor profile not found",
    });
  });

  it("rejects an invalid stage", async () => {
    model.getInvestorProfileIdByUserId.mockResolvedValue({ rows: [{ id: "inv1" }] });
    expect(await addOrUpdatePipeline({ ventureId: "v1", stage: "bogus", session: { cid: "u1" } })).toEqual({
      ok: false,
      status: 400,
      error: "Invalid stage",
    });
  });

  it("notifies the super admins on a meeting request", async () => {
    model.getInvestorProfileIdByUserId.mockResolvedValue({ rows: [{ id: "inv1" }] });
    model.upsertInvestmentPipeline.mockResolvedValue({ rows: [{ id: "pl1" }] });
    model.getMeetingRequestInfo.mockResolvedValue({ rows: [{ investor_name: "I", venture_name: "V" }] });
    model.listSuperAdminCids.mockResolvedValue({ rows: [{ cid: "a1" }] });

    const result = await addOrUpdatePipeline({
      ventureId: "v1",
      stage: "meeting_requested",
      session: { cid: "u1" },
    });

    expect(result).toEqual({ ok: true, pipeline: { id: "pl1" } });
    expect(model.insertInvestorMeetingRequestNotification).toHaveBeenCalledWith(
      expect.objectContaining({ recipient_id: "a1", investor_name: "I", venture_name: "V" }),
    );
    expect(model.insertInvestorMeetingPlaceholderEvent).toHaveBeenCalled();
  });

  it("records the decision and updates the campaign on an investment", async () => {
    model.getInvestorProfileIdByUserId.mockResolvedValue({ rows: [{ id: "inv1" }] });
    model.upsertInvestmentPipeline.mockResolvedValue({ rows: [{ id: "pl1" }] });
    model.getRelationshipWorkspaceIdForInvestment.mockResolvedValue({ rows: [] });
    model.getInvestmentNotificationInfo.mockResolvedValue({ rows: [{}] });
    model.listAdminAndStaffCids.mockResolvedValue({ rows: [] });
    model.getRelationshipWorkspaceAssigneesForInvestment.mockResolvedValue({ rows: [] });

    const result = await addOrUpdatePipeline({
      ventureId: "v1",
      stage: "invested",
      amount: "1000",
      session: { cid: "u1" },
    });

    expect(result).toEqual({ ok: true, pipeline: { id: "pl1" } });
    expect(model.createInvestmentDecision).toHaveBeenCalledWith({
      pipeline_id: "pl1",
      investment_amount: 1000,
      notes: undefined,
    });
    expect(model.addInvestmentToActiveCampaign).toHaveBeenCalledWith({
      amount: 1000,
      venture_id: "v1",
    });
  });
});
