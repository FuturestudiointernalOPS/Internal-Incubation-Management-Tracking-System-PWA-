/**
 * Behaviour of the admin analytics aggregation (service layer).
 *
 * The reads are mocked: the derived rates and the safe fallbacks on the
 * execution overview, and the per-user aggregation with its batched maps.
 */

jest.mock("@/models/adminOps", () => ({
  getAvgBlockerResolutionSeconds: jest.fn(),
  getBlockerAggregatesForUsers: jest.fn(),
  getBlockerStatusStats: jest.fn(),
  getDistinctTaskUserCount: jest.fn(),
  getSubmittedReportCountsByWeek: jest.fn(),
  getTaskAggregatesForUsers: jest.fn(),
  getTaskProjectUserOptions: jest.fn(),
  getTaskStatusStats: jest.fn(),
  getUserIndependentTaskCounts: jest.fn(),
  getUserProjectCounts: jest.fn(),
  getUserReportCompliance: jest.fn(),
  getV2ProjectCount: jest.fn(),
  getWeeklyProductivityStats: jest.fn(),
}));

const models = require("@/models/adminOps");
const {
  getExecutionAnalytics,
  listUserAnalytics,
} = require("@/services/dashboard/adminAnalytics");

beforeEach(() => {
  jest.clearAllMocks();
  models.getTaskStatusStats.mockResolvedValue({ rows: [] });
  models.getBlockerStatusStats.mockResolvedValue({ rows: [] });
  models.getSubmittedReportCountsByWeek.mockResolvedValue({ rows: [] });
  models.getV2ProjectCount.mockResolvedValue({ rows: [] });
  models.getDistinctTaskUserCount.mockResolvedValue({ rows: [] });
  models.getAvgBlockerResolutionSeconds.mockResolvedValue({ rows: [] });
  models.getWeeklyProductivityStats.mockResolvedValue({ rows: [] });
  models.getTaskProjectUserOptions.mockResolvedValue({ rows: [] });
  models.getTaskAggregatesForUsers.mockResolvedValue({ rows: [] });
  models.getBlockerAggregatesForUsers.mockResolvedValue({ rows: [] });
  models.getUserProjectCounts.mockResolvedValue({ rows: [] });
  models.getUserIndependentTaskCounts.mockResolvedValue({ rows: [] });
  models.getUserReportCompliance.mockResolvedValue({ rows: [] });
});

describe("getExecutionAnalytics", () => {
  test("empty data yields zeroed analytics and zeroed rates", async () => {
    const result = await getExecutionAnalytics();
    expect(result.status).toBe(200);
    const { analytics } = result.body;
    expect(analytics.tasks.total).toBe(0);
    expect(analytics.blockers.total).toBe(0);
    expect(analytics.projects).toBe(0);
    expect(analytics.completionRate).toBe(0);
    expect(analytics.carryoverRate).toBe(0);
    expect(analytics.blockerRate).toBe(0);
    expect(analytics.avgResolutionHours).toBe(0);
    expect(analytics.weeklyProductivity).toEqual([]);
  });

  test("derives the rates, the average hours and the productivity series", async () => {
    models.getTaskStatusStats.mockResolvedValue({
      rows: [
        {
          total: 10,
          completed: 5,
          in_progress: 2,
          blocked: 1,
          carried_over: 2,
          pending: 0,
        },
      ],
    });
    models.getBlockerStatusStats.mockResolvedValue({
      rows: [{ total: 4, active: 1, resolved: 3 }],
    });
    models.getSubmittedReportCountsByWeek.mockResolvedValue({
      rows: [{ standups: 3, retros: 2 }],
    });
    models.getV2ProjectCount.mockResolvedValue({ rows: [{ total: 7 }] });
    models.getDistinctTaskUserCount.mockResolvedValue({ rows: [{ count: 6 }] });
    models.getAvgBlockerResolutionSeconds.mockResolvedValue({
      rows: [{ avg_seconds: 7200 }],
    });
    models.getWeeklyProductivityStats.mockResolvedValue({
      rows: [{ week: 1, count: 4 }],
    });

    const { analytics } = (await getExecutionAnalytics()).body;
    expect(analytics.completionRate).toBe(50);
    expect(analytics.carryoverRate).toBe(20);
    expect(analytics.blockerRate).toBe(25);
    expect(analytics.avgResolutionHours).toBe(2);
    expect(analytics.projects).toBe(7);
    expect(analytics.activeUsers).toBe(6);
    expect(analytics.reports).toEqual({ standups: 3, retros: 2 });
    expect(analytics.weeklyProductivity).toHaveLength(1);
  });
});

describe("listUserAnalytics", () => {
  const withUsers = () => {
    models.getTaskProjectUserOptions.mockResolvedValue({
      rows: [
        { id: "U1", name: "Ann" },
        { id: "U2", name: null },
      ],
    });
    models.getTaskAggregatesForUsers.mockResolvedValue({
      rows: [
        {
          uid: "U1",
          total: 4,
          completed: 2,
          in_progress: 1,
          blocked: 0,
          carried_over: 1,
          pending: 0,
        },
      ],
    });
    models.getBlockerAggregatesForUsers.mockResolvedValue({
      rows: [{ uid: "U1", total: 1, active: 0 }],
    });
    models.getUserProjectCounts.mockResolvedValue({
      rows: [{ uid: "U1", count: 2 }],
    });
    models.getUserIndependentTaskCounts.mockResolvedValue({
      rows: [{ uid: "U1", count: 3 }],
    });
    models.getUserReportCompliance.mockResolvedValue({
      rows: [{ uid: "U1", standups: 2, retros: 1 }],
    });
  };

  test("no users yields an empty list and runs no aggregation", async () => {
    const result = await listUserAnalytics(null);
    expect(result.body.users).toEqual([]);
    expect(models.getTaskAggregatesForUsers).not.toHaveBeenCalled();
  });

  test("computes per-user rates and falls back the name to the id", async () => {
    withUsers();
    const { users } = (await listUserAnalytics(null)).body;

    const ann = users.find((user) => user.id === "U1");
    expect(ann.completionRate).toBe(50);
    expect(ann.carryoverRate).toBe(25);
    expect(ann.complianceScore).toBe(3);
    expect(ann.projects).toBe(2);
    expect(ann.independentTasks).toBe(3);

    const unknown = users.find((user) => user.id === "U2");
    expect(unknown.name).toBe("U2");
    expect(unknown.tasks.total).toBe(0);
    expect(unknown.completionRate).toBe(0);
    expect(unknown.complianceScore).toBe(0);
  });

  test("a user_id filter narrows the roster before aggregating", async () => {
    withUsers();
    const { users } = (await listUserAnalytics("U1")).body;
    expect(users).toHaveLength(1);
    expect(users[0].id).toBe("U1");
  });
});
