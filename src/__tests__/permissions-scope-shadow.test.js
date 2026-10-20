/**
 * PHASE 5 — tranche c3a, réalignée par D-3 (étape 2.4) puis D-4 (étape 3.1).
 *
 * The unified decision now ENFORCES the program_manager PROFILE and keeps
 * measuring, in shadow, the rule it replaced ("staffed on the program"). The
 * switch was measured first (scripts/db-audit/program-perimeter-compare.sql);
 * the shadow keeps watching production without changing any answer.
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

/** policy → answer. The enforced and the shadow policy can disagree on purpose. */
const scopeAnswers = {};
const mockIsWithinScope = jest.fn(async (policy) => scopeAnswers[policy] === true);
jest.mock("@/services/authorization/scope", () => ({
  isWithinScope: (...args) => mockIsWithinScope(...args),
  resolveVentureScopeId: jest.fn(async (id) => id),
}));

const mockShadowEnabled = jest.fn(() => false);
const mockShadowCheck = jest.fn();
jest.mock("@/services/authorization/shadow", () => ({
  shadowEnabled: () => mockShadowEnabled(),
  shadowCheck: (...args) => mockShadowCheck(...args),
}));

const {
  decide,
  ENFORCED_SCOPE_POLICY,
  SHADOW_SCOPE_POLICY,
} = require("@/services/authorization/scopedAccess");

const params = {
  module: "programs",
  capability: "view",
  resource: "program",
  contextId: "P1",
};

const shadowCalls = () => mockIsWithinScope.mock.calls.filter(([policy]) => policy === "program_staffed");

beforeEach(() => {
  jest.clearAllMocks();
  for (const key of Object.keys(scopeAnswers)) delete scopeAnswers[key];
  mockGetSession.mockResolvedValue({ cid: "U1", email: "u@x.test" });
  mockGetCtx.mockResolvedValue({ isSuperAdmin: false });
  mockEvalAuth.mockResolvedValue({ allowed: true, status: 200, errorKey: null, reason: "granted" });
  mockShadowEnabled.mockReturnValue(false);
});

describe("the decision enforces the manager PROFILE (D-4)", () => {
  test("program → program_managed", async () => {
    scopeAnswers.program_managed = true;
    const d = await decide(params);
    expect(d.allowed).toBe(true);
    expect(mockIsWithinScope).toHaveBeenCalledWith("program_managed", "U1", "P1", {
      email: "u@x.test",
    });
  });

  test("venture → venture_own, on the canonical code", async () => {
    scopeAnswers.venture_own = true;
    const d = await decide({ ...params, resource: "venture", contextId: "VNT-ABC" });
    expect(d.allowed).toBe(true);
    expect(mockIsWithinScope).toHaveBeenCalledWith("venture_own", "U1", "VNT-ABC", {
      email: "u@x.test",
    });
  });
});

describe("shadow — the replaced rule is measured, never enforced", () => {
  test("disabled: the replaced rule is never consulted", async () => {
    scopeAnswers.program_managed = true;
    const d = await decide(params);
    expect(d.allowed).toBe(true);
    expect(shadowCalls()).toHaveLength(0);
    expect(mockShadowCheck).not.toHaveBeenCalled();
  });

  test("enabled: a divergence is logged, the enforced answer is unchanged", async () => {
    mockShadowEnabled.mockReturnValue(true);
    scopeAnswers.program_managed = true; // enforced = allow
    scopeAnswers.program_staffed = false; // replaced rule = deny
    const d = await decide(params);
    expect(d.allowed).toBe(true);
    expect(mockShadowCheck).toHaveBeenCalledWith({
      legacyAllowed: false,
      engineAllowed: true,
      meta: { resource: "program", contextId: "P1", cid: "U1", policy: "program_staffed" },
    });
  });

  test("enabled: agreement carries two equal values", async () => {
    mockShadowEnabled.mockReturnValue(true);
    scopeAnswers.program_managed = false;
    scopeAnswers.program_staffed = false;
    const d = await decide(params);
    expect(d.allowed).toBe(false);
    expect(mockShadowCheck).toHaveBeenCalledWith({
      legacyAllowed: false,
      engineAllowed: false,
      meta: { resource: "program", contextId: "P1", cid: "U1", policy: "program_staffed" },
    });
  });

  test("enabled, the probe fails: the enforced answer still stands", async () => {
    mockShadowEnabled.mockReturnValue(true);
    scopeAnswers.program_managed = true;
    mockIsWithinScope.mockImplementation(async (policy) => {
      if (policy === "program_staffed") throw new Error("boom");
      return true;
    });
    const d = await decide(params);
    expect(d.allowed).toBe(true);
    expect(mockShadowCheck).not.toHaveBeenCalled();
  });
});

describe("the declared policies stay aligned", () => {
  test("program enforces the profile and shadows the staffing rule", () => {
    expect(ENFORCED_SCOPE_POLICY.program).toBe("program_managed");
    expect(SHADOW_SCOPE_POLICY.program).toBe("program_staffed");
  });

  test("venture has only ever had one rule, so nothing is shadowed", () => {
    expect(ENFORCED_SCOPE_POLICY.venture).toBe("venture_own");
    expect(SHADOW_SCOPE_POLICY.venture).toBeUndefined();
  });
});
