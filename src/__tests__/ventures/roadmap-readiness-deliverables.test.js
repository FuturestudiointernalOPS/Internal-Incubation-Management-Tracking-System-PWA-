/**
 * Roadmap progress moves when a deliverable is approved: the approval does not
 * rewrite the linked task, so the roadmap reads the deliverable itself, and the
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
  mockStore.selectReadinessTaskStatuses.mockResolvedValue({ rows: [{ status: "backlog" }, { status: "backlog" }, { status: "backlog" }, { status: "done" }] });
  mockStore.selectReadinessSubmissionStates.mockResolvedValue({ rows: [] });
  mockStore.selectReadinessMilestoneGraph.mockResolvedValue({ rows: [] });
  mockStore.selectReadinessStageGraph.mockResolvedValue({ rows: [] });
});

test("approved deliverables count as done tasks and as approved deliverables", async () => {
  mockStore.selectReadinessDeliverableStates.mockResolvedValue({
    rows: [
      { status: "completed", approval_status: "approved", task_status: "backlog" },
      { status: "completed", approval_status: "approved", task_status: "backlog" },
      { status: "pending", approval_status: "pending", task_status: "backlog" },
    ],
  });
  const result = await computeRoadmapReadiness({ dbId: "u", code: "VNT-1" });
  expect(result.counts.tasks).toEqual({ total: 4, completed: 3 });
  expect(result.counts.deliverables).toEqual({ reviewed: 3, approved: 2, outstanding: 1 });
  expect(result.components.deliverables).toBe(67);
});

test("a task already done is not counted twice, and tasks never exceed the total", async () => {
  mockStore.selectReadinessDeliverableStates.mockResolvedValue({
    rows: [{ status: "completed", approval_status: "approved", task_status: "done" }],
  });
  const result = await computeRoadmapReadiness({ dbId: "u", code: "VNT-1" });
  expect(result.counts.tasks.completed).toBe(1);
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
