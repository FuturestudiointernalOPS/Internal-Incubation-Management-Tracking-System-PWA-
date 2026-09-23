/**
 * SECURITY — regression tests for Lot 2: investor self-service own-scope.
 *
 * The self-service guard admits an investor on role/capability or on the mere
 * existence of a profile; it never bound a resource to the caller. These tests
 * pin the binding helpers and one route end to end: another investor's row must
 * be a 404, the caller's own row must pass, and the list must be scoped.
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn().mockResolvedValue({ rows: [] }) },
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(),
  requireAuth: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/models/authorization/investorSelfService", () => ({
  requireInvestorSelfServiceAuthorization: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/models/investor", () => ({
  getInvestorProfileIdByUserId: jest.fn(),
  getPipelineInvestorIdByPipelineId: jest.fn(),
  getDdRequestInfoByRequestId: jest.fn(),
  getDdDocumentById: jest.fn(),
}));

jest.mock("@/models/investorRelations", () => ({
  getRelationshipWorkspaceDetail: jest.fn(),
  listWorkspaceMeetings: jest.fn().mockResolvedValue({ rows: [] }),
  listWorkspaceTimeline: jest.fn().mockResolvedValue({ rows: [] }),
  listRelationshipWorkspaces: jest.fn().mockResolvedValue({ rows: [] }),
  getInvestorUserIdByProfileId: jest.fn(),
  getPipelineById: jest.fn(),
  insertWorkspaceCreatedTimeline: jest.fn(),
  insertWorkspaceStatusChangedTimeline: jest.fn(),
  notifyIntroductionApproved: jest.fn(),
  updateRelationshipWorkspace: jest.fn(),
  upsertRelationshipWorkspace: jest.fn(),
}));

const { getSession } = require("@/lib/auth");
const {
  resolveInvestorScope,
  isInvestorManagement,
  investorOwnsPipeline,
  investorOwnsDdDocument,
} = require("@/models/authorization/investorScope");
const {
  getInvestorProfileIdByUserId,
  getPipelineInvestorIdByPipelineId,
  getDdRequestInfoByRequestId,
  getDdDocumentById,
} = require("@/models/investor");
const { getRelationshipWorkspaceDetail, listRelationshipWorkspaces } = require("@/models/investorRelations");
const { GET } = require("@/app/api/investor/relationships/route");

beforeEach(() => {
  jest.clearAllMocks();
  getRelationshipWorkspaceDetail.mockResolvedValue({ rows: [] });
  listRelationshipWorkspaces.mockResolvedValue({ rows: [] });
});

describe("resolveInvestorScope / isInvestorManagement", () => {
  it("treats management roles as unscoped", async () => {
    expect(isInvestorManagement({ role: "staff" })).toBe(true);
    expect(isInvestorManagement({ role: "super_admin" })).toBe(true);
    expect(await resolveInvestorScope({ role: "staff", cid: "C1" })).toEqual({ management: true, profileId: null });
  });

  it("binds a self-service caller to their own profile", async () => {
    getInvestorProfileIdByUserId.mockResolvedValue({ rows: [{ id: 7 }] });
    expect(await resolveInvestorScope({ role: "member", cid: "C1" })).toEqual({ management: false, profileId: 7 });
  });

  it("returns no profile when the caller has none", async () => {
    getInvestorProfileIdByUserId.mockResolvedValue({ rows: [] });
    expect(await resolveInvestorScope({ role: "member", cid: "C1" })).toEqual({ management: false, profileId: null });
  });
});

describe("ownership verifiers", () => {
  it("pipeline belongs only to its own investor profile", async () => {
    getPipelineInvestorIdByPipelineId.mockResolvedValue({ rows: [{ investor_id: 7 }] });
    expect(await investorOwnsPipeline(5, 7)).toBe(true);
    expect(await investorOwnsPipeline(5, 9)).toBe(false);
    expect(await investorOwnsPipeline(5, null)).toBe(false);
  });

  it("a due-diligence document chains to its pipeline's investor", async () => {
    getDdDocumentById.mockResolvedValue({ rows: [{ id: 1, request_id: 50 }] });
    getDdRequestInfoByRequestId.mockResolvedValue({ rows: [{ pipeline_id: 5 }] });
    getPipelineInvestorIdByPipelineId.mockResolvedValue({ rows: [{ investor_id: 7 }] });

    expect(await investorOwnsDdDocument(1, 7)).toBe(true);
    expect(await investorOwnsDdDocument(1, 9)).toBe(false);
  });
});

describe("GET /api/investor/relationships — own-scope end to end", () => {
  const req = (query = "") => new Request(`http://localhost/api/investor/relationships${query}`);

  it("refuses another investor's workspace detail with 404", async () => {
    getSession.mockResolvedValue({ cid: "C1", role: "member" });
    getInvestorProfileIdByUserId.mockResolvedValue({ rows: [{ id: 7 }] });
    getRelationshipWorkspaceDetail.mockResolvedValue({ rows: [{ id: 3, investor_id: 9 }] });

    const res = await GET(req("?id=3"));

    expect(res.status).toBe(404);
  });

  it("returns the caller's own workspace detail", async () => {
    getSession.mockResolvedValue({ cid: "C1", role: "member" });
    getInvestorProfileIdByUserId.mockResolvedValue({ rows: [{ id: 7 }] });
    getRelationshipWorkspaceDetail.mockResolvedValue({ rows: [{ id: 3, investor_id: 7 }] });

    const res = await GET(req("?id=3"));

    expect(res.status).toBe(200);
  });

  it("scopes the list to the caller's profile", async () => {
    getSession.mockResolvedValue({ cid: "C1", role: "member" });
    getInvestorProfileIdByUserId.mockResolvedValue({ rows: [{ id: 7 }] });

    await GET(req());

    expect(listRelationshipWorkspaces).toHaveBeenCalledWith({ investorId: 7, ventureId: null });
  });

  it("lets a management caller list without a profile binding", async () => {
    getSession.mockResolvedValue({ cid: "S1", role: "staff" });

    await GET(req());

    expect(listRelationshipWorkspaces).toHaveBeenCalledWith({ investorId: null, ventureId: null });
  });
});
