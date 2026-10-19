/**
 * Dependency edges die with the work they name.
 *
 * THE DEFECT THIS LOCKS SHUT
 *
 * Permanently deleting a journey removed its milestones, tasks and deliverables
 * but left the `venture_dependencies` edges behind. On production that left 76
 * `task -> task` edges all pointing at tasks that no longer existed — invisible
 * in the UI, but real records, and the Projects view reads that graph.
 *
 * The fix has a SHAPE that matters as much as the statement itself: the edges
 * must be removed BEFORE the rows they name, because the cleanup resolves the
 * milestone's task and deliverable ids with subqueries. Run it after the deletes
 * and it matches nothing — silently, which is how the orphans accumulated. These
 * tests pin that order, not just the call.
 */
const mockJourney = {
  runInTransaction: jest.fn((fn) => fn(mockQuery)),
  selectJourneyStageForArchive: jest.fn(),
  selectStageMilestoneIds: jest.fn(),
  selectMilestoneTaskIds: jest.fn(),
  deleteDependenciesForMilestone: jest.fn(async () => ({})),
  deleteDeliverablesForMilestone: jest.fn(async () => ({})),
  deleteTasksForMilestone: jest.fn(async () => ({})),
  deleteMilestoneRow: jest.fn(async () => ({})),
  deleteJourneyStageRow: jest.fn(async () => ({})),
  // Called with `.catch()` straight on the result, so these must be promises.
  deleteJourneyStageNotes: jest.fn(async () => ({})),
  deleteTaskReviewsForTask: jest.fn(async () => ({})),
  deleteTaskCommentsForTask: jest.fn(async () => ({})),
  deleteTaskAttachmentsForTask: jest.fn(async () => ({})),
  archiveJourneyStageRow: jest.fn(async () => ({})),
  restoreJourneyStageRow: jest.fn(async () => ({})),
  selectJourneyStageIdsOrdered: jest.fn(async () => ({ rows: [] })),
  updateJourneyStageOrder: jest.fn(async () => ({})),
};

jest.mock("@/models/ventureJourneyStore", () => mockJourney);
jest.mock("@/services/ventures/archive", () => ({
  filedWorkPhrase: () => "no filed work",
  milestoneFiledWorkKinds: jest.fn(async () => ({ deliverables: false, submissions: false, reviews: false })),
}));

const mockTaskStore = {
  runInTransaction: jest.fn((fn) => fn(mockQuery)),
  selectTaskById: jest.fn(),
  deleteDependencyEdgesForTask: jest.fn(async () => ({})),
  deleteTaskRowInTransaction: jest.fn(async () => ({})),
};

jest.mock("@/models/ventureTasksStore", () => ({
  ...mockTaskStore,
  selectVentureDependencies: jest.fn(async () => ({ rows: [] })),
  selectVentureTaskEdges: jest.fn(async () => ({ rows: [] })),
  selectUnmetTaskDependencies: jest.fn(async () => ({ rows: [] })),
  countTaskBlockersRows: jest.fn(async () => ({ rows: [] })),
  selectTasksBlockedByRows: jest.fn(async () => ({ rows: [] })),
  deleteTaskDependencyEdges: jest.fn(),
  insertTaskDependencyEdge: jest.fn(),
  updateTaskColumns: jest.fn(),
}));

const mockQuery = jest.fn(async () => ({ rows: [], rowsAffected: 1 }));

const { deleteJourneyStages } = require("@/services/ventures/journey/archive");
const { deleteTask } = require("@/services/ventures/tasks");

beforeEach(() => {
  jest.clearAllMocks();
  mockJourney.selectJourneyStageForArchive.mockResolvedValue({ rows: [{ id: "s1", name: "Journey One" }] });
  mockJourney.selectStageMilestoneIds.mockResolvedValue({ rows: [{ id: 11 }] });
  mockJourney.selectMilestoneTaskIds.mockResolvedValue({ rows: [{ id: 101 }] });
  mockJourney.runInTransaction.mockImplementation((fn) => fn(mockQuery));
  mockTaskStore.runInTransaction.mockImplementation((fn) => fn(mockQuery));
  mockTaskStore.selectTaskById.mockResolvedValue({ rows: [{ id: 101, venture_id: "V-1" }] });
});

describe("deleting a journey takes its dependency edges with it", () => {
  test("the edges are removed inside the same transaction as the work", async () => {
    const order = [];
    mockJourney.deleteDependenciesForMilestone.mockImplementation(async () => order.push("edges"));
    mockJourney.deleteDeliverablesForMilestone.mockImplementation(async () => order.push("deliverables"));
    mockJourney.deleteTasksForMilestone.mockImplementation(async () => order.push("tasks"));
    mockJourney.deleteMilestoneRow.mockImplementation(async () => order.push("milestone"));
    mockJourney.deleteJourneyStageRow.mockImplementation(async () => order.push("stage"));

    const result = await deleteJourneyStages({ dbId: "V-1", stageIds: ["s1"] });

    // Asserted first so a refusal shows its reason instead of a bare "not called".
    expect(result?.blocked ?? []).toEqual([]);
    expect(mockJourney.runInTransaction).toHaveBeenCalled();
    // THE ORDER IS THE FIX: edges first, while the ids they name still resolve.
    expect(order).toEqual(["edges", "deliverables", "tasks", "milestone", "stage"]);
  });

  test("a blocked journey is still never deleted, and its edges are untouched", async () => {
    const { milestoneFiledWorkKinds } = require("@/services/ventures/archive");
    milestoneFiledWorkKinds.mockResolvedValueOnce({ deliverables: true, submissions: false, reviews: false });

    const result = await deleteJourneyStages({ dbId: "V-1", stageIds: ["s1"] });

    expect(result.blocked).toHaveLength(1);
    expect(result.deleted).toHaveLength(0);
    expect(mockJourney.deleteDependenciesForMilestone).not.toHaveBeenCalled();
    expect(mockJourney.runInTransaction).not.toHaveBeenCalled();
  });
});

describe("the edge cleanup names every kind of work under the milestone", () => {
  // The REAL store statement, not the module mock: this test is about the SQL.
  const { deleteDependenciesForMilestone: realDelete } = jest.requireActual("@/models/ventureJourneyStore");

  test("milestone, task and deliverable — in both directions", async () => {
    await realDelete(mockQuery, 11, "V-1");

    const [sql, args] = mockQuery.mock.calls[0];
    for (const kind of ["milestone", "task", "deliverable"]) {
      expect(sql).toContain(`source_type = '${kind}'`);
      expect(sql).toContain(`target_type = '${kind}'`);
    }
    // Tasks and deliverables are resolved through the milestone they belong to,
    // scoped to this Venture.
    expect(sql).toMatch(/FROM venture_tasks WHERE milestone_id = \?/);
    expect(sql).toMatch(/FROM venture_deliverables WHERE milestone_id = \?/);
    expect(sql).toMatch(/d\.venture_id::text = \?::text/);
    expect(args).toEqual(["V-1", "11", "11", "11", "11", "11", "11"]);
  });
});

describe("deleting a single task takes its edges too", () => {
  test("both directions go, in one transaction with the row", async () => {
    const order = [];
    mockTaskStore.deleteDependencyEdgesForTask.mockImplementation(async () => order.push("edges"));
    mockTaskStore.deleteTaskRowInTransaction.mockImplementation(async () => order.push("row"));

    await deleteTask(101);

    expect(order).toEqual(["edges", "row"]);
    expect(mockTaskStore.deleteDependencyEdgesForTask).toHaveBeenCalledWith(
      expect.anything(),
      "V-1",
      101,
    );
  });
});
