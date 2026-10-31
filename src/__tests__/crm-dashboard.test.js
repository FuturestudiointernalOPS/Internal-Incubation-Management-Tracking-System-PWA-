/**
 * CRM — the action dashboard composition (Lot 2, first slice).
 *
 * The SQL is asserted at the service boundary through mocked reads: what a team
 * sees depends on these counts and on currencies never being summed together.
 */

jest.mock("@/models/crm/dashboard", () => ({
  getCrmDashboardCounts: jest.fn(),
  getCrmOverdueNextActions: jest.fn(),
  getCrmStaleOpportunities: jest.fn(),
  getCrmStuckOpportunities: jest.fn(),
  getCrmPipelineValueByCurrency: jest.fn(),
  getCrmPerformance: jest.fn(),
}));

const {
  getCrmDashboardCounts,
  getCrmOverdueNextActions,
  getCrmStaleOpportunities,
  getCrmStuckOpportunities,
  getCrmPipelineValueByCurrency,
  getCrmPerformance,
} = require("@/models/crm/dashboard");
const {
  getCrmDashboard,
  STALE_AFTER_DAYS,
  CONVERSION_WINDOW_DAYS,
  CLOSE_SOON_DAYS,
  PERFORMANCE_WINDOW_DAYS,
} = require("@/services/crm/dashboard");

beforeEach(() => {
  jest.clearAllMocks();
  getCrmOverdueNextActions.mockResolvedValue({ rows: [] });
  getCrmStaleOpportunities.mockResolvedValue({ rows: [] });
  getCrmStuckOpportunities.mockResolvedValue({ rows: [] });
  getCrmPipelineValueByCurrency.mockResolvedValue({ rows: [] });
  getCrmPerformance.mockResolvedValue({ rows: [] });
});

test("the dashboard windows live in one named place", () => {
  expect(STALE_AFTER_DAYS).toBe(14);
  expect(CONVERSION_WINDOW_DAYS).toBe(90);
  expect(CLOSE_SOON_DAYS).toBe(30);
  expect(PERFORMANCE_WINDOW_DAYS).toBe(30);
});

test("counts add leads and opportunities, and read text numbers as numbers", async () => {
  getCrmDashboardCounts.mockResolvedValue({
    rows: [{
      overdue_leads: "2",
      overdue_opportunities: 3,
      soon_leads: 1,
      soon_opportunities: "4",
      today_leads: "3",
      today_opportunities: 5,
      meetings_today: "2",
      tasks_today: 4,
      awaiting_qualification: "5",
      stale_opportunities: 6,
      stuck_opportunities: "1",
      approaching_close: "7",
      new_leads_30: "8",
      qualified_leads_30: 3,
    }],
  });

  const result = await getCrmDashboard();

  expect(result.counts).toEqual({
    overdue: 5,
    dueToday: 8,
    dueSoon: 5,
    meetingsToday: 2,
    tasksToday: 4,
    awaitingQualification: 5,
    stale: 6,
    stuck: 1,
    approachingClose: 7,
  });
  expect(result.staleAfterDays).toBe(14);
  expect(result.closeSoonDays).toBe(30);
  expect(result.performance.newLeads).toBe(8);
  expect(result.performance.qualifiedLeads).toBe(3);
});

test("an empty counts row reads as zero everywhere", async () => {
  getCrmDashboardCounts.mockResolvedValue({ rows: [] });

  const result = await getCrmDashboard();

  expect(result.counts).toEqual({
    overdue: 0,
    dueToday: 0,
    dueSoon: 0,
    meetingsToday: 0,
    tasksToday: 0,
    awaitingQualification: 0,
    stale: 0,
    stuck: 0,
    approachingClose: 0,
  });
  expect(result.performance.newLeads).toBe(0);
  expect(result.performance.qualifiedLeads).toBe(0);
});

test("pipeline values keep each currency on its own line and drop empty pipelines", async () => {
  getCrmDashboardCounts.mockResolvedValue({ rows: [{}] });
  getCrmPipelineValueByCurrency.mockResolvedValue({
    rows: [
      { id: "p-1", name: "Partnerships", currency: "XOF", value: "12000000", opportunity_count: "2" },
      { id: "p-1", name: "Partnerships", currency: "EUR", value: "5000", opportunity_count: "1" },
      { id: "p-2", name: "Sponsorships", currency: null, value: "0", opportunity_count: "0" },
    ],
  });

  const result = await getCrmDashboard();

  expect(result.pipelines).toEqual([
    {
      id: "p-1",
      name: "Partnerships",
      values: [
        { currency: "XOF", value: 12000000 },
        { currency: "EUR", value: 5000 },
      ],
      opportunityCount: 3,
    },
  ]);
});

test("the overdue and dormant lists are returned as read", async () => {
  getCrmDashboardCounts.mockResolvedValue({ rows: [{}] });
  const overdue = [{ kind: "lead", id: "l-1", title: "MTN", next_action: "Call back", due: "2026-10-01" }];
  const stale = [{ id: "o-1", name: "Moov", last_activity_at: "2026-09-01" }];
  getCrmOverdueNextActions.mockResolvedValue({ rows: overdue });
  getCrmStaleOpportunities.mockResolvedValue({ rows: stale });

  const result = await getCrmDashboard();

  expect(result.overdue).toEqual(overdue);
  expect(result.stale).toEqual(stale);
});

test("stuck opportunities carry numeric days and targets", async () => {
  getCrmDashboardCounts.mockResolvedValue({ rows: [{}] });
  getCrmStuckOpportunities.mockResolvedValue({
    rows: [{
      id: "o-1",
      name: "MTN",
      stage_name: "Proposal",
      target_days: "7",
      days_in_stage: "12",
      owner_name: "Godwin",
    }],
  });

  const result = await getCrmDashboard();

  expect(result.stuck).toEqual([
    expect.objectContaining({ id: "o-1", target_days: 7, days_in_stage: 12 }),
  ]);
});

test("performance counts won and lost, rounds the stage duration, and turns the window into a rate", async () => {
  getCrmDashboardCounts.mockResolvedValue({ rows: [{}] });
  getCrmPerformance.mockResolvedValue({
    rows: [{
      won: "4",
      lost: 2,
      avg_stage_days: "7.26",
      completed_transitions: "12",
      won_90: "3",
      lost_90: "2",
    }],
  });

  const result = await getCrmDashboard();

  expect(result.performance).toEqual({
    windowDays: 30,
    newLeads: 0,
    qualifiedLeads: 0,
    won: 4,
    lost: 2,
    averageStageDays: 7.3,
    completedTransitions: 12,
    conversion: { windowDays: 90, won: 3, lost: 2, rate: 0.6 },
  });
});

test("no completed stage visit and no decision read as no average and no rate", async () => {
  getCrmDashboardCounts.mockResolvedValue({ rows: [{}] });
  getCrmPerformance.mockResolvedValue({
    rows: [{ won: 0, lost: 0, avg_stage_days: null, completed_transitions: 0, won_90: 0, lost_90: 0 }],
  });

  const result = await getCrmDashboard();

  expect(result.performance.averageStageDays).toBeNull();
  expect(result.performance.conversion.rate).toBeNull();
});
