/**
 * Milestone statuses follow their work whenever the Journey is read: a milestone
 * whose deliverables are all approved (and whose tasks are done, an approved
 * deliverable finishing its task) closes, without waiting for someone to press
 * a button or for the next approval.
 */
const mockStore = {
  completeMilestoneRow: jest.fn(async () => ({})),
  selectActiveTaskStatusesForMilestone: jest.fn(),
  selectDeliverableStatesForMilestone: jest.fn(),
  selectMilestoneForSync: jest.fn(),
  selectOpenMilestoneIds: jest.fn(),
  selectTaskStatusesForMilestonePlain: jest.fn(),
  updateMilestoneStatusRow: jest.fn(async () => ({})),
};
jest.mock("@/models/ventureMilestoneEngineStore", () => mockStore);
jest.mock("@/services/ventures/milestoneEngine/availability", () => ({
  activateDueStages: jest.fn(async () => ({})),
  completeStageIfAllMilestonesDone: jest.fn(async () => ({ completed: false })),
}));

const { reconcileMilestonesFromWork } = require("@/services/ventures/milestoneEngine/status");

const approved = { status: "completed", approval_status: "approved" };
const pending = { status: "pending", approval_status: "pending" };

const milestones = {
  done: { id: "m-done", title: "Foundation", status: "in_progress", journey_stage_id: "s1" },
  partial: { id: "m-partial", title: "Pilot", status: "not_started", journey_stage_id: "s1" },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockStore.selectOpenMilestoneIds.mockResolvedValue({ rows: [{ id: "m-done" }, { id: "m-partial" }] });
  mockStore.selectMilestoneForSync.mockImplementation(async (id) => ({ rows: [id === "m-done" ? milestones.done : milestones.partial] }));
  mockStore.selectDeliverableStatesForMilestone.mockImplementation(async (id) => ({
    rows: id === "m-done" ? [approved, approved, approved] : [approved, pending],
  }));
  // Tasks as the engine reads them (an approved deliverable already shows as done).
  mockStore.selectActiveTaskStatusesForMilestone.mockImplementation(async (id) => ({
    rows: id === "m-done" ? [{ status: "done" }, { status: "done" }, { status: "done" }] : [{ status: "done" }, { status: "backlog" }],
  }));
});

test("closes the milestone whose work is all approved and done, and only that one", async () => {
  const result = await reconcileMilestonesFromWork({ dbId: "venture-uuid" });

  expect(result).toEqual({ examined: 2, changed: 2 });
  expect(mockStore.completeMilestoneRow).toHaveBeenCalledTimes(1);
  expect(mockStore.completeMilestoneRow).toHaveBeenCalledWith("m-done", "venture-uuid");
  // the other one only moves to in progress — partly approved is not done
  expect(mockStore.updateMilestoneStatusRow).toHaveBeenCalledWith("in_progress", "m-partial", "venture-uuid");
});

test("is idempotent: a milestone already in the right status is left alone", async () => {
  mockStore.selectOpenMilestoneIds.mockResolvedValue({ rows: [{ id: "m-partial" }] });
  mockStore.selectMilestoneForSync.mockResolvedValue({ rows: [{ ...milestones.partial, status: "in_progress" }] });

  const result = await reconcileMilestonesFromWork({ dbId: "venture-uuid" });

  expect(result.changed).toBe(0);
  expect(mockStore.updateMilestoneStatusRow).not.toHaveBeenCalled();
  expect(mockStore.completeMilestoneRow).not.toHaveBeenCalled();
});

test("only asks for the milestones the work may still move, and never throws", async () => {
  mockStore.selectOpenMilestoneIds.mockRejectedValue(new Error("db down"));
  await expect(reconcileMilestonesFromWork({ dbId: "venture-uuid" })).resolves.toEqual({ examined: 0, changed: 0 });
  await expect(reconcileMilestonesFromWork({})).resolves.toEqual({ examined: 0, changed: 0 });
});
