/**
 * PHASE 5 — tranche c3a, réalignée par D-3 (étape 2.4).
 *
 * The unified decision now ENFORCES the perimeter the route guards already
 * apply (`program_staffed`, `venture_own`) and keeps measuring, in shadow, the
 * policy that will replace it (the `program_manager` PROFILE). Adopting the
 * entry point therefore changes no answer; the measurement that will justify
 * the Lot 3 switch survives.
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

const shadowCalls = () => mockIsWithinScope.mock.calls.filter(([policy]) => policy === "program_managed");

beforeEach(() => {
  jest.clearAllMocks();
  for (const key of Object.keys(scopeAnswers)) delete scopeAnswers[key];
  mockGetSession.mockResolvedValue({ cid: "U1", email: "u@x.test" });
  mockGetCtx.mockResolvedValue({ isSuperAdmin: false });
  mockEvalAuth.mockResolvedValue({ allowed: true, status: 200, errorKey: null, reason: "granted" });
  mockShadowEnabled.mockReturnValue(false);
});

describe("the decision enforces the policy the guards already apply", () => {
  test("program → program_staffed", async () => {
    scopeAnswers.program_staffed = true;
    const d = await decide(params);
    expect(d.allowed).toBe(true);
    expect(mockIsWithinScope).toHaveBeenCalledWith("program_staffed", "U1", "P1", {
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

describe("shadow — the profile policy is measured, never enforced", () => {
  test("disabled: the profile policy is never consulted", async () => {
    scopeAnswers.program_staffed = true;
    const d = await decide(params);
    expect(d.allowed).toBe(true);
    expect(shadowCalls()).toHaveLength(0);
    expect(mockShadowCheck).not.toHaveBeenCalled();
  });

  test("enabled: a divergence is logged, the enforced answer is unchanged", async () => {
    mockShadowEnabled.mockReturnValue(true);
    scopeAnswers.program_staffed = true; // enforced = allow
    scopeAnswers.program_managed = false; // target profile = deny
    const d = await decide(params);
    expect(d.allowed).toBe(true);
    expect(mockShadowCheck).toHaveBeenCalledWith({
      legacyAllowed: true,
      engineAllowed: false,
      meta: { resource: "program", contextId: "P1", cid: "U1", policy: "program_managed" },
    });
  });

  test("enabled: agreement carries two equal values", async () => {
    mockShadowEnabled.mockReturnValue(true);
    scopeAnswers.program_staffed = false;
    scopeAnswers.program_managed = false;
    const d = await decide(params);
    expect(d.allowed).toBe(false);
    expect(mockShadowCheck).toHaveBeenCalledWith({
      legacyAllowed: false,
      engineAllowed: false,
      meta: { resource: "program", contextId: "P1", cid: "U1", policy: "program_managed" },
    });
  });

  test("enabled, the probe fails: the enforced answer still stands", async () => {
    mockShadowEnabled.mockReturnValue(true);
    scopeAnswers.program_staffed = true;
    mockIsWithinScope.mockImplementation(async (policy) => {
      if (policy === "program_managed") throw new Error("boom");
      return true;
    });
    const d = await decide(params);
    expect(d.allowed).toBe(true);
    expect(mockShadowCheck).not.toHaveBeenCalled();
  });
});

describe("the declared policies stay aligned", () => {
  test("program enforces the guard's policy and shadows the profile one", () => {
    expect(ENFORCED_SCOPE_POLICY.program).toBe("program_staffed");
    expect(SHADOW_SCOPE_POLICY.program).toBe("program_managed");
  });

  test("venture already enforces its target policy, so nothing is shadowed", () => {
    expect(ENFORCED_SCOPE_POLICY.venture).toBe("venture_own");
    expect(SHADOW_SCOPE_POLICY.venture).toBeUndefined();
  });
});
