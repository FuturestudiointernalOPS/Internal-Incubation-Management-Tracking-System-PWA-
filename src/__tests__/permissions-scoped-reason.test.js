/**
 * PHASE 5 — tranche c1 : justifications de la décision SCOPED
 * (`evaluateScopedAccess`). Additif : le booléen est inchangé, la raison est
 * ajoutée (même méthode que le sous-lot 2).
 */
jest.mock("@/lib/db", () => ({ initDb: jest.fn(async () => {}) }));

const mockGetSession = jest.fn();
jest.mock("@/server/auth/session", () => ({ getSession: () => mockGetSession() }));

const mockGetCtx = jest.fn();
const mockEvalAuth = jest.fn();
jest.mock("@/services/authorization/context", () => ({
  getAuthorizationContext: (...args) => mockGetCtx(...args),
  evaluateAuthorization: (...args) => mockEvalAuth(...args),
  AUTHZ_REASONS: { GRANTED: "granted", SUPER_ADMIN: "super_admin" },
}));

const mockProgramRows = jest.fn(async () => []);
jest.mock("@/models/authorization/contextAssignmentReads", () => ({
  getProgramStaffAssignmentRows: (...args) => mockProgramRows(...args),
  getContactRoleAssignmentRows: jest.fn(async () => []),
  getProjectMembershipRows: jest.fn(async () => []),
  getVentureMembershipRows: jest.fn(async () => []),
}));

const { evaluateScopedAccess, decide } = require("@/services/authorization/scopedAccess");

const call = (over = {}) =>
  evaluateScopedAccess({
    resource: "program",
    contextId: "P1",
    module: "programs",
    capability: "view",
    ...over,
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSession.mockResolvedValue({ cid: "U1", email: "u@x.test" });
  mockGetCtx.mockResolvedValue({ isSuperAdmin: false });
  mockEvalAuth.mockResolvedValue({
    allowed: true,
    status: 200,
    errorKey: null,
    reason: "granted",
  });
  mockProgramRows.mockResolvedValue([]);
});

describe("evaluateScopedAccess — justifications (c1)", () => {
  test("ressource absente → missing_resource", async () => {
    const d = await call({ contextId: null });
    expect(d).toMatchObject({ allowed: false, status: 403, reason: "missing_resource" });
  });

  test("session absente → unauthenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const d = await call();
    expect(d).toMatchObject({ allowed: false, status: 401, reason: "unauthenticated" });
  });

  test("super admin → super_admin (autorisé)", async () => {
    mockGetCtx.mockResolvedValue({ isSuperAdmin: true });
    const d = await call();
    expect(d).toMatchObject({ allowed: true, reason: "super_admin" });
  });

  test("capacité refusée → la raison de la capacité est propagée", async () => {
    mockEvalAuth.mockResolvedValue({
      allowed: false,
      status: 403,
      errorKey: "errors.insufficientPermissions",
      reason: "missing_permission",
    });
    const d = await call();
    expect(d).toMatchObject({ allowed: false, reason: "missing_permission" });
  });

  test("non assigné à la ressource → out_of_scope", async () => {
    mockProgramRows.mockResolvedValue([]);
    const d = await call();
    expect(d).toMatchObject({ allowed: false, status: 403, reason: "out_of_scope" });
  });

  test("assigné à la ressource → granted", async () => {
    mockProgramRows.mockResolvedValue([{ id: 1, program_id: "P1" }]);
    const d = await call();
    expect(d).toMatchObject({ allowed: true, reason: "granted" });
  });
});

describe("decide — point d'entrée unique (c2)", () => {
  test("global (sans resource) → délègue à la capacité", async () => {
    mockEvalAuth.mockResolvedValue({ allowed: true, status: 200, errorKey: null, reason: "granted" });
    const d = await decide({ module: "crm", capability: "view" });
    expect(d).toMatchObject({ allowed: true, reason: "granted" });
    expect(mockEvalAuth).toHaveBeenCalledWith("crm", "view", 1);
  });

  test("scoped : non assigné → out_of_scope", async () => {
    mockEvalAuth.mockResolvedValue({ allowed: true, status: 200, errorKey: null, reason: "granted" });
    mockProgramRows.mockResolvedValue([]);
    const d = await decide({
      module: "programs",
      capability: "view",
      resource: "program",
      contextId: "P1",
    });
    expect(d).toMatchObject({ allowed: false, reason: "out_of_scope" });
  });

  test("evaluateScopedAccess délègue à decide (résultats identiques)", async () => {
    mockEvalAuth.mockResolvedValue({ allowed: true, status: 200, errorKey: null, reason: "granted" });
    mockProgramRows.mockResolvedValue([{ id: 1 }]);
    const params = { module: "programs", capability: "view", resource: "program", contextId: "P1" };
    expect(await evaluateScopedAccess(params)).toEqual(await decide(params));
  });
});
