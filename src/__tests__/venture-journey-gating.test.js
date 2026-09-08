/**
 * Contract test — GET /api/ventures/[id]/journey guided visibility
 * (Vinance 3, Phase 2).
 *
 * Guards the Venture-perspective rule:
 *   - founders / team / participant viewers receive ONLY non-locked stages
 *     (the future roadmap is management strategy, not Venture-facing data)
 *   - staff and global roles keep receiving the FULL roadmap (authoring
 *     surfaces and dashboards are unchanged)
 *   - the response shape stays stable for both audiences
 */

const executed = [];
const VENTURE_DB_ID = "11111111-1111-4111-8111-111111111111";

const STAGES_FIXTURE = [
  { id: "s1", name: "Family & Friends", description: null, objective: null, target_date: null, stage_order: 1, status: "completed", completed_at: null, created_at: null },
  { id: "s2", name: "GTM", description: null, objective: null, target_date: null, stage_order: 2, status: "active", completed_at: null, created_at: null },
  { id: "s3", name: "Investment Prep", description: null, objective: null, target_date: null, stage_order: 3, status: "locked", completed_at: null, created_at: null },
];

const mockDb = {
  execute: jest.fn(async ({ sql, args = [] }) => {
    executed.push({ sql, args });
    if (sql.startsWith("CREATE TABLE IF NOT EXISTS venture_journey_stages")) return { rows: [] };
    if (sql.includes("FROM ventures WHERE id::text")) return { rows: [{ id: VENTURE_DB_ID }] };
    if (sql.includes("FROM venture_journey_stages") && sql.includes("ORDER BY stage_order ASC")) {
      return { rows: STAGES_FIXTURE };
    }
    return { rows: [] };
  }),
};

const mockAuth = {
  getSession: jest.fn(),
};

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: mockDb,
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(() => mockAuth.getSession()),
}));

jest.mock("@/lib/ventureAuth", () => ({
  requireVentureAccess: jest.fn().mockResolvedValue({ session: { cid: "member-1", name: "Founder", role: "founder" } }),
  roleIsPrivileged: jest.requireActual("@/lib/ventureAuth").roleIsPrivileged,
}));

jest.mock("@/lib/ventureOperatingPlans", () => ({
  resolvePlanAccess: jest.fn().mockResolvedValue({ ok: false }),
  allowsPlanAction: jest.fn().mockResolvedValue(false),
}));

const { GET } = require("@/app/api/ventures/[id]/journey/route");

const readJson = async (res) => res.json();

beforeEach(() => {
  executed.length = 0;
  jest.clearAllMocks();
  mockAuth.getSession.mockReset();
  mockAuth.getSession.mockResolvedValue({ cid: "member-1", role: "founder" });
});

describe("GET /api/ventures/[id]/journey — guided visibility", () => {
  test("founder viewers receive only active/completed stages (locked roadmap hidden)", async () => {
    const res = await GET(new Request("http://localhost/api/ventures/VNT-1/journey"), { params: { id: VENTURE_DB_ID } });
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.success).toBe(true);
    expect(data.guided).toBe(true);
    const statuses = (data.stages || []).map((s) => s.status);
    expect(statuses).toContain("active");
    expect(statuses).toContain("completed");
    expect(statuses).not.toContain("locked");
    expect(data.stages.length).toBe(2);
  });

  test("staff viewers keep receiving the full roadmap (locked included)", async () => {
    mockAuth.getSession.mockResolvedValue({ cid: "staff-1", role: "super_admin" });
    require("@/lib/ventureOperatingPlans").resolvePlanAccess.mockResolvedValue({ ok: true, global: true });
    require("@/lib/ventureOperatingPlans").allowsPlanAction.mockResolvedValue(true);

    const res = await GET(new Request("http://localhost/api/ventures/VNT-1/journey"), { params: { id: VENTURE_DB_ID } });
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.success).toBe(true);
    expect(data.stages.length).toBe(3);
    expect(data.stages.map((s) => s.status)).toContain("locked");
    expect(data.access).toEqual({ create: true, edit: true, manage: true });
  });
});
