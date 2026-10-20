/**
 * THE UNIFIED SCOPED DECISION (D-3), aligned by D-4 (étape 3.1).
 *
 * The decision ENFORCES the `program_manager` PROFILE for programs and the
 * ownership rule for ventures. The transition probe that compared the program
 * perimeter with the staffing rule it replaced was removed in Lot 8 — its one
 * divergence was explained, and there is nothing left to watch.
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

/** policy → answer. */
const scopeAnswers = {};
const mockIsWithinScope = jest.fn(async (policy) => scopeAnswers[policy] === true);
jest.mock("@/services/authorization/scope", () => ({
  isWithinScope: (...args) => mockIsWithinScope(...args),
  resolveVentureScopeId: jest.fn(async (id) => id),
}));

const { decide, ENFORCED_SCOPE_POLICY } = require("@/services/authorization/scopedAccess");

const params = {
  module: "programs",
  capability: "view",
  resource: "program",
  contextId: "P1",
};

beforeEach(() => {
  jest.clearAllMocks();
  for (const key of Object.keys(scopeAnswers)) delete scopeAnswers[key];
  mockGetSession.mockResolvedValue({ cid: "U1", email: "u@x.test" });
  mockGetCtx.mockResolvedValue({ isSuperAdmin: false });
  mockEvalAuth.mockResolvedValue({ allowed: true, status: 200, errorKey: null, reason: "granted" });
});

describe("the decision enforces the manager PROFILE (D-4)", () => {
  test("program → program_managed", async () => {
    scopeAnswers.program_managed = true;
    const d = await decide(params);
    expect(d.allowed).toBe(true);
    expect(mockIsWithinScope).toHaveBeenCalledWith("program_managed", "U1", "P1", {
      email: "u@x.test",
    });
    // The staffing perimeter is not consulted at all.
    expect(mockIsWithinScope).toHaveBeenCalledTimes(1);
  });

  test("venture → venture_own, on the canonical code", async () => {
    scopeAnswers.venture_own = true;
    const d = await decide({ ...params, resource: "venture", contextId: "VNT-ABC" });
    expect(d.allowed).toBe(true);
    expect(mockIsWithinScope).toHaveBeenCalledWith("venture_own", "U1", "VNT-ABC", {
      email: "u@x.test",
    });
  });

  test("out of perimeter is a 403 with a stable reason", async () => {
    scopeAnswers.program_managed = false;
    const d = await decide(params);
    expect(d).toMatchObject({
      allowed: false,
      status: 403,
      reason: "out_of_scope",
    });
  });
});

describe("the declared policies stay aligned", () => {
  test("program enforces the profile", () => {
    expect(ENFORCED_SCOPE_POLICY.program).toBe("program_managed");
  });

  test("venture enforces ownership", () => {
    expect(ENFORCED_SCOPE_POLICY.venture).toBe("venture_own");
  });
});
