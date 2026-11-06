jest.mock("@/server/auth/session", () => ({ getSession: jest.fn() }));
jest.mock("@/models/authorization/investorScope", () => ({ isInvestorManagement: jest.fn() }));
jest.mock("@/models/investor/activityLog", () => ({ selectInvestorContext: jest.fn() }));
jest.mock("@/services/investor/featureFlags", () => ({ readInvestorFlags: jest.fn() }));
jest.mock("@/models/authorization/index", () => ({ requireAuthorization: jest.fn() }));
const { getSession } = require("@/server/auth/session");
const { isInvestorManagement } = require("@/models/authorization/investorScope");
const { selectInvestorContext } = require("@/models/investor/activityLog");
const { readInvestorFlags } = require("@/services/investor/featureFlags");
const { withInvestorPrivacy } = require("@/server/investor/withPrivacy");
const { projectInvestorResponse } = require("@/services/investor/responsePrivacy");
const { requireAuthorization } = require("@/models/authorization/index");
const { requireInvestorStudioAuthorization } = require("@/server/investor/studioAuthorization");
beforeEach(() => {
  jest.clearAllMocks();
  getSession.mockResolvedValue({ cid: "DEMO", role: "member" });
  isInvestorManagement.mockReturnValue(false);
  requireAuthorization.mockResolvedValue(null);
  readInvestorFlags.mockResolvedValue({ visibility: true });
  selectInvestorContext.mockResolvedValue({ rows: [{ id: "demo", approval_status: "approved", visibility_mode: "deal_flow_only" }] });
});
const json = body => Response.json(body);
test("pipeline GET/POST responses omit future fields and studio metrics", async () => {
  const handler = jest.fn(async () => json({ success: true, pipeline: { id: "p", stage: "interested", notes: "My private note", review_notes: "PRIVATE", completion_index: 99, revenue: 200 } }));
  const response = await withInvestorPrivacy(handler, "pipeline")(new Request("http://localhost"));
  const body = await response.json();
  expect(body.pipeline).toMatchObject({ id: "p", stage: "interested", notes: "My private note" });
  expect(JSON.stringify(body)).not.toContain("PRIVATE");
  expect(body.pipeline).not.toHaveProperty("revenue");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
test.each(["pending_review", "rejected", "suspended"])("%s context is rejected before a mutation", async approval_status => {
  selectInvestorContext.mockResolvedValue({ rows: [{ approval_status }] });
  const handler = jest.fn();
  expect((await withInvestorPrivacy(handler, "pipeline")(new Request("http://localhost"))).status).toBe(403);
  expect(handler).not.toHaveBeenCalled();
});
test("absent profile is rejected before calling the old handler", async () => {
  selectInvestorContext.mockResolvedValue({ rows: [] });
  const handler = jest.fn();
  expect((await withInvestorPrivacy(handler, "pipeline")()).status).toBe(403);
  expect(handler).not.toHaveBeenCalled();
});
test("disabled switch keeps existing workflows reachable", async () => {
  readInvestorFlags.mockResolvedValue({ visibility: false });
  const handler = jest.fn(async () => json({ success: true, legacy: "existing" }));
  expect(await (await withInvestorPrivacy(handler, "pipeline")()).json()).toEqual({ success: true, legacy: "existing" });
  expect(selectInvestorContext).not.toHaveBeenCalled();
});
test("studio keeps existing privileged output", async () => {
  isInvestorManagement.mockReturnValue(true);
  const handler = jest.fn(async () => json({ success: true, studio_only: "existing" }));
  expect(await (await withInvestorPrivacy(handler, "pipeline")()).json()).toEqual({ success: true, studio_only: "existing" });
  expect(readInvestorFlags).not.toHaveBeenCalled();
});
test("anonymous calls keep the original authentication rejection", async () => {
  getSession.mockResolvedValue(null);
  const handler = jest.fn(async () => new Response(null, { status: 401 }));
  expect((await withInvestorPrivacy(handler, "pipeline")()).status).toBe(401);
  expect(readInvestorFlags).not.toHaveBeenCalled();
});
test("flag error fails closed before writes", async () => {
  readInvestorFlags.mockRejectedValue(new Error("PRIVATE DATABASE ERROR"));
  const handler = jest.fn();
  const response = await withInvestorPrivacy(handler, "pipeline")();
  expect(response.status).toBe(500);
  expect(JSON.stringify(await response.json())).not.toContain("PRIVATE");
  expect(handler).not.toHaveBeenCalled();
});
test("errors from original handlers retain status without exposing SQL", async () => {
  const handler = async () => Response.json({ success: false, error: "PRIVATE SQL" }, { status: 404 });
  const response = await withInvestorPrivacy(handler, "pipeline")();
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ success: false, error: "errors.somethingWrong" });
});
test.each(["kpis", "updates", "evaluation"])("%s does not forward internal venture metrics/narratives", surface => {
  const body = projectInvestorResponse({ success: true, kpis: [{ revenue: 4 }], updates: [{ narrative: "PRIVATE" }], evaluations: [{ internal_notes: "PRIVATE" }] }, surface, "deal_flow_only");
  expect(JSON.stringify(body)).not.toContain("PRIVATE");
  expect(JSON.stringify(body)).not.toContain("revenue");
});
test("diligence requests and own documents retain their working identifiers", () => {
  expect(projectInvestorResponse({ success: true, workspace: { id: "w", internal_notes: "PRIVATE" }, requests: [{ id: "r", title: "Document", internal_notes: "PRIVATE" }] }, "diligence", "deal_flow_only"))
    .toEqual({ success: true, workspace: { id: "w" }, requests: [{ id: "r", title: "Document" }] });
  expect(projectInvestorResponse({ success: true, document: { id: "d", request_id: "r", file_name: "synthetic.pdf", file_data: "synthetic", staff_email: "PRIVATE" } }, "documents", "deal_flow_only"))
    .toEqual({ success: true, document: { id: "d", request_id: "r", file_name: "synthetic.pdf", file_data: "synthetic" } });
});
test("a module view capability alone never grants global investor reporting", async () => {
  expect((await requireInvestorStudioAuthorization("investor", "view")).status).toBe(403);
  isInvestorManagement.mockReturnValue(true);
  expect(await requireInvestorStudioAuthorization("investor", "view")).toBeNull();
});
test("internal identity also needs the original capability", async () => {
  isInvestorManagement.mockReturnValue(true);
  requireAuthorization.mockResolvedValue(new Response(null, { status: 403 }));
  expect((await requireInvestorStudioAuthorization("investor", "view")).status).toBe(403);
});
