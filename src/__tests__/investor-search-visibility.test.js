jest.mock("@/lib/db", () => ({ initDb: jest.fn().mockResolvedValue(true) }));
jest.mock("@/models/investor", () => ({ countInvestorVentureSearch: jest.fn(), searchInvestorVentures: jest.fn() }));
jest.mock("@/models/investor/expansionSchema", () => ({ ensureInvestorExpansionSchema: jest.fn().mockResolvedValue(true) }));
jest.mock("@/models/authorization/investorSelfService", () => ({ requireInvestorSelfServiceAuthorization: jest.fn() }));
jest.mock("@/server/auth/session", () => ({ getSession: jest.fn().mockResolvedValue({ cid: "DEMO" }) }));
jest.mock("@/services/investor/activity", () => ({ emitInvestorEvent: jest.fn(), resolveInvestorContext: jest.fn() }));
jest.mock("@/services/investor/featureFlags", () => ({ readInvestorFlags: jest.fn().mockResolvedValue({ visibility: false }) }));
const models = require("@/models/investor");
const { requireInvestorSelfServiceAuthorization } = require("@/models/authorization/investorSelfService");
const { ensureInvestorExpansionSchema } = require("@/models/investor/expansionSchema");
const { resolveInvestorContext } = require("@/services/investor/activity");
const { GET } = require("@/app/api/investor/ventures/route");
beforeEach(() => {
  jest.clearAllMocks();
  requireInvestorSelfServiceAuthorization.mockResolvedValue(null);
  resolveInvestorContext.mockResolvedValue({ visibilityMode: "deal_flow_only", investorId: "demo" });
  models.countInvestorVentureSearch.mockResolvedValue({ rows: [{ total: "130" }] });
  models.searchInvestorVentures.mockResolvedValue({ rows: [{ id: "venture", name: "Synthetic", business_stage: "SECRET", revenue: "SECRET", investor_interest_count: 5 }] });
});
test("total and pages describe all permitted results rather than the current page", async () => {
  const response = await GET(new Request("http://localhost/api/investor/ventures?limit=10&offset=10&stage=SECRET&mode=full_pipeline"));
  const body = await response.json();
  expect(body).toMatchObject({ total: 130, page: 2, totalPages: 13 });
  expect(models.searchInvestorVentures).toHaveBeenCalledWith(expect.objectContaining({ visibilityMode: "deal_flow_only", stage: "", limit: 10, offset: 10 }));
  expect(body.ventures[0]).not.toHaveProperty("stage");
  expect(body.ventures[0]).not.toHaveProperty("revenue");
  expect(body.ventures[0]).not.toHaveProperty("investor_interest_count");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
test.each(["limit=0", "limit=-1", "limit=200", "limit=NaN", "offset=-1", "offset=1.5"])("rejects malformed pagination %s before querying the directory", async params => {
  expect((await GET(new Request(`http://localhost/api/investor/ventures?${params}`))).status).toBe(400);
  expect(models.searchInvestorVentures).not.toHaveBeenCalled();
});
test("server-controlled full-pipeline mode enables the optional stage", async () => {
  resolveInvestorContext.mockResolvedValue({ visibilityMode: "full_pipeline" });
  const response = await GET(new Request("http://localhost/api/investor/ventures?stage=Seed"));
  expect((await response.json()).ventures[0].stage).toBe("SECRET");
  expect(models.countInvestorVentureSearch).toHaveBeenCalledWith(expect.objectContaining({ stage: "Seed", visibilityMode: "full_pipeline" }));
});
test("authorization denial prevents expansion schema work and data access", async () => {
  requireInvestorSelfServiceAuthorization.mockResolvedValue(new Response(null, { status: 403 }));
  expect((await GET(new Request("http://localhost"))).status).toBe(403);
  expect(ensureInvestorExpansionSchema).not.toHaveBeenCalled();
  expect(models.countInvestorVentureSearch).not.toHaveBeenCalled();
});
test("database errors return no raw details", async () => {
  models.countInvestorVentureSearch.mockRejectedValue(new Error("PRIVATE SQL"));
  const response = await GET(new Request("http://localhost"));
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ success: false, error: "errors.somethingWrong" });
});
