/**
 * PHASE 5 — mode ombre. Compare l'ancien contrôle et le moteur SANS changer la
 * décision : inert par défaut, journalise les divergences quand le flag est ON.
 */
jest.mock("@/lib/logger", () => ({
  logger: { warn: jest.fn(), error: jest.fn(), debug: jest.fn(), info: jest.fn() },
}));

const { logger } = require("@/lib/logger");
const {
  compareDecisions,
  shadowCheck,
  shadowEnabled,
} = require("@/services/authorization/shadow");

const ORIGINAL = process.env.AUTHZ_SHADOW_MODE;

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.AUTHZ_SHADOW_MODE;
});
afterAll(() => {
  if (ORIGINAL === undefined) delete process.env.AUTHZ_SHADOW_MODE;
  else process.env.AUTHZ_SHADOW_MODE = ORIGINAL;
});

describe("compareDecisions (pur)", () => {
  test("accord → null", () => {
    expect(compareDecisions({ legacyAllowed: true, engineAllowed: true })).toBeNull();
    expect(compareDecisions({ legacyAllowed: false, engineAllowed: false })).toBeNull();
  });

  test("désaccord → enregistrement de la divergence", () => {
    expect(compareDecisions({ legacyAllowed: false, engineAllowed: true })).toEqual({
      legacyAllowed: false,
      engineAllowed: true,
    });
    expect(compareDecisions({ legacyAllowed: true, engineAllowed: false })).toEqual({
      legacyAllowed: true,
      engineAllowed: false,
    });
  });

  test("coercition booléenne : undefined/0 = refusé", () => {
    expect(compareDecisions({ legacyAllowed: undefined, engineAllowed: 0 })).toBeNull();
    expect(compareDecisions({ legacyAllowed: undefined, engineAllowed: 1 })).toEqual({
      legacyAllowed: false,
      engineAllowed: true,
    });
  });
});

describe("shadowCheck (gated par AUTHZ_SHADOW_MODE)", () => {
  test("désactivé par défaut : ne compare rien, ne journalise rien", () => {
    expect(shadowEnabled()).toBe(false);
    expect(
      shadowCheck({ legacyAllowed: false, engineAllowed: true, meta: { module: "crm" } }),
    ).toBeNull();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test("activé : journalise la divergence avec son contexte", () => {
    process.env.AUTHZ_SHADOW_MODE = "1";
    const divergence = shadowCheck({
      legacyAllowed: true,
      engineAllowed: false,
      meta: { module: "crm", capability: "view", cid: "U1" },
    });
    expect(divergence).toEqual({ legacyAllowed: true, engineAllowed: false });
    expect(logger.warn).toHaveBeenCalledWith("authz_shadow_divergence", {
      module: "crm",
      capability: "view",
      cid: "U1",
      legacyAllowed: true,
      engineAllowed: false,
    });
  });

  test("activé, accord : ne journalise pas", () => {
    process.env.AUTHZ_SHADOW_MODE = "1";
    expect(shadowCheck({ legacyAllowed: true, engineAllowed: true })).toBeNull();
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
