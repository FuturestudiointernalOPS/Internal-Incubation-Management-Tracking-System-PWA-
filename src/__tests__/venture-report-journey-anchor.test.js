/**
 * A REPORT BELONGS TO A JOURNEY (Phase 2, slice 1).
 *
 * The report engine existed and worked, but a report could not be tied to the
 * thing it reports on: `current_journey` is free text, so "every journey needs a
 * report" could never be queried — only believed. This locks the anchor and the
 * two kinds:
 *
 *   progress — an interim report, any time, any number of them;
 *   closing  — the journey's final report.
 *
 * And the rule that keeps the automatic close intact: nothing is BLOCKED on the
 * report. Journeys close when their milestones complete; a journey that closed
 * without its closing report is VISIBLE through the gap view, not prevented.
 */
const executed = [];
const VENTURE_DB_ID = "11111111-1111-4111-8111-111111111111";
const JOURNEY_ID = "22222222-2222-4222-8222-222222222222";

const mockDb = {
  execute: jest.fn(async ({ sql, args = [] }) => {
    executed.push({ sql, args });
    if (sql.includes("SELECT venture_id FROM ventures WHERE id::text")) return { rows: [{ venture_id: "VNT-TEST" }] };
    // The helper resolves the Venture's INTERNAL id; the route's other lookups
    // use the `OR id::text` form, so they must not be caught here.
    if (sql.includes("SELECT id FROM ventures WHERE venture_id = ?") && !sql.includes("OR id::text")) {
      return { rows: [{ id: VENTURE_DB_ID }] };
    }
    if (sql.includes("INSERT INTO venture_reports")) return { rows: [{ id: 1 }] };
    if (sql.includes("FROM venture_journey_stages s")) {
      return { rows: [{ id: JOURNEY_ID, name: "Family & Friends", stage_order: 1, completed_at: "2026-09-01" }] };
    }
    if (sql.includes("FROM venture_reports WHERE venture_id = ?")) {
      return { rows: [{ id: 1, title: "September", status: "submitted" }] };
    }
    return { rows: [] };
  }),
};

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: mockDb,
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn().mockResolvedValue({ cid: "manager-1", name: "David", role: "staff" }),
  requireAuth: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/lib/ventureOperatingPlans", () => ({
  resolvePlanAccess: jest.fn().mockResolvedValue({
    ok: true,
    global: false,
    code: "VNT-TEST",
    assignments: [{ responsibility_code: "lead_manager", scope_type: "venture_wide" }],
  }),
  allowsPlanAction: jest.fn().mockResolvedValue(true),
  resolveVentureCode: jest.fn(async () => "VNT-TEST"),
}));

jest.mock("@/lib/ventureAuth", () => ({
  isStaffActorForVenture: jest.fn().mockResolvedValue(true),
  roleIsPrivileged: jest.requireActual("@/lib/ventureAuth").roleIsPrivileged,
}));

jest.mock("@/lib/ventures", () => ({ addVentureHistory: jest.fn().mockResolvedValue(true) }));

const { GET, POST } = require("@/app/api/ventures/[id]/progress-reports/route");
const ctx = { params: { id: VENTURE_DB_ID } };

const postReq = (body) =>
  new Request("http://localhost/api/ventures/VNT-TEST/progress-reports", {
    method: "POST",
    body: JSON.stringify(body),
  });

const getReq = (qs = "") =>
  new Request(`http://localhost/api/ventures/VNT-TEST/progress-reports${qs}`);

const insertOf = () => executed.find((q) => q.sql.includes("INSERT INTO venture_reports"));

beforeEach(() => {
  executed.length = 0;
});

describe("a report carries its journey and its kind", () => {
  test("a journey-anchored closing report stores the reference and the kind", async () => {
    const res = await POST(postReq({ title: "Family & Friends — close", journey_stage_id: JOURNEY_ID, report_kind: "closing" }), ctx);
    expect(res.status).toBe(200);
    const insert = insertOf();
    expect(insert).toBeDefined();
    expect(insert.args[11]).toBe(JOURNEY_ID);
    expect(insert.args[12]).toBe("closing");
    expect(insert.sql).toContain("journey_stage_id");
    expect(insert.sql).toContain("report_kind");
  });

  test("a report with no kind is an interim one, never refused", async () => {
    const res = await POST(postReq({ title: "Mid-journey check-in", journey_stage_id: JOURNEY_ID }), ctx);
    expect(res.status).toBe(200);
    expect(insertOf().args[12]).toBe("progress");
  });

  test("an unknown kind is refused rather than stored", async () => {
    const res = await POST(postReq({ title: "Report", report_kind: "final" }), ctx);
    expect(res.status).toBe(400);
    expect(insertOf()).toBeUndefined();
  });
});

describe("reading reports by journey", () => {
  test("the journey filter reaches the query", async () => {
    const res = await GET(getReq(`?journey_stage_id=${JOURNEY_ID}`), ctx);
    expect(res.status).toBe(200);
    const list = executed.find((q) => q.sql.includes("FROM venture_reports WHERE venture_id = ?"));
    expect(list.sql).toContain("journey_stage_id = ?");
    expect(list.args).toContain(JOURNEY_ID);
  });

  test("without a filter, every report is listed as before", async () => {
    const res = await GET(getReq(), ctx);
    expect(res.status).toBe(200);
    const list = executed.find((q) => q.sql.includes("FROM venture_reports WHERE venture_id = ?"));
    expect(list.sql).not.toContain("journey_stage_id = ?");
  });
});

describe("the gap view — closed journeys without their closing report", () => {
  test("lists the journeys that closed without one", async () => {
    const res = await GET(getReq("?missing_reports=1"), ctx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.journeys_missing_report).toHaveLength(1);
    expect(data.journeys_missing_report[0].name).toBe("Family & Friends");
  });

  test("it asks the database the right question: completed AND no closing report", async () => {
    await GET(getReq("?missing_reports=1"), ctx);
    const q = executed.find((x) => x.sql.includes("FROM venture_journey_stages s"));
    expect(q).toBeDefined();
    expect(q.sql).toContain("s.status = 'completed'");
    expect(q.sql).toContain("NOT EXISTS");
    expect(q.sql).toContain("report_kind = 'closing'");
    // Scoped by the Venture's INTERNAL id, which is what the journey table uses.
    expect(q.args).toEqual([VENTURE_DB_ID]);
  });

  test("a Venture that cannot be resolved returns an empty list, never an error", async () => {
    mockDb.execute.mockImplementationOnce(async () => ({ rows: [] })); // the ventures lookup
    const res = await GET(getReq("?missing_reports=1"), ctx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.journeys_missing_report).toEqual([]);
  });
});
