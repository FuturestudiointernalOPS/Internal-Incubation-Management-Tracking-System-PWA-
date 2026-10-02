/**
 * Investor due diligence — the DECISIONS.
 *
 * The first slice of the investor-portal domain. These used to sit inline in
 * `src/app/api/investor/diligence/route.js`. They now live in
 * `src/services/investor/diligence.js`. This suite pins the observable
 * behaviour: the per-role status transitions, the history / follow-up
 * manipulation, and the action dispatch.
 */

jest.mock("@/models/investor", () => ({
  completeDiligenceWorkspace: jest.fn(),
  getDdRequestFollowUpQuestionsByRequestId: jest.fn(),
  getDdRequestFollowUpQuestionsForRespond: jest.fn(),
  getDdRequestInfoByRequestId: jest.fn(),
  getDdRequestInfoForTimeline: jest.fn(),
  getDdRequestVersionHistoryByRequestId: jest.fn(),
  getDiligenceWorkspaceByPipelineId: jest.fn(),
  getDiligenceWorkspaceIdByPipelineId: jest.fn(),
  getInvestorProfileIdByUserIdForNotes: jest.fn(),
  getPipelineWithVentureById: jest.fn(),
  getRelationshipWorkspaceAssigneesByPipelineId: jest.fn(),
  getRelationshipWorkspaceIdByPipelineId: jest.fn(),
  getRelationshipWorkspaceIdForStatusTimeline: jest.fn(),
  insertDdInformationRequest: jest.fn(),
  insertDdRequestAddedTimeline: jest.fn(),
  insertDdStatusChangedTimeline: jest.fn(),
  insertInvestorNote: jest.fn(),
  listDdInformationRequestsByWorkspaceId: jest.fn(),
  listInvestorNotesByPipelineId: jest.fn(),
  updateDdRequestFollowUpQuestions: jest.fn(),
  updateDdRequestFollowUpQuestionsForRespond: jest.fn(),
  updateDdRequestResponse: jest.fn(),
  updatePipelineStageToDueDiligence: jest.fn(),
  upsertDiligenceWorkspace: jest.fn(),
}));

jest.mock("@/models/authorization/investorScope", () => ({
  resolveInvestorScope: jest.fn(),
  investorOwnsPipeline: jest.fn(),
  investorOwnsDdRequest: jest.fn(),
}));

const model = require("@/models/investor");
const scopeModel = require("@/models/authorization/investorScope");
const {
  canTransitionDiligenceStatus,
  diligenceTransitionRefusal,
  appendTransitionHistory,
  appendFollowUpQuestion,
  answerFollowUpQuestion,
  buildDiligenceForViewer,
  runDiligenceAction,
} = require("@/services/investor/diligence");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("canTransitionDiligenceStatus", () => {
  const base = { isAdmin: false, isRM: false, isIM: false, isInvestorContext: false };

  it("gates each transition on the right role", () => {
    expect(canTransitionDiligenceStatus({ ...base, status: "under_review", isRM: true })).toBe(true);
    expect(canTransitionDiligenceStatus({ ...base, status: "under_review" })).toBe(false);
    expect(canTransitionDiligenceStatus({ ...base, status: "verified", isIM: true })).toBe(true);
    expect(canTransitionDiligenceStatus({ ...base, status: "completed", isIM: true })).toBe(true);
    expect(canTransitionDiligenceStatus({ ...base, status: "closed", isRM: true })).toBe(true);
  });

  it("lets a non-investor context upload and respond", () => {
    expect(canTransitionDiligenceStatus({ ...base, status: "documents_uploaded" })).toBe(true);
    expect(canTransitionDiligenceStatus({ ...base, status: "responded" })).toBe(true);
    // ... but not an investor-context caller without the role.
    expect(
      canTransitionDiligenceStatus({ ...base, status: "documents_uploaded", isInvestorContext: true }),
    ).toBe(false);
  });

  it("lets an admin do anything, including an unknown status", () => {
    expect(canTransitionDiligenceStatus({ ...base, status: "bogus", isAdmin: true })).toBe(true);
    expect(canTransitionDiligenceStatus({ ...base, status: "bogus" })).toBe(false);
  });

  it("explains who may act", () => {
    expect(diligenceTransitionRefusal("under_review")).toContain("Relationship Manager");
    expect(diligenceTransitionRefusal("verified")).toContain("Investment Manager");
    expect(diligenceTransitionRefusal("closed")).toContain("authorized staff");
  });
});

describe("history and follow-up manipulation", () => {
  it("appends a transition to a string history", () => {
    const row = { status: "under_review", version_history: JSON.stringify([{ to_status: "x" }]) };
    const history = appendTransitionHistory(row, {
      toStatus: "verified",
      changedBy: "u1",
      notes: "ok",
      now: "T",
    });
    expect(history).toEqual([
      { to_status: "x" },
      { from_status: "under_review", to_status: "verified", changed_at: "T", changed_by: "u1", notes: "ok" },
    ]);
  });

  it("starts a fresh history when it is missing or unparseable", () => {
    const history = appendTransitionHistory({ status: "s1" }, { toStatus: "s2", now: "T" });
    expect(history).toEqual([
      { from_status: "s1", to_status: "s2", changed_at: "T", changed_by: "system", notes: null },
    ]);
  });

  it("appends a follow-up question and records an answer", () => {
    const questions = appendFollowUpQuestion(null, { question: "Q?", askedBy: "u1", now: "T" });
    expect(questions).toEqual([
      { question: "Q?", asked_by: "u1", asked_at: "T", response: null },
    ]);
    expect(answerFollowUpQuestion(questions, { index: 0, response: "A", now: "T2" })).toEqual([
      { question: "Q?", asked_by: "u1", asked_at: "T", response: "A", responded_at: "T2" },
    ]);
  });
});

describe("buildDiligenceForViewer", () => {
  it("hides a pipeline the caller does not own", async () => {
    scopeModel.resolveInvestorScope.mockResolvedValue({ management: false, profileId: "p" });
    scopeModel.investorOwnsPipeline.mockResolvedValue(false);

    const result = await buildDiligenceForViewer({ pipelineId: "pl1", session: {} });
    expect(result).toEqual({ ok: false, error: "errors.notFound", status: 404 });
    expect(model.getDiligenceWorkspaceByPipelineId).not.toHaveBeenCalled();
  });

  it("returns the workspace bundle for a manager", async () => {
    scopeModel.resolveInvestorScope.mockResolvedValue({ management: true, profileId: null });
    model.getDiligenceWorkspaceByPipelineId.mockResolvedValue({ rows: [{ id: "w1" }] });
    model.listDdInformationRequestsByWorkspaceId.mockResolvedValue({ rows: [{ id: "r1" }] });
    model.listInvestorNotesByPipelineId.mockResolvedValue({ rows: [] });
    model.getPipelineWithVentureById.mockResolvedValue({ rows: [{ id: "pl1" }] });

    const result = await buildDiligenceForViewer({ pipelineId: "pl1", session: {} });
    expect(result.ok).toBe(true);
    expect(result.workspace).toEqual({ id: "w1" });
    expect(result.requests).toEqual([{ id: "r1" }]);
  });
});

describe("runDiligenceAction", () => {
  it("refuses an unknown action", async () => {
    scopeModel.resolveInvestorScope.mockResolvedValue({ management: true, profileId: null });
    const result = await runDiligenceAction({
      action: "nope",
      payload: {},
      session: {},
      pipelineId: "pl1",
    });
    expect(result).toEqual({ ok: false, error: "Unknown action", status: 400 });
  });

  it("hides a pipeline the caller does not own", async () => {
    scopeModel.resolveInvestorScope.mockResolvedValue({ management: false, profileId: "p" });
    scopeModel.investorOwnsPipeline.mockResolvedValue(false);
    const result = await runDiligenceAction({
      action: "complete",
      payload: {},
      session: {},
      pipelineId: "pl1",
    });
    expect(result).toEqual({ ok: false, error: "errors.notFound", status: 404 });
  });

  it("creates a workspace and moves the pipeline to due diligence", async () => {
    scopeModel.resolveInvestorScope.mockResolvedValue({ management: true, profileId: null });
    model.upsertDiligenceWorkspace.mockResolvedValue({ rows: [{ id: "w1" }] });

    const result = await runDiligenceAction({
      action: "create_workspace",
      payload: {},
      session: {},
      pipelineId: "pl1",
    });

    expect(result).toEqual({ ok: true, workspace: { id: "w1" } });
    expect(model.updatePipelineStageToDueDiligence).toHaveBeenCalledWith("pl1");
  });

  it("requires a title to add a request", async () => {
    scopeModel.resolveInvestorScope.mockResolvedValue({ management: true, profileId: null });
    const result = await runDiligenceAction({
      action: "add_request",
      payload: {},
      session: {},
      pipelineId: "pl1",
    });
    expect(result).toEqual({ ok: false, error: "title required", status: 400 });
  });

  it("blocks a transition the caller may not make", async () => {
    scopeModel.resolveInvestorScope.mockResolvedValue({ management: true, profileId: null });
    model.getDdRequestInfoByRequestId.mockResolvedValue({ rows: [{ pipeline_id: "pl1" }] });
    model.getRelationshipWorkspaceAssigneesByPipelineId.mockResolvedValue({ rows: [{}] });

    const result = await runDiligenceAction({
      action: "update_request",
      payload: { request_id: "r1", status: "under_review" },
      session: { cid: "u1", role: "participant" },
      pipelineId: "pl1",
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(model.updateDdRequestResponse).not.toHaveBeenCalled();
  });

  it("records an allowed transition with its history entry", async () => {
    scopeModel.resolveInvestorScope.mockResolvedValue({ management: true, profileId: null });
    model.getDdRequestInfoByRequestId.mockResolvedValue({ rows: [{ pipeline_id: "pl1" }] });
    model.getRelationshipWorkspaceAssigneesByPipelineId.mockResolvedValue({
      rows: [{ relationship_manager_id: "u1" }],
    });
    model.getDdRequestVersionHistoryByRequestId.mockResolvedValue({
      rows: [{ status: "pending", version_history: [] }],
    });
    model.getDdRequestInfoForTimeline.mockResolvedValue({ rows: [] });

    const result = await runDiligenceAction({
      action: "update_request",
      payload: { request_id: "r1", status: "under_review" },
      session: { cid: "u1", role: "staff" },
      pipelineId: "pl1",
    });

    expect(result).toEqual({ ok: true });
    const persisted = model.updateDdRequestResponse.mock.calls[0][0];
    expect(persisted.status).toBe("under_review");
    expect(JSON.parse(persisted.version_history)).toEqual([
      expect.objectContaining({ from_status: "pending", to_status: "under_review", changed_by: "u1" }),
    ]);
  });
});
