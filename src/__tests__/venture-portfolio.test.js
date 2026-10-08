/**
 * Portfolio overview — the Super Admin's portfolio-wide read.
 *
 * GET /api/admin/ventures/dashboard
 *   → one read across the whole portfolio: Ventures by phase, Ventures by
 *     sector, the distribution across the four investment-readiness levels, and
 *     how many Parcours are running.
 *
 * What is under test is the SHAPING rather than the arithmetic of SQL. Every
 * bucket is reported whether or not anything sits in it, so an empty level
 * still shows its 0 instead of vanishing from the distribution, and the four
 * levels always sum back to `assessed` — itself never larger than the
 * portfolio. Two statements carry invariants those numbers depend on, so their
 * text is asserted as well: readiness keeps exactly one row per Venture, and
 * active Parcours exclude archived stages.
 *
 * The gate is exercised through the REAL requireAuth, with only getSession
 * mocked, so 401 and 403 here are the guard's own answers.
 */

const executed = [];

const FIXTURE = {
  total: 12,
  phases: [
    { phase: "growth", count: 4 },
    { phase: "idea", count: 3 },
    { phase: "", count: 2 },
    { phase: "recovered", count: 1 },
  ],
  sectors: [
    { sector: "AgriTech", count: 5 },
    { sector: "", count: 2 },
  ],
  readiness: [
    { level: "investment_ready", count: 3 },
    { level: "not_ready", count: 2 },
    { level: "invented_band", count: 1 },
  ],
  parcours: 7,
};

const DEFAULT_FIXTURE = JSON.parse(JSON.stringify(FIXTURE));

const mockDb = {
  execute: jest.fn(async ({ sql, args = [] }) => {
    executed.push({ sql, args });
    // Ordered by discriminator, most specific first: three of the five
    // statements could otherwise be matched by a looser FROM clause.
    if (sql.includes("FROM investment_assessments")) return { rows: FIXTURE.readiness };
    if (sql.includes("FROM venture_journey_stages")) return { rows: [{ count: FIXTURE.parcours }] };
    if (sql.includes("GROUP BY business_stage")) return { rows: FIXTURE.phases };
    if (sql.includes("GROUP BY industry")) return { rows: FIXTURE.sectors };
    if (sql.includes("FROM ventures")) return { rows: [{ count: FIXTURE.total }] };
    return { rows: [] };
  }),
};

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: mockDb,
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/server/auth/session", () => ({
  getSession: jest.fn(),
}));

const { GET } = require("@/app/api/admin/ventures/dashboard/route");
const { getSession } = require("@/server/auth/session");

const readJson = async (res) => res.json();
const request = () => new Request("http://localhost/api/admin/ventures/dashboard");

const getAs = async (role) => {
  getSession.mockResolvedValue(role ? { cid: "u1", name: "Tester", role } : null);
  const res = await GET(request());
  return { res, data: await readJson(res) };
};

beforeEach(() => {
  executed.length = 0;
  Object.assign(FIXTURE, JSON.parse(JSON.stringify(DEFAULT_FIXTURE)));
  jest.clearAllMocks();
});

describe("GET /api/admin/ventures/dashboard — gate", () => {
  test("super_admin is admitted", async () => {
    const { res } = await getAs("super_admin");
    expect(res.status).toBe(200);
  });

  test("an authenticated non-admin is refused", async () => {
    const { res, data } = await getAs("staff");
    expect(res.status).toBe(403);
    expect(data).toEqual({ success: false, error: "errors.insufficientPermissions" });
  });

  test("no session at all is refused", async () => {
    const { res, data } = await getAs(null);
    expect(res.status).toBe(401);
    expect(data).toEqual({ success: false, error: "errors.authRequired" });
  });
});

describe("GET /api/admin/ventures/dashboard — overview", () => {
  test("reports every phase, level and sector bucket, empty ones included", async () => {
    const { res, data } = await getAs("super_admin");
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);

    const portfolio = data.portfolio;

    // Phases come back in the portfolio's own order, at full length. The DB
    // fixture never mentions validation, early_traction or scaling, yet they
    // are still reported — with growth and idea counted from the fixture.
    expect(portfolio.byPhase.map((entry) => entry.key)).toEqual([
      "idea",
      "validation",
      "early_traction",
      "growth",
      "scaling",
      null,
      "recovered",
    ]);
    expect(portfolio.byPhase.map((entry) => entry.count)).toEqual([3, 0, 0, 4, 0, 2, 1]);

    // All four levels appear in readiness order even though the fixture only
    // returned two of them, and the band the engine has not defined yet is
    // appended rather than swallowed.
    expect(portfolio.byReadiness.map((band) => band.level)).toEqual([
      "not_ready",
      "early_ready",
      "investment_ready",
      "fundraising_ready",
      "invented_band",
    ]);
    expect(portfolio.byReadiness.map((band) => band.count)).toEqual([2, 0, 3, 0, 1]);

    // Sectors stay as the repository ordered them, and a Venture with no
    // industry keeps its own bucket instead of being folded into a real one.
    expect(portfolio.bySector).toEqual([
      { key: "AgriTech", count: 5 },
      { key: null, count: 2 },
    ]);

    expect(portfolio.total).toBe(12);
    expect(portfolio.activeParcours).toBe(7);
    expect(typeof portfolio.calculated_at).toBe("string");
  });

  test("an empty phase or sector string becomes its own bucket, not a lost one", async () => {
    FIXTURE.phases = [{ phase: "", count: 4 }];
    FIXTURE.sectors = [{ sector: "", count: 9 }];

    const { data } = await getAs("super_admin");

    const emptyBucket = portfolio(data).byPhase.at(-1);
    expect(emptyBucket).toEqual({ key: null, count: 4 });
    expect(portfolio(data).bySector).toEqual([{ key: null, count: 9 }]);
  });

  test("readiness sums back to assessed, which never exceeds the portfolio", async () => {
    const { data } = await getAs("super_admin");
    const view = portfolio(data);

    const summed = view.byReadiness.reduce((sum, band) => sum + band.count, 0);
    expect(view.assessed).toBe(summed);
    expect(view.assessed).toBe(6);
    // Twelve Ventures exist but only six have been assessed, so the two
    // figures must not be confused with each other.
    expect(view.assessed).not.toBe(view.total);
    expect(view.assessed).toBeLessThan(view.total);
  });

  test("an unassessed portfolio reports zeros rather than no rows", async () => {
    FIXTURE.readiness = [];
    FIXTURE.phases = [];
    FIXTURE.sectors = [];
    FIXTURE.total = 0;
    FIXTURE.parcours = 0;

    const { data } = await getAs("super_admin");
    const view = portfolio(data);

    expect(view.assessed).toBe(0);
    expect(view.total).toBe(0);
    expect(view.activeParcours).toBe(0);
    // The distribution is still a distribution: four levels, four zeros.
    expect(view.byReadiness).toHaveLength(4);
    expect(view.byReadiness.every((band) => band.count === 0)).toBe(true);
    expect(view.byPhase).toHaveLength(5);
    expect(view.byPhase.every((entry) => entry.count === 0)).toBe(true);
    expect(view.bySector).toEqual([]);
  });
});

describe("@/models/venturePortfolioStore — statement invariants", () => {
  test("readiness counts one row per Venture, not one per assessment", async () => {
    await getAs("super_admin");
    const statement = executed.find((entry) => entry.sql.includes("FROM investment_assessments"));

    expect(statement).toBeDefined();
    // The history table holds every score ever taken. Without the window
    // function a Venture assessed five times would be counted five times and
    // the distribution would exceed the portfolio.
    expect(statement.sql).toContain("ROW_NUMBER() OVER");
    expect(statement.sql).toContain("PARTITION BY venture_id");
    expect(statement.sql).toContain("ORDER BY calculated_at DESC");
    expect(statement.sql).toContain("latest.rn = 1");
  });

  test("active Parcours exclude archived stages", async () => {
    await getAs("super_admin");
    const statement = executed.find((entry) => entry.sql.includes("FROM venture_journey_stages"));

    expect(statement).toBeDefined();
    expect(statement.sql).toContain("status = 'active'");
    // An archived stage is out of the portfolio entirely, so it must be
    // excluded explicitly rather than left to the status filter.
    expect(statement.sql).toContain("is_archived");
    expect(statement.sql).toContain("is_archived IS NULL");
  });

  test("all five statements are issued once, in one read", async () => {
    await getAs("super_admin");
    expect(executed).toHaveLength(5);
  });
});

function portfolio(data) {
  return data.portfolio;
}
