/**
 * Unit tests for the Intelligence aggregation engine (src/models/intelligence.js).
 * Verifies orchestrator merging, SQL routing per pillar, derived rates and
 * fallbacks (?? 0) when tables are empty.
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    execute: jest.fn(async ({ sql }) => {
      if (sql.includes("FROM ventures")) return { rows: [{ total: 12 }] };
      if (sql.includes("FROM venture_milestones")) return { rows: [{ overdue: 3 }] };
      if (sql.includes("FROM investment_assessments"))
        return {
          rows: [
            {
              assessed: 7,
              avg_score: 54,
              not_ready: 2,
              early_ready: 2,
              investment_ready: 2,
              fundraising_ready: 1,
            },
          ],
        };
      if (sql.includes("FROM investment_pipeline") && sql.includes("GROUP BY stage"))
        return { rows: [{ stage: "invested", count: 2 }, { stage: "screening", count: 5 }] };
      if (sql.includes("FROM fundraising_campaigns"))
        return { rows: [{ total_sought: 100, total_raised: 40, total_committed: 20 }] };
      if (sql.includes("FROM relationship_workspaces"))
        return { rows: [{ active_relationships: 4, total_invested: 2 }] };
      if (sql.includes("FROM v2_submissions"))
        return { rows: [{ pid: "p1", submitters: 8, submission_count: 20, approved_count: 12 }] };
      if (sql.includes("FROM participant_programs"))
        return { rows: [{ pid: "p1", participants: 10 }] };
      if (sql.includes("FROM v2_document_requirements"))
        return { rows: [{ pid: "p1", deliverables: 3 }] };
      if (sql.includes("FROM v2_invitations"))
        return { rows: [{ invited: 10, activated: 4 }] };
      if (sql.includes("created_at >= NOW() - INTERVAL '30 days'"))
        return { rows: [{ created_last_30d: 3 }] };
      if (sql.includes("to_char(created_at"))
        return { rows: [{ month: "2026-08", created: 2 }, { month: "2026-09", created: 1 }] };
      if (sql.includes("COUNT(*)::int AS total")) return { rows: [{ total: 50 }] };
      return { rows: [] };
    }),
  },
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/models/adminOps", () => ({
  getTaskStatusStats: jest.fn().mockResolvedValue({
    rows: [{ total: 100, completed: 30, in_progress: 20, blocked: 5, carried_over: 10, pending: 35 }],
  }),
  getBlockerStatusStats: jest.fn().mockResolvedValue({
    rows: [{ total: 8, active: 3, resolved: 5 }],
  }),
  getSubmittedReportCountsByWeek: jest.fn().mockResolvedValue({
    rows: [{ standups: 7, retros: 5 }],
  }),
  getAvgBlockerResolutionSeconds: jest.fn().mockResolvedValue({
    rows: [{ avg_seconds: 5400 }],
  }),
  countActiveV2Programs: jest.fn().mockResolvedValue({ rows: [{ count: 3 }] }),
  countParticipantContacts: jest.fn().mockResolvedValue({ rows: [{ count: 40 }] }),
  countStaffContacts: jest.fn().mockResolvedValue({ rows: [{ count: 10 }] }),
}));

jest.mock("@/models/dashboard", () => ({
  getProgramKpiSummary: jest.fn().mockResolvedValue({
    rows: [{ id: "p1", name: "Incubation", status: "active", avg_kpi_rate: 80, kpi_count: 6 }],
  }),
}));

const {
  getVentureMetrics,
  getInvestorMetrics,
  getProgramMetrics,
  getOperationsMetrics,
  getContactMetrics,
  getIntelligenceMetrics,
} = require("@/models/intelligence");

describe("getVentureMetrics", () => {
  test("aggregates total, overdue milestones and readiness", async () => {
    const res = await getVentureMetrics();
    expect(res.total_ventures).toBe(12);
    expect(res.overdue_milestones).toBe(3);
    expect(res.readiness.assessed).toBe(7);
    expect(res.readiness.unassessed).toBe(5);
    expect(res.readiness.avg_score).toBe(54);
    expect(res.readiness.by_level.fundraising_ready).toBe(1);
  });
});

describe("getInvestorMetrics", () => {
  test("returns pipeline distribution and fundraising sums", async () => {
    const res = await getInvestorMetrics();
    expect(res.pipeline).toHaveLength(2);
    expect(res.pipeline[0].stage).toBe("invested");
    expect(res.fundraising.total_sought).toBe(100);
    expect(res.fundraising.total_committed).toBe(20);
    expect(res.relationships.active_relationships).toBe(4);
  });
});

describe("getProgramMetrics", () => {
  test("merges KPI summary with engagement, submission rate and health", async () => {
    const res = await getProgramMetrics();
    expect(res.active_programs).toBe(3);
    expect(res.staff).toBe(10);
    expect(res.participants).toBe(40);
    const kp = res.kpis[0];
    expect(kp.avg_kpi_rate).toBe(80);
    expect(kp.participants).toBe(10);
    expect(kp.submitters).toBe(8);
    expect(kp.engagement_rate).toBe(80);
    expect(kp.expected_submissions).toBe(30);
    expect(kp.submission_rate).toBe(40);
    expect(kp.health_score).toBe(80);
    expect(kp.health_status).toBe("on_track");
  });

  test("flags a critical program when execution and engagement collapse", async () => {
    require("@/models/dashboard").getProgramKpiSummary.mockResolvedValueOnce({
      rows: [{ id: "p1", name: "Incubation", status: "active", avg_kpi_rate: 20, kpi_count: 2 }],
    });
    require("@/lib/db").default.execute.mockImplementationOnce(async () =>
      Promise.resolve({ rows: [{ pid: "p1", submitters: 1, submission_count: 2, approved_count: 1 }] }),
    );
    require("@/lib/db").default.execute.mockImplementationOnce(async () =>
      Promise.resolve({ rows: [{ pid: "p1", participants: 10 }] }),
    );
    require("@/lib/db").default.execute.mockImplementationOnce(async () =>
      Promise.resolve({ rows: [{ pid: "p1", deliverables: 4 }] }),
    );
    const res = await getProgramMetrics();
    const kp = res.kpis[0];
    expect(kp.health_status).toBe("critical");
    expect(kp.health_score).toBeLessThan(50);
  });
});

describe("getOperationsMetrics", () => {
  test("routes through adminOps and computes derived rates", async () => {
    const res = await getOperationsMetrics();
    expect(res.tasks.completed).toBe(30);
    expect(res.blockers.active).toBe(3);
    expect(res.completion_rate).toBe(30);
    expect(res.carryover_rate).toBe(10);
    expect(res.avg_blocker_seconds).toBe(5400);
    expect(res.report_compliance.staff).toBe(10);
    expect(res.report_compliance.standup_rate).toBe(70);
    expect(res.report_compliance.retro_rate).toBe(50);
  });
});

describe("getContactMetrics", () => {
  test("computes invitation activation funnel and base growth", async () => {
    const res = await getContactMetrics();
    expect(res.invitations.invited).toBe(10);
    expect(res.invitations.activated).toBe(4);
    expect(res.invitations.activation_rate).toBe(40);
    expect(res.growth.total).toBe(50);
    expect(res.growth.created_last_30d).toBe(3);
    expect(res.growth.monthly).toHaveLength(2);
  });
});

describe("getIntelligenceMetrics", () => {
  test("orchestrates all pillars", async () => {
    const res = await getIntelligenceMetrics();
    expect(res.ventures.total_ventures).toBe(12);
    expect(res.investor.fundraising.total_raised).toBe(40);
    expect(res.programs.active_programs).toBe(3);
    expect(res.operations.tasks.total).toBe(100);
    expect(res.operations.completion_rate).toBe(30);
    expect(res.contacts.invitations.activation_rate).toBe(40);
  });
});