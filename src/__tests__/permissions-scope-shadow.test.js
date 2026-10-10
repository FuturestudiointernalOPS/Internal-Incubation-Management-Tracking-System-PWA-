/**
 * PHASE 5 — tranche c3a : mode ombre sur la PORTÉE.
 *
 * Dans le chemin scopé de `decide`, la portée par le MOTEUR (`isWithinScope`) est
 * comparée à la décision ad hoc et journalisée — SANS changer l'issue et
 * seulement quand `AUTHZ_SHADOW_MODE` est actif.
 */
jest.mock("@/lib/db", () => ({ initDb: jest.fn(async () => {}) }));

const mockGetSession = jest.fn();
jest.mock("@/server/auth/session", () => ({ getSession: () => mockGetSession() }));

const mockGetCtx = jest.fn();
const mockEvalAuth = jest.fn();
jest.mock("@/services/authorization/context", () => ({
  getAuthorizationContext: (...args) => mockGetCtx(...args),
  evaluateAuthorization: (...args) => mockEvalAuth(...args),
}));

const mockProgramRows = jest.fn(async () => []);
jest.mock("@/models/authorization/contextAssignmentReads", () => ({
  getProgramStaffAssignmentRows: (...args) => mockProgramRows(...args),
  getContactRoleAssignmentRows: jest.fn(async () => []),
  getProjectMembershipRows: jest.fn(async () => []),
  getVentureMembershipRows: jest.fn(async () => []),
}));

const mockIsWithinScope = jest.fn(async () => false);
jest.mock("@/services/authorization/scope", () => ({
  isWithinScope: (...args) => mockIsWithinScope(...args),
}));

const mockShadowEnabled = jest.fn(() => false);
const mockShadowCheck = jest.fn();
jest.mock("@/services/authorization/shadow", () => ({
  shadowEnabled: () => mockShadowEnabled(),
  shadowCheck: (...args) => mockShadowCheck(...args),
}));

const { decide } = require("@/services/authorization/scopedAccess");

const params = {
  module: "programs",
  capability: "view",
  resource: "program",
  contextId: "P1",
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSession.mockResolvedValue({ cid: "U1", email: "u@x.test" });
  mockGetCtx.mockResolvedValue({ isSuperAdmin: false });
  mockEvalAuth.mockResolvedValue({ allowed: true, status: 200, errorKey: null, reason: "granted" });
  mockProgramRows.mockResolvedValue([]);
  mockIsWithinScope.mockResolvedValue(false);
  mockShadowEnabled.mockReturnValue(false);
});

describe("c3a — mode ombre sur la portée", () => {
  test("désactivé : la portée moteur n'est jamais consultée", async () => {
    mockProgramRows.mockResolvedValue([{ id: 1 }]);
    const d = await decide(params);
    expect(d.allowed).toBe(true);
    expect(mockIsWithinScope).not.toHaveBeenCalled();
    expect(mockShadowCheck).not.toHaveBeenCalled();
  });

  test("activé : divergence mesurée, issue INCHANGÉE (l'adhoc décide)", async () => {
    mockShadowEnabled.mockReturnValue(true);
    mockProgramRows.mockResolvedValue([{ id: 1 }]); // adhoc = allow
    mockIsWithinScope.mockResolvedValue(false); // moteur = deny
    const d = await decide(params);
    expect(d.allowed).toBe(true); // issue inchangée
    expect(mockShadowCheck).toHaveBeenCalledWith({
      legacyAllowed: true,
      engineAllowed: false,
      meta: { resource: "program", contextId: "P1", cid: "U1", policy: "program_assigned" },
    });
  });

  test("activé : accord → shadowCheck reçoit deux valeurs égales", async () => {
    mockShadowEnabled.mockReturnValue(true);
    mockProgramRows.mockResolvedValue([]); // adhoc = deny
    mockIsWithinScope.mockResolvedValue(false); // moteur = deny
    const d = await decide(params);
    expect(d.allowed).toBe(false);
    expect(mockShadowCheck).toHaveBeenCalledWith({
      legacyAllowed: false,
      engineAllowed: false,
      meta: { resource: "program", contextId: "P1", cid: "U1", policy: "program_assigned" },
    });
  });

  test("activé, sondage moteur en échec : l'issue reste celle de l'adhoc", async () => {
    mockShadowEnabled.mockReturnValue(true);
    mockProgramRows.mockResolvedValue([{ id: 1 }]); // adhoc allow
    mockIsWithinScope.mockRejectedValue(new Error("boom"));
    const d = await decide(params);
    expect(d.allowed).toBe(true);
    expect(mockShadowCheck).not.toHaveBeenCalled();
  });
});
