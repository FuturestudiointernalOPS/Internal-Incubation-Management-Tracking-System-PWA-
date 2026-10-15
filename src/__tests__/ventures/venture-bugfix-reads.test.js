/**
 * VENTURES — read-side fixes: the productivity score, the Knowledge Hub on a
 * database without the learning-path tables.
 */

const rows = (...list) => Promise.resolve({ rows: list });

jest.mock("@/models/ventureAnalyticsStore", () => ({
  selectAnalyticsMilestoneCounts: jest.fn(),
  selectAnalyticsTaskCounts: jest.fn(),
  selectAnalyticsDeliverableCounts: jest.fn(),
  selectAvgTaskCompletionDays: jest.fn(),
  selectOnTimeTaskCounts: jest.fn(),
  selectTaskStatusDistribution: jest.fn(),
  selectMilestoneStatusDistribution: jest.fn(),
  selectActivityTrend: jest.fn(),
  selectWorkloadDistribution: jest.fn(),
  selectMilestonesReport: jest.fn(),
  selectTasksReport: jest.fn(),
  selectTeamProductivity: jest.fn(),
}));

const analyticsStore = require("@/models/ventureAnalyticsStore");
const { getVentureAnalytics } = require("@/services/ventures/analytics");

function seed({ done, total, blocked = 0 }) {
  analyticsStore.selectAnalyticsMilestoneCounts.mockReturnValue(rows({ t: 0, done: 0, delayed: 0 }));
  analyticsStore.selectAnalyticsTaskCounts.mockReturnValue(rows({ t: total, done, blocked, overdue: 0 }));
  analyticsStore.selectAnalyticsDeliverableCounts.mockReturnValue(rows({ t: 0, done: 0 }));
  analyticsStore.selectAvgTaskCompletionDays.mockReturnValue(rows({ avg_days: 0 }));
  analyticsStore.selectOnTimeTaskCounts.mockReturnValue(rows({ total: 0, on_time: 0 }));
  analyticsStore.selectTaskStatusDistribution.mockReturnValue(rows());
  analyticsStore.selectMilestoneStatusDistribution.mockReturnValue(rows());
  analyticsStore.selectActivityTrend.mockReturnValue(rows());
  analyticsStore.selectWorkloadDistribution.mockReturnValue(rows());
}

describe("productivity score", () => {
  test("a Venture that finished nothing scores 0, not 20", async () => {
    seed({ done: 0, total: 27 });
    const { kpis } = await getVentureAnalytics("uuid");
    expect(kpis.productivity_score).toBe(0);
  });

  test("finished work still scores", async () => {
    seed({ done: 10, total: 20 });
    const { kpis } = await getVentureAnalytics("uuid");
    expect(kpis.productivity_score).toBeGreaterThan(0);
  });
});

describe("Knowledge Hub learning paths", () => {
  test("a database without the learning-path tables answers an empty list, not an error", async () => {
    jest.resetModules();
    jest.doMock("@/models/ventureKnowledgeStore", () => ({
      selectVentureLearningPaths: jest.fn().mockRejectedValue(Object.assign(new Error("relation does not exist"), { code: "42P01" })),
      countCompletedByResourceIds: jest.fn(),
    }));
    const { getVentureLearningPaths } = require("@/services/ventures/knowledge");
    await expect(getVentureLearningPaths("VNT-1")).resolves.toEqual([]);
  });

  test("any other database error is still raised", async () => {
    jest.resetModules();
    jest.doMock("@/models/ventureKnowledgeStore", () => ({
      selectVentureLearningPaths: jest.fn().mockRejectedValue(Object.assign(new Error("boom"), { code: "XX000" })),
      countCompletedByResourceIds: jest.fn(),
    }));
    const { getVentureLearningPaths } = require("@/services/ventures/knowledge");
    await expect(getVentureLearningPaths("VNT-1")).rejects.toThrow("boom");
  });
});
