/**
 * CRM — pipeline routes: the events a stage move raises for the automation
 * rules, and the validation of a stage reorder.
 *
 * Runs the real route handlers against mocked models (no database).
 */

jest.mock("@/lib/api/createHandler", () => ({
  createHandler: (_options, handler) => handler,
}));
jest.mock("@/server/auth/session", () => ({
  getSession: jest.fn(async () => ({ user: { cid: "admin-1", name: "Super Admin" } })),
}));
jest.mock("@/models/authorization/index", () => ({
  requireAuthorization: jest.fn(async () => null),
}));
jest.mock("@/services/contacts/timeline", () => ({ addContactTimelineEvent: jest.fn() }));
jest.mock("@/services/crm/automationEngine", () => ({ fireCrmEvent: jest.fn() }));
jest.mock("@/models/crm/stageHistory", () => ({ appendCrmStageHistory: jest.fn() }));
jest.mock("@/models/crm/opportunities", () => ({
  getCrmOpportunityById: jest.fn(),
  setCrmOpportunityStage: jest.fn(),
}));
jest.mock("@/models/crm/pipelines", () => ({
  getCrmStageById: jest.fn(),
  getCrmPipelineStages: jest.fn(),
  createCrmPipelineStage: jest.fn(),
  reorderCrmPipelineStages: jest.fn(),
}));

const { fireCrmEvent } = require("@/services/crm/automationEngine");
const { getCrmOpportunityById, setCrmOpportunityStage } = require("@/models/crm/opportunities");
const { getCrmStageById, getCrmPipelineStages, reorderCrmPipelineStages } = require("@/models/crm/pipelines");
const { PATCH: moveStage } = require("@/app/api/crm/opportunities/[id]/stage/route");
const { PATCH: reorderStages } = require("@/app/api/crm/pipelines/[id]/stages/route");

const request = (body) => ({ json: async () => body });
const firedEvents = () => fireCrmEvent.mock.calls.map(([eventName]) => eventName);

const OPPORTUNITY = { id: "opp-1", name: "MTN rollout", pipeline_id: "pipe-1", stage_id: "st-1", stage_name: "Contacted", status: "active" };

beforeEach(() => {
  jest.clearAllMocks();
  getCrmOpportunityById.mockResolvedValue({ rows: [OPPORTUNITY] });
});

describe("PATCH /api/crm/opportunities/[id]/stage", () => {
  async function moveTo(stage) {
    getCrmStageById.mockResolvedValue({ rows: [{ pipeline_id: "pipe-1", ...stage }] });
    setCrmOpportunityStage.mockImplementation(async (id, stageId, status) => ({
      rows: [{ ...OPPORTUNITY, stage_id: stageId, status }],
    }));
    return moveStage(request({ stage_id: stage.id }), { params: Promise.resolve({ id: "opp-1" }) });
  }

  test("moving to an open stage raises opportunity.stage_changed only", async () => {
    await moveTo({ id: "st-2", name: "Proposal", is_terminal: false });

    expect(firedEvents()).toEqual(["opportunity.stage_changed"]);
    expect(fireCrmEvent.mock.calls[0][1]).toMatchObject({
      id: "opp-1",
      entity_type: "opportunity",
      stage_name: "Proposal",
      previous_stage_name: "Contacted",
      status: "active",
    });
  });

  test("moving to a won stage also raises opportunity.won", async () => {
    await moveTo({ id: "st-9", name: "Won", is_terminal: true, outcome: "won" });
    expect(firedEvents()).toEqual(["opportunity.stage_changed", "opportunity.won"]);
  });

  test("moving to a lost stage also raises opportunity.lost", async () => {
    await moveTo({ id: "st-8", name: "Lost", is_terminal: true, outcome: "lost" });
    expect(firedEvents()).toEqual(["opportunity.stage_changed", "opportunity.lost"]);
  });

  test("a stage of another pipeline is refused and raises nothing", async () => {
    const response = await moveTo({ id: "st-x", name: "Elsewhere", pipeline_id: "pipe-2" });
    expect(response.status).toBe(400);
    expect(fireCrmEvent).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/crm/pipelines/[id]/stages", () => {
  const params = { params: Promise.resolve({ id: "pipe-1" }) };

  beforeEach(() => {
    getCrmPipelineStages.mockResolvedValue({ rows: [{ id: "st-1" }, { id: "st-2" }, { id: "st-3" }] });
    reorderCrmPipelineStages.mockResolvedValue({ rows: [] });
  });

  test("a complete order is applied", async () => {
    const response = await reorderStages(request({ order: ["st-3", "st-1", "st-2"] }), params);
    expect(response.status).toBe(200);
    expect(reorderCrmPipelineStages).toHaveBeenCalledWith("pipe-1", ["st-3", "st-1", "st-2"]);
  });

  test.each([
    ["a missing stage", ["st-1", "st-2"]],
    ["a repeated stage", ["st-1", "st-1", "st-2"]],
    ["a stage of another pipeline", ["st-1", "st-2", "st-other"]],
    ["no order at all", undefined],
  ])("%s is refused and nothing is written", async (_label, order) => {
    const response = await reorderStages(request({ order }), params);
    expect(response.status).toBe(400);
    expect(reorderCrmPipelineStages).not.toHaveBeenCalled();
  });
});
