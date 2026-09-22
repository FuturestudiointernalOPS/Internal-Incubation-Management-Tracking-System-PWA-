/**
 * THE PORTFOLIO VIEW — every journey report across every Venture.
 *
 * Two things this file guards beyond the happy path:
 *
 * 1. ACCESS. This endpoint crosses Venture boundaries, so it is global-roles
 *    only. `roleIsPrivileged` would have been the convenient helper — and would
 *    have been WRONG, because it also admits staff and program managers. A
 *    staff member must be refused.
 *
 * 2. THE TWO `ventures` GENERATIONS. The older table carries `company_name`, the
 *    newer one `name`, and the row also carries its own `status` — which would
 *    silently overwrite a report's status. The model aliases the report columns
 *    and resolves the display name in JS; both are asserted here.
 */
const executed = [];

const mockDb = {
  execute: jest.fn(async ({ sql, args = [] }) => {
    executed.push({ sql, args });
    // The portfolio list only — the missing-report query ALSO reads this table
    // (through its NOT EXISTS), so it must not be caught here.
    if (sql.includes("FROM venture_reports r") && !sql.includes("NOT EXISTS")) {
      return {
        rows: [
          {
            report_id: 7,
            venture_code: "VNT-A",
            report_title: "Family & Friends — close",
            report_period: "September",
            report_status: "submitted",
            report_kind: "closing",
            report_submitted_at: "2026-09-12",
            report_created_at: "2026-09-12",
            report_journey_stage_id: "J-1",
            journey_name: "Family & Friends",
            // The older generation's name column — there is no `name`.
            company_name: "AgriNova",
            // The venture's OWN status. Must never win over report_status.
            status: "active",
          },
        ],
      };
    }
    if (sql.includes("FROM venture_journey_stages s")) {
      return {
        rows: [
          { journey_id: "J-2", journey_name: "Go-To-Market", completed_at: "2026-09-01", venture_id: "VNT-B", name: "HealthTech" },
        ],
      };
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
  getSession: jest.fn().mockResolvedValue({ cid: "sa-1", name: "Super", role: "super_admin" }),
  requireAuth: jest.fn().mockResolvedValue(null),
}));

const { GET } = require("@/app/api/journey-reports/route");
const req = (qs = "") => new Request(`http://localhost/api/journey-reports${qs}`);
const readJson = async (res) => res.json();

beforeEach(() => {
  executed.length = 0;
  require("@/lib/auth").getSession.mockResolvedValue({ cid: "sa-1", name: "Super", role: "super_admin" });
});

describe("GET /api/journey-reports — the portfolio", () => {
  test("a global role sees every report with its Venture and Journey named", async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    const data = await readJson(res);

    expect(data.reports).toHaveLength(1);
    const [report] = data.reports;
    expect(report).toMatchObject({
      id: 7,
      venture_name: "AgriNova", // from `company_name`, the older generation's column
      journey_name: "Family & Friends",
      report_kind: "closing",
      title: "Family & Friends — close",
    });
    // The report's OWN status, not the Venture's.
    expect(report.status).toBe("submitted");
  });

  test("it also reports the journeys that closed without a closing report", async () => {
    const data = await readJson(await GET(req()));
    expect(data.journeys_missing_report).toHaveLength(1);
    expect(data.journeys_missing_report[0]).toMatchObject({
      journey_name: "Go-To-Market",
      venture_name: "HealthTech",
      venture_code: "VNT-B",
    });
  });

  test("the status filter reaches the query", async () => {
    await GET(req("?status=submitted"));
    const q = executed.find((x) => x.sql.includes("FROM venture_reports r"));
    expect(q.sql).toContain("WHERE r.status = ?");
    expect(q.args).toContain("submitted");
  });

  test("without a filter, every status is listed", async () => {
    await GET(req());
    const q = executed.find((x) => x.sql.includes("FROM venture_reports r"));
    expect(q.sql).not.toContain("WHERE r.status = ?");
  });
});

describe("it crosses Venture boundaries, so a Venture assignment is not enough", () => {
  test("staff are refused and nothing is read", async () => {
    require("@/lib/auth").getSession.mockResolvedValueOnce({ cid: "staff-1", role: "staff" });
    const res = await GET(req());
    expect(res.status).toBe(403);
    expect(executed).toHaveLength(0);
  });

  test("a program manager is refused too", async () => {
    require("@/lib/auth").getSession.mockResolvedValueOnce({ cid: "pm-1", role: "program_manager" });
    expect((await GET(req())).status).toBe(403);
  });

  test("an unauthenticated request reads nothing", async () => {
    require("@/lib/auth").getSession.mockResolvedValueOnce(null);
    expect((await GET(req())).status).toBe(404);
    expect(executed).toHaveLength(0);
  });

  test("the retired developer role is refused (no longer a global role)", async () => {
    require("@/lib/auth").getSession.mockResolvedValueOnce({ cid: "dev-1", role: "developer" });
    expect((await GET(req())).status).toBe(403);
  });
});
