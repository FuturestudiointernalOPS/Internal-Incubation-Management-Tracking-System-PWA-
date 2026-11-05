jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn() },
  initDb: jest.fn().mockResolvedValue(true),
}));
jest.mock("@/server/auth/guards", () => ({ requireAuth: jest.fn() }));
jest.mock("@/server/auth/session", () => ({ getSession: jest.fn() }));
jest.mock("@/models/authorization/investorSelfService", () => ({
  requireInvestorSelfServiceAuthorization: jest.fn(),
}));
jest.mock("@/models/investorRelations", () => ({
  getInvestorProfileIdForProfileUpsert: jest.fn(),
  getInvestorProfileWithPreferences: jest.fn(),
  insertInvestorProfileWithPhoto: jest.fn(),
  updateInvestorProfileById: jest.fn(),
  updateInvestorProfileByUserId: jest.fn(),
  upgradeContactRoleToInvestor: jest.fn(),
}));
jest.mock("@/services/investor", () => ({ buildInvestorDashboard: jest.fn() }));

const db = require("@/lib/db").default;
const { requireAuth } = require("@/server/auth/guards");
const { getSession } = require("@/server/auth/session");
const { requireInvestorSelfServiceAuthorization } = require("@/models/authorization/investorSelfService");
const models = require("@/models/investorRelations");
const { buildInvestorDashboard } = require("@/services/investor");
const { INVESTOR_FLAGS, readInvestorFlags } = require("@/services/investor/featureFlags");
const { toInvestorSelfProfile } = require("@/services/investor/profilePrivacy");
const profileRoute = require("@/app/api/investor/profile/route");
const dashboardRoute = require("@/app/api/investor/dashboard/route");

const internalProfile = {
  id: "65aa77f0-235e-4b80-a889-cf66ed1b7710",
  user_id: "DEMO-MEMBER",
  approval_status: "approved",
  organization_name: "Synthetic Fund",
  biography: "Synthetic investor",
  industries: ["Fintech"],
  ticket_size_min: "10000",
  ticket_size_max: "50000",
  investment_philosophy: "Long-term investment",
  review_notes: "INTERNAL-REVIEW",
  qualification_score: 91,
  qualification_status: "approved",
  compliance_docs: ["PRIVATE-COMPLIANCE"],
  reviewed_by: "PRIVATE-REVIEWER",
  future_private_field: { secret: "NEW-INTERNAL-FIELD" },
};

beforeEach(() => {
  jest.clearAllMocks();
  db.execute.mockResolvedValue({ rows: [] });
  requireAuth.mockResolvedValue(null);
  requireInvestorSelfServiceAuthorization.mockResolvedValue(null);
  getSession.mockResolvedValue({ cid: "DEMO-MEMBER", role: "member" });
  models.getInvestorProfileWithPreferences.mockResolvedValue({ rows: [internalProfile] });
  models.getInvestorProfileIdForProfileUpsert.mockResolvedValue({ rows: [{ id: internalProfile.id }] });
  models.updateInvestorProfileByUserId.mockResolvedValue({ rows: [internalProfile] });
  models.insertInvestorProfileWithPhoto.mockResolvedValue({ rows: [internalProfile] });
  models.upgradeContactRoleToInvestor.mockResolvedValue({ rows: [] });
  buildInvestorDashboard.mockResolvedValue({
    profile: internalProfile, pipeline: [{ id: "pipeline-existing" }],
    recommendations: [], stats: { total_pipeline: 1 },
  });
});

function enablePrivacy() {
  db.execute.mockResolvedValue({ rows: [{ flag_key: INVESTOR_FLAGS.profilePrivacy, is_enabled: true }] });
}

function expectSafeProfile(profile) {
  expect(profile).toMatchObject({
    id: internalProfile.id, organization_name: "Synthetic Fund",
    approval_status: "approved", industries: ["Fintech"],
    ticket_size_min: "10000", investment_philosophy: "Long-term investment",
  });
  for (const key of ["review_notes", "qualification_score", "qualification_status", "compliance_docs", "reviewed_by", "future_private_field"]) {
    expect(profile).not.toHaveProperty(key);
  }
}

describe("investor flags", () => {
  test("all known switches are off when keys are missing", async () => {
    const flags = await readInvestorFlags();
    expect(Object.keys(flags)).toHaveLength(10);
    expect(Object.values(flags).every(value => value === false)).toBe(true);
    const query = db.execute.mock.calls[0][0];
    expect(query.args).toEqual(Object.values(INVESTOR_FLAGS));
    expect(query.sql).not.toContain("SELECT *");
  });

  test.each([false, "false", "true", "1", 1, null])("does not enable a flag from %p", async value => {
    db.execute.mockResolvedValue({ rows: [{ flag_key: INVESTOR_FLAGS.profilePrivacy, is_enabled: value }] });
    expect((await readInvestorFlags()).profilePrivacy).toBe(false);
  });

  test("a toggle takes effect on the next call without restarting", async () => {
    expect((await readInvestorFlags()).profilePrivacy).toBe(false);
    enablePrivacy();
    expect((await readInvestorFlags()).profilePrivacy).toBe(true);
    db.execute.mockResolvedValue({ rows: [] });
    expect((await readInvestorFlags()).profilePrivacy).toBe(false);
  });

  test("a flag read failure propagates instead of reverting to an unsafe payload", async () => {
    db.execute.mockRejectedValue(new Error("PRIVATE-DB-ERROR"));
    await expect(readInvestorFlags()).rejects.toThrow("PRIVATE-DB-ERROR");
  });
});

describe("profile allowlist", () => {
  test("rejects internal and future fields without mutating the model row", () => {
    const before = JSON.stringify(internalProfile);
    expectSafeProfile(toInvestorSelfProfile(internalProfile));
    expect(JSON.stringify(internalProfile)).toBe(before);
  });

  test.each([null, undefined, [], "invalid"])("normalizes missing or malformed profile %p", value => {
    expect(toInvestorSelfProfile(value)).toBeNull();
  });

  test("does not smuggle nested objects or inherited fields through allowed keys", () => {
    const row = Object.assign(Object.create({ biography: "INHERITED" }), {
      organization_name: { review_notes: "SECRET" },
      industries: ["Fintech", { review_notes: "SECRET" }],
      past_investments: [{ review_notes: "SECRET" }],
      ticket_size_min: Infinity,
    });
    expect(toInvestorSelfProfile(row)).toEqual({ industries: ["Fintech"] });
  });

  test("keeps nullable fields, numbers and timestamps in JSON-safe form", () => {
    expect(toInvestorSelfProfile({ biography: null, ticket_size_min: 0, created_at: new Date("2026-11-05T08:00:00Z") }))
      .toEqual({ biography: null, ticket_size_min: 0, created_at: "2026-11-05T08:00:00.000Z" });
  });
});

describe("self-service HTTP responses", () => {
  test("GET returns an allowlisted profile for a contextual Member with no investor role string", async () => {
    enablePrivacy();
    const response = await profileRoute.GET();
    expect(response.status).toBe(200);
    expectSafeProfile((await response.json()).profile);
    expect(models.getInvestorProfileWithPreferences).toHaveBeenCalledWith("DEMO-MEMBER");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
  });

  test.each([true, false])("POST upsert returns a safe profile (existing=%p)", async exists => {
    enablePrivacy();
    models.getInvestorProfileIdForProfileUpsert.mockResolvedValue({ rows: exists ? [{ id: internalProfile.id }] : [] });
    const response = await profileRoute.POST(new Request("http://localhost/api/investor/profile", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organization_name: "Synthetic Fund", user_id: "SOMEONE-ELSE", review_notes: "DO-NOT-WRITE" }),
    }));
    expectSafeProfile((await response.json()).profile);
    const writer = exists ? models.updateInvestorProfileByUserId : models.insertInvestorProfileWithPhoto;
    expect(writer).toHaveBeenCalledWith(...(exists
      ? ["Synthetic Fund", null, null, null, null, "DEMO-MEMBER"]
      : ["DEMO-MEMBER", "Synthetic Fund", null, null, null, null]));
    expect(models.upgradeContactRoleToInvestor).toHaveBeenCalledWith("DEMO-MEMBER");
  });

  test("dashboard protects profile while preserving current blocks", async () => {
    enablePrivacy();
    const response = await dashboardRoute.GET();
    const body = await response.json();
    expectSafeProfile(body.profile);
    expect(body.pipeline).toEqual([{ id: "pipeline-existing" }]);
    expect(body.stats).toEqual({ total_pipeline: 1 });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  test("disabled profile switch preserves the legacy payload", async () => {
    expect((await (await profileRoute.GET()).json()).profile).toEqual(internalProfile);
    expect((await (await dashboardRoute.GET()).json()).profile).toEqual(internalProfile);
  });

  test("missing profile stays null", async () => {
    enablePrivacy();
    models.getInvestorProfileWithPreferences.mockResolvedValue({ rows: [] });
    expect((await (await profileRoute.GET()).json()).profile).toBeNull();
  });

  test("authentication rejection prevents profile and flag access", async () => {
    requireAuth.mockResolvedValue(new Response(null, { status: 401 }));
    expect((await profileRoute.GET()).status).toBe(401);
    expect(db.execute).not.toHaveBeenCalled();
    expect(models.getInvestorProfileWithPreferences).not.toHaveBeenCalled();
  });

  test("creation denial prevents all writes", async () => {
    requireInvestorSelfServiceAuthorization.mockResolvedValue(new Response(null, { status: 403 }));
    expect((await profileRoute.POST(new Request("http://localhost", { method: "POST" }))).status).toBe(403);
    expect(db.execute).not.toHaveBeenCalled();
    expect(models.updateInvestorProfileByUserId).not.toHaveBeenCalled();
  });

  test("flag-store failure never saves or discloses a database exception", async () => {
    db.execute.mockRejectedValue(new Error("PRIVATE-DB-CREDENTIALS"));
    const response = await profileRoute.POST(new Request("http://localhost", { method: "POST" }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, error: "errors.somethingWrong" });
    expect(models.updateInvestorProfileByUserId).not.toHaveBeenCalled();
    expect(models.insertInvestorProfileWithPhoto).not.toHaveBeenCalled();
  });

  test("dashboard flag-store failure does not fall back to raw data", async () => {
    db.execute.mockRejectedValue(new Error("PRIVATE-DB-CREDENTIALS"));
    const response = await dashboardRoute.GET();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, error: "errors.somethingWrong" });
    expect(buildInvestorDashboard).not.toHaveBeenCalled();
  });

  test("privileged admin PUT keeps its existing authorization and payload", async () => {
    enablePrivacy();
    models.updateInvestorProfileById.mockResolvedValue({ rows: [internalProfile] });
    const response = await profileRoute.PUT(new Request("http://localhost", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: internalProfile.id, organization_name: "Synthetic Fund" }),
    }));
    expect(requireAuth).toHaveBeenCalledWith(["super_admin", "staff"]);
    expect((await response.json()).profile).toEqual(internalProfile);
    expect(db.execute).not.toHaveBeenCalled();
  });
});
