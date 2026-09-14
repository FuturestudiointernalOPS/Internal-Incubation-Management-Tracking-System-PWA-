/**
 * Contract test — the operating report counts deliverables awaiting review.
 *
 * Guards item A5: `deliverables_awaiting_review` is additive (every previous
 * journey_report field keeps its shape/position) and is derived live from the
 * Venture's `venture_deliverables` rows whose status is still 'submitted'.
 */

const executed = [];

const mockVentureId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const mockDbId = "11111111-1111-4111-8111-111111111111";

// Mutable per test so we can drive what the deliverables query returns.
let mockDeliverables = [];

const mockDb = {
  execute: jest.fn(async ({ sql, args = [] }) => {
    executed.push({ sql, args });
    if (sql.includes("SELECT id FROM ventures")) return { rows: [{ id: mockDbId }] };
    if (sql.includes("FROM venture_task_submissions")) return { rows: [] };
    if (sql.includes("FROM venture_tasks WHERE venture_id")) return { rows: [] };
    if (sql.includes("FROM venture_journey_stages")) {
      return { rows: [{ id: "s1", name: "Validation", status: "active", stage_order: 1, target_date: null, completed_at: null }] };
    }
    if (sql.includes("FROM venture_milestones")) return { rows: [{ journey_stage_id: "s1", status: "under_review" }] };
    if (sql.includes("FROM venture_sessions")) return { rows: [] };
    if (sql.includes("FROM venture_staff_assignments")) return { rows: [] };
    if (sql.includes("FROM venture_deliverables")) {
      // Mirror the SQL filter so the assertion compares like for like.
      const onlySubmitted = sql.includes("status = 'submitted'");
      return { rows: onlySubmitted ? mockDeliverables.filter((d) => d.status === "submitted") : mockDeliverables };
    }
    return { rows: [] };
  }),
};

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: mockDb,
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/lib/ventureAuth", () => ({
  requireVentureAccess: jest.fn().mockResolvedValue({ session: { cid: "sa-1", role: "super_admin" } }),
  roleIsPrivileged: jest.fn().mockReturnValue(true),
  isStaffActorForVenture: jest.fn().mockResolvedValue(true),
}));

const { GET } = require("@/app/api/ventures/[id]/journey-report/route");
const ctx = { params: { id: mockVentureId } };

const fetchReport = async () => {
  const res = await GET(new Request(`http://localhost/api/ventures/${mockVentureId}/journey-report`), ctx);
  expect(res.status).toBe(200);
  return (await res.json()).journey_report;
};

const deliverablesQuery = () => executed.find((e) => e.sql.includes("FROM venture_deliverables"));

beforeEach(() => {
  executed.length = 0;
  mockDeliverables = [
    { status: "submitted" },
    { status: "submitted" },
    { status: "approved" },
    { status: "in_progress" },
  ];
});

describe("GET /api/ventures/[id]/journey-report — deliverables awaiting review", () => {
  test("counts exactly the 'submitted' deliverables returned by the query", async () => {
    const report = await fetchReport();
    const fromQuery = mockDeliverables.filter((d) => d.status === "submitted").length;
    expect(report.deliverables_awaiting_review).toBe(fromQuery);
    expect(report.deliverables_awaiting_review).toBe(2);
  });

  test("scopes the deliverables query to the Venture owners list (code + UUID)", async () => {
    await fetchReport();
    const q = deliverablesQuery();
    expect(q).toBeDefined();
    expect(q.sql).toContain("WHERE venture_id IN (?, ?)");
    expect(q.sql).toContain("status = 'submitted'");
    expect(q.args).toEqual([mockVentureId, mockDbId]);
  });

  test("is additive — the pre-existing report fields are unchanged", async () => {
    const report = await fetchReport();
    expect(Object.keys(report)).toEqual([
      "journey_progression",
      "stages",
      "milestones_by_status",
      "tasks_by_status",
      "task_completion",
      "overdue",
      "submissions",
      "deliverables_awaiting_review",
      "sessions",
      "support",
    ]);
    expect(report.milestones_by_status).toEqual({ under_review: 1 });
    expect(report.submissions).toEqual({ reviewed_total: 0, approved: 0, changes_requested: 0 });
  });

  test("no submitted deliverables → 0 (never undefined)", async () => {
    mockDeliverables = [{ status: "approved" }, { status: "in_progress" }];
    const report = await fetchReport();
    expect(report.deliverables_awaiting_review).toBe(0);
  });
});
