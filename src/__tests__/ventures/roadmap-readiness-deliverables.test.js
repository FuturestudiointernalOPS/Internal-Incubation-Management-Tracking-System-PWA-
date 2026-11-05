/**
 * Roadmap progress moves when a deliverable is approved, but EACH PIECE OF
 * EVIDENCE IS COUNTED ONCE: a task whose deliverable a reviewer approved is
 * scored by the deliverables component, not also by the tasks component. The
 * milestone read casts the (UUID) column so a mixed code + UUID owner list works.
 */
const mockStore = {
  selectReadinessStageStatuses: jest.fn(),
  selectReadinessStageStatusesPlain: jest.fn(),
  selectReadinessMilestoneStatuses: jest.fn(),
  selectReadinessTaskStatuses: jest.fn(),
  selectReadinessSubmissionStates: jest.fn(),
  selectReadinessDeliverableStates: jest.fn(),
  selectReadinessMilestoneGraph: jest.fn(),
  selectReadinessStageGraph: jest.fn(),
};
jest.mock("@/models/ventureReadinessStore", () => mockStore);

const { computeRoadmapReadiness } = require("@/services/ventures/readiness");

beforeEach(() => {
  mockStore.selectReadinessStageStatuses.mockResolvedValue({ rows: [{ status: "active" }] });
  mockStore.selectReadinessMilestoneStatuses.mockResolvedValue({ rows: [{ status: "not_started" }, { status: "completed" }] });
  mockStore.selectReadinessTaskStatuses.mockResolvedValue({
    rows: [
      { id: 1, status: "backlog" },
      { id: 2, status: "backlog" },
      { id: 3, status: "backlog" },
      { id: 4, status: "done" },
    ],
  });
  mockStore.selectReadinessSubmissionStates.mockResolvedValue({ rows: [] });
  mockStore.selectReadinessMilestoneGraph.mockResolvedValue({ rows: [] });
  mockStore.selectReadinessStageGraph.mockResolvedValue({ rows: [] });
});

test("an approved deliverable is scored once — by deliverables, not also by tasks", async () => {
  mockStore.selectReadinessDeliverableStates.mockResolvedValue({
    rows: [
      { status: "completed", approval_status: "approved", task_id: 1, task_status: "backlog" },
      { status: "completed", approval_status: "approved", task_id: 2, task_status: "backlog" },
      { status: "pending", approval_status: "pending", task_id: 3, task_status: "backlog" },
    ],
  });
  const result = await computeRoadmapReadiness({ dbId: "u", code: "VNT-1" });
  // Tasks 1 and 2 are measured by the deliverables component (linked: 2);
  // tasks 3 and 4 are the ones the tasks component actually owns.
  expect(result.counts.tasks).toEqual({ total: 2, completed: 1, linked: 2 });
  expect(result.counts.deliverables).toEqual({ reviewed: 3, approved: 2, outstanding: 1 });
  expect(result.components.deliverables).toBe(67);
  expect(result.components.tasks).toBe(50);
});

test("a task with an approved deliverable leaves the tasks component even when it was done", async () => {
  mockStore.selectReadinessDeliverableStates.mockResolvedValue({
    rows: [{ status: "completed", approval_status: "approved", task_id: 4, task_status: "done" }],
  });
  const result = await computeRoadmapReadiness({ dbId: "u", code: "VNT-1" });
  expect(result.counts.tasks).toEqual({ total: 3, completed: 0, linked: 1 });
});

test("a Venture without deliverables falls back to the reviewed submissions", async () => {
  mockStore.selectReadinessDeliverableStates.mockResolvedValue({ rows: [] });
  mockStore.selectReadinessSubmissionStates.mockResolvedValue({ rows: [{ status: "submitted", review_decision: "approved" }] });
  const result = await computeRoadmapReadiness({ dbId: "u", code: "VNT-1" });
  expect(result.counts.deliverables).toEqual({ reviewed: 1, approved: 1, outstanding: 0 });
});

test("milestones and journeys advance with their approved deliverables", async () => {
  mockStore.selectReadinessDeliverableStates.mockResolvedValue({ rows: [] });
  mockStore.selectReadinessStageGraph.mockResolvedValue({ rows: [{ id: "s1", status: "active" }, { id: "s2", status: "locked" }] });
  mockStore.selectReadinessMilestoneGraph.mockResolvedValue({
    rows: [
      // 3 of 5 approved, not closed → 60%
      { milestone_id: "m1", stage_id: "s1", status: "under_review", total: "5", approved: "3" },
      // nothing approved → 0%
      { milestone_id: "m2", stage_id: "s1", status: "not_started", total: "4", approved: "0" },
      // closed → 100% whatever its deliverables say
      { milestone_id: "m3", stage_id: "s2", status: "completed", total: "2", approved: "1" },
    ],
  });
  const result = await computeRoadmapReadiness({ dbId: "u", code: "VNT-1" });
  expect(result.components.milestones).toBe(53); // (0.6 + 0 + 1) / 3
  expect(result.components.journeys).toBe(65); // (stage 1: 0.3, stage 2: 1) / 2
  // "done" counts stay strict
  expect(result.counts.milestones.completed).toBe(1);
});
