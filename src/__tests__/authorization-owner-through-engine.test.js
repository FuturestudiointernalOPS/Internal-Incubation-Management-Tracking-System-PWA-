/**
 * Étape 2 — the owner through the same decision path.
 *
 * The flag is OFF by default: the historical bypass must stay until the
 * production reference is verified. These tests pin BOTH behaviours:
 *   - without `ownerThroughEngine`, the owner still bypasses eligibility;
 *   - with it, eligibility and the account gate apply to the owner exactly as
 *     they apply to everyone else, while the rights still come from the
 *     `super_admin_default` profile.
 */

const {
  explainAuthorization,
  buildPermissionExplanation,
  AUTHZ_REASONS,
} = require("@/services/authorization/contextDecisions");

function ownerContext(overrides = {}) {
  return {
    isSuperAdmin: true,
    role: "super_admin",
    effective: { crm: { view: 5 } },
    restrictions: {},
    eligibility: { crm: true },
    accountStatus: "active",
    baseCaps: { crm: { view: 5 } },
    profiles: [],
    profile: { profileKey: "super_admin_default" },
    eligibilityRows: [
      {
        feature_key: "crm",
        identity_type: "role",
        identity_value: "super_admin",
        eligible: 1,
      },
    ],
    ...overrides,
  };
}

describe("owner through the engine — disabled (current behaviour)", () => {
  test("the owner still bypasses eligibility and the account gate", () => {
    const ctx = ownerContext({
      ownerThroughEngine: false,
      eligibility: { crm: false },
      accountStatus: "suspended",
    });
    expect(explainAuthorization(ctx, "crm", "view").allowed).toBe(true);
  });

  test("a right absent from the effective matrix still denies the owner", () => {
    const ctx = ownerContext({
      ownerThroughEngine: false,
      effective: {},
    });
    expect(explainAuthorization(ctx, "crm", "view")).toMatchObject({
      allowed: false,
      reason: AUTHZ_REASONS.MISSING_PERMISSION,
    });
  });

  test("the explanation still says the section is open by bypass", () => {
    const explanation = buildPermissionExplanation(ownerContext());
    expect(explanation.eligibility.crm).toMatchObject({
      eligible: true,
      source: "super_admin bypass",
    });
  });
});

describe("owner through the engine — enabled (target behaviour)", () => {
  test("an eligible, active owner holding the right is allowed", () => {
    const ctx = ownerContext({ ownerThroughEngine: true });
    expect(explainAuthorization(ctx, "crm", "view")).toMatchObject({
      allowed: true,
      reason: AUTHZ_REASONS.GRANTED,
    });
  });

  test("eligibility now applies to the owner", () => {
    const ctx = ownerContext({
      ownerThroughEngine: true,
      eligibility: { crm: false },
    });
    expect(explainAuthorization(ctx, "crm", "view")).toMatchObject({
      allowed: false,
      reason: AUTHZ_REASONS.NOT_ELIGIBLE,
    });
  });

  test("the account gate now applies to the owner", () => {
    const ctx = ownerContext({
      ownerThroughEngine: true,
      accountStatus: "suspended",
    });
    expect(explainAuthorization(ctx, "crm", "view")).toMatchObject({
      allowed: false,
      reason: AUTHZ_REASONS.ACCOUNT_NOT_ACTIVE,
    });
  });

  test("the right is still required", () => {
    const ctx = ownerContext({
      ownerThroughEngine: true,
      effective: {},
    });
    expect(explainAuthorization(ctx, "crm", "view")).toMatchObject({
      allowed: false,
      reason: AUTHZ_REASONS.MISSING_PERMISSION,
    });
  });

  test("the explanation reads the real eligibility rows, not a bypass", () => {
    const explanation = buildPermissionExplanation(
      ownerContext({ ownerThroughEngine: true }),
    );
    expect(explanation.eligibility.crm).toMatchObject({
      eligible: true,
      openedByProfile: false,
    });
    expect(explanation.eligibility.crm.sources).toHaveLength(1);
    expect(explanation.eligibility.crm.source).toBeUndefined();
  });
});
