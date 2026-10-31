/**
 * CRM — the target duration of a pipeline stage.
 *
 * The target is set when the stage is created and defaults to one week; it is
 * what decides that a deal is stuck later. These tests pin the default, the
 * explicit value, and the validation on both create and edit.
 */

jest.mock("@/lib/api/createHandler", () => ({ createHandler: (handler) => handler }));
jest.mock("@/models/authorization/index", () => ({
  requireAuthorization: jest.fn(async () => null),
}));
jest.mock("@/models/crm/pipelines", () => ({
  getCrmPipelineStages: jest.fn(),
  createCrmPipelineStage: jest.fn(),
  reorderCrmPipelineStages: jest.fn(),
  getCrmStageById: jest.fn(),
  updateCrmPipelineStage: jest.fn(),
}));
jest.mock("@/models/crm/schema", () => ({
  ensureCrmStageTargetColumn: jest.fn(async () => {}),
}));

const {
  createCrmPipelineStage,
  getCrmStageById,
  updateCrmPipelineStage,
} = require("@/models/crm/pipelines");
const { ensureCrmStageTargetColumn } = require("@/models/crm/schema");
const { POST } = require("@/app/api/crm/pipelines/[id]/stages/route");
const { PATCH } = require("@/app/api/crm/pipelines/[id]/stages/[stageId]/route");

const request = (body) => ({ json: async () => body });
const pipelineParams = { params: Promise.resolve({ id: "pipe-1" }) };
const stageParams = { params: Promise.resolve({ id: "pipe-1", stageId: "stage-1" }) };

beforeEach(() => {
  jest.clearAllMocks();
  createCrmPipelineStage.mockResolvedValue({ rows: [{ id: "stage-1" }] });
  updateCrmPipelineStage.mockResolvedValue({ rows: [{ id: "stage-1" }] });
  getCrmStageById.mockResolvedValue({
    rows: [{ id: "stage-1", pipeline_id: "pipe-1", target_days: 7 }],
  });
});

test("a new stage gets a one-week target by default", async () => {
  const response = await POST(
    request({ name: "Discussion", position: 3, probability: 40 }),
    pipelineParams,
  );

  expect(response.status).toBe(201);
  expect(createCrmPipelineStage).toHaveBeenCalledWith(
    expect.objectContaining({ target_days: 7 }),
  );
  expect(ensureCrmStageTargetColumn).toHaveBeenCalled();
});

test("an explicit target is kept", async () => {
  await POST(request({ name: "Discussion", position: 3, target_days: 14 }), pipelineParams);

  expect(createCrmPipelineStage).toHaveBeenCalledWith(
    expect.objectContaining({ target_days: 14 }),
  );
});

test.each([-1, 400, 7.5])("an invalid creation target (%s) is refused", async (value) => {
  const response = await POST(
    request({ name: "Discussion", position: 3, target_days: value }),
    pipelineParams,
  );

  expect(response.status).toBe(400);
  expect(createCrmPipelineStage).not.toHaveBeenCalled();
});

test("editing a stage updates its target", async () => {
  const response = await PATCH(request({ target_days: 10 }), stageParams);

  expect(response.status).toBe(200);
  expect(updateCrmPipelineStage).toHaveBeenCalledWith(
    "stage-1",
    expect.objectContaining({ target_days: 10 }),
  );
});

test("an invalid edit target is refused and nothing is written", async () => {
  const response = await PATCH(request({ target_days: 500 }), stageParams);

  expect(response.status).toBe(400);
  expect(updateCrmPipelineStage).not.toHaveBeenCalled();
});
