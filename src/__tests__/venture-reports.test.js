/**
 * Contract tests — Venture Progress Reports (Vinance 3, Phase 3).
 *
 * Guards: Manager can compose & submit (operating_plan manage); staff with
 * assignment can read; founders denied; reports record institutional memory.
 */

const executed = [];
const VENTURE_DB_ID = "11111111-1111-4111-8111-111111111111";

const mockDb = {
  execute: jest.fn(async ({ sql, args = [] }) => {
    executed.push({ sql, args });
    if (sql.includes("SELECT venture_id FROM ventures WHERE id::text")) return { rows: [{ venture_id: "VNT-TEST" }] };
    if (sql.includes("INSERT INTO venture_reports")) return { rows: [{ id: 1 }] };
    if (sql.includes("FROM venture_reports WHERE venture_id = ?") && !sql.includes("WHERE id = ?")) {
      return { rows: [{ id: 1, title: "September", status: "submitted" }] };
    }
    if (sql.includes("FROM venture_reports WHERE id = ? AND venture_id = ?")) return { rows: [{ id: 1, title: "September", status: "submitted" }] };
    if (sql.includes("UPDATE venture_reports SET")) return { rows: [] };
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
  resolvePlanAccess: jest.fn().mockResolvedValue({ ok: true, global: false, code: "VNT-TEST", assignments: [{ responsibility_code: "lead_manager", scope_type: "venture_wide" }] }),
  allowsPlanAction: jest.fn().mockResolvedValue(true),
  resolveVentureCode: jest.fn(async () => "VNT-TEST"),
}));

jest.mock("@/lib/ventureAuth", () => ({
  isStaffActorForVenture: jest.fn().mockResolvedValue(true),
  roleIsPrivileged: jest.requireActual("@/lib/ventureAuth").roleIsPrivileged,
}));

jest.mock("@/lib/ventures", () => ({
  addVentureHistory: jest.fn().mockResolvedValue(true),
}));

const { GET, POST, PATCH } = require("@/app/api/ventures/[id]/progress-reports/route");
const readJson = async (res) => res.json();
const ctx = { params: { id: VENTURE_DB_ID } };

beforeEach(() => {
  executed.length = 0;
  jest.clearAllMocks();
});

describe("Venture Progress Reports", () => {
  test("Manager composes a report (structure persisted, history recorded)", async () => {
    const res = await POST(
      new Request("http://localhost/x", {
        method: "POST",
        body: JSON.stringify({
          title: "September progress",
          reporting_period: "September",
          current_journey: "Family & Friends",
          current_milestone: "Customer Validation",
          completed_items: ["Pitch Deck", "Business Plan"],
          outstanding_items: ["Validation Report"],
          support_delivered: "3 sessions",
          challenges: "Pricing remains unclear",
          recommendation: "Continue GTM support",
        }),
      }),
      ctx,
    );
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.success).toBe(true);
    expect(data.id).toBe(1);

    const insert = executed.find((q) => q.sql.includes("INSERT INTO venture_reports"));
    expect(insert).toBeDefined();
    expect(insert.args[0]).toBe("VNT-TEST");
    expect(JSON.parse(insert.args[6])).toEqual(["Pitch Deck", "Business Plan"]);
    expect(JSON.parse(insert.args[7])).toEqual(["Validation Report"]);

    const { addVentureHistory } = require("@/lib/ventures");
    expect(addVentureHistory).toHaveBeenCalledWith(expect.objectContaining({ event_type: "VENTURE_REPORT_CREATED" }));
  });

  test("Manager submits the report (submitted_at stamped)", async () => {
    const res = await PATCH(new Request("http://localhost/x", { method: "PATCH", body: JSON.stringify({ id: 1, status: "submitted" }) }), ctx);
    expect(res.status).toBe(200);
    const update = executed.find((q) => q.sql.includes("UPDATE venture_reports SET"));
    expect(update.sql).toContain("submitted_at = COALESCE(submitted_at, NOW())");
  });

  test("staff with assignment can list reports", async () => {
    const res = await GET(new Request("http://localhost/api/ventures/VNT-TEST/progress-reports"), ctx);
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.reports.length).toBe(1);
  });

  test("founders are denied (no staff actor)", async () => {
    require("@/lib/auth").getSession.mockResolvedValueOnce({ cid: "founder-1", role: "founder" });
    require("@/lib/ventureAuth").isStaffActorForVenture.mockResolvedValueOnce(false);
    const res = await GET(new Request("http://localhost/api/ventures/VNT-TEST/progress-reports"), ctx);
    expect(res.status).toBe(403);
  });
});
