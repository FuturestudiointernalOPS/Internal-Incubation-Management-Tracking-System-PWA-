/**
 * The investor DIRECTORY reads the platform's Ventures.
 *
 * These pin the re-pointing: the discovery list, the recommendation feed and the
 * per-Venture reads (pipeline, watchlist, diligence) all resolve a Venture from
 * the "ventures" table — not from the incubation programmes the portal used to
 * read — and an archived Venture is never listed.
 */
const executed = [];

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    execute: jest.fn(async (query) => {
      executed.push(query);
      return { rows: [] };
    }),
  },
  initDb: jest.fn(async () => {}),
}));

const {
  countInvestorVentureSearch,
  searchInvestorVentures,
} = require("@/models/investor/venturesAndUpdates");
const {
  listActiveVenturesForRecommendations,
  listInvestorPipelineEntries,
  listInvestorWatchlist,
} = require("@/models/investor/dashboardsAndKpis");
const { getPipelineWithVentureById } = require("@/models/investor/diligenceAndPipeline/diligence");
const { listInvestmentPipeline, getMeetingRequestInfo } = require("@/models/investor/diligenceAndPipeline/pipeline");

const sqlOf = (index = 0) => String(executed[index].sql);

beforeEach(() => {
  executed.length = 0;
});

describe("the investor venture directory", () => {
  test("the search reads the Ventures directory, never the programmes", async () => {
    await searchInvestorVentures({
      search: "agri",
      industry: "AgriTech",
      country: "GN",
      stage: "Seed",
      limit: 50,
      offset: 0,
    });
    const sql = sqlOf();
    expect(sql).toContain("FROM ventures v");
    expect(sql).not.toContain("v2_programs");
    // An archived Venture is never listed (either generation of the flag).
    expect(sql).toContain("v.is_archived");
    expect(sql).toMatch(/LOWER\(COALESCE\(v\.status, ''\)\) <> 'archived'/);
  });

  test("the count reads the Ventures directory too", async () => {
    await countInvestorVentureSearch({ search: "" });
    expect(sqlOf()).toContain("COUNT(*) AS total FROM ventures v");
  });

  test("the recommendation feed reads the Ventures directory", async () => {
    await listActiveVenturesForRecommendations();
    const sql = sqlOf();
    expect(sql).toContain("FROM ventures v");
    expect(sql).not.toContain("v2_programs");
  });

  test("a pipeline row resolves its name from the directory as a fallback", async () => {
    await listInvestorPipelineEntries("inv-1");
    const sql = sqlOf();
    expect(sql).toContain("LEFT JOIN ventures v ON v.id = ip.venture_id");
    expect(sql).toMatch(/COALESCE\(p\.name, v\.name, v\.company_name\)/);
  });

  test("a watchlist row resolves its venture fields from the directory", async () => {
    await listInvestorWatchlist("inv-1");
    const sql = sqlOf();
    expect(sql).toContain("LEFT JOIN ventures v ON v.id = iw.venture_id");
    expect(sql).toMatch(/COALESCE\(p\.industry, v\.industry\)/);
  });

  test("the diligence read resolves the Venture from the directory too", async () => {
    await getPipelineWithVentureById("pl-1");
    expect(sqlOf()).toContain("LEFT JOIN ventures v ON v.id = ip.venture_id");
  });

  test("the management pipeline view resolves the Venture from the directory", async () => {
    await listInvestmentPipeline({ ventureId: "v1", stage: null, role: "staff", investorId: null });
    expect(sqlOf()).toContain("LEFT JOIN ventures v ON v.id = ip.venture_id");
  });

  test("the meeting-request lookup coalesces the Venture name", async () => {
    await getMeetingRequestInfo({ venture_id: "v1", investor_id: "i1" });
    const query = executed[0];
    expect(String(query.sql)).toMatch(/COALESCE\(p\.name, v\.name, v\.company_name\)/);
    expect(query.args).toEqual(["v1", "v1", "i1"]);
  });
});
