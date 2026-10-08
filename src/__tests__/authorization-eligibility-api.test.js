/**
 * Authorization — the eligibility configuration API.
 *
 * configure_eligibility as a capability, the validateEligibilityChanges
 * batch normalizer and the ceilings it enforces on the matrix.
 *
 * Mocks and context factories come from ./helpers/authorizationMocks.
 */

const mockAuthz = require("./helpers/authorizationMocks");

jest.mock("@/lib/db", () => mockAuthz.db);
jest.mock("@/server/authz/capabilities", () => {
  const auth = mockAuthz.auth;
  return { PERMISSION_MODULES: auth.PERMISSION_MODULES, ACCESS_LEVELS: auth.ACCESS_LEVELS };
});
jest.mock("@/server/auth/session", () => ({ getSession: mockAuthz.auth.getSession }));
jest.mock("@/models/authorization/bootstrap", () => ({ ensurePermissionsSchema: mockAuthz.auth.ensurePermissionsSchema }));
jest.mock("next/server", () => mockAuthz.nextServer);

const { authorize } = require("@/services/authorization/context");
const { saCtx, staffCtx } = require("./helpers/authorizationMocks");

// ─── Phase A — Permissions control center ───────────────────────────────
// Dedicated configure_eligibility authority, one-time policy migrations, and
// eligibility change validation (the UI writes the same rows the resolver
// reads — the API only validates/normalizes them).

describe("permissions.configure_eligibility (Phase A)", () => {
  test("is part of the permissions module capability set", () => {
    const { PERMISSION_MODULES } = require("@/server/authz/capabilities");
    expect(PERMISSION_MODULES.permissions.capabilities).toContain(
      "configure_eligibility",
    );
  });

  test("SA may configure eligibility (bypass)", () => {
    expect(authorize(saCtx(), "permissions", "configure_eligibility")).toBe(
      true,
    );
  });

  test("holder of the capability may configure; others are denied", () => {
    const admin = staffCtx({
      role: "staff",
      eligibility: { security: true },
      effective: { permissions: { view_matrix: 1, configure_eligibility: 1 } },
    });
    const viewer = staffCtx({
      role: "staff",
      eligibility: { security: true },
      effective: { permissions: { view_matrix: 1 } }, // no configure cap
    });
    expect(authorize(admin, "permissions", "configure_eligibility")).toBe(
      true,
    );
    expect(authorize(viewer, "permissions", "configure_eligibility")).toBe(
      false,
    );
  });

  test("configure_eligibility is separate from assign_capabilities", () => {
    const ctx = staffCtx({
      role: "staff",
      eligibility: { security: true },
      effective: { permissions: { assign_capabilities: 2 } }, // different power
    });
    expect(authorize(ctx, "permissions", "configure_eligibility")).toBe(
      false,
    );
    expect(authorize(ctx, "permissions", "assign_capabilities")).toBe(true);
  });
});


describe("validateEligibilityChanges (eligibility API)", () => {
  test("normalizes a valid batch (1, 0 and null → delete)", () => {
    const { validateEligibilityChanges } = require("@/models/authorization/index");
    const result = validateEligibilityChanges([
      { feature_key: "finance", identity_type: "role", identity_value: "staff", eligible: 1 },
      { feature_key: "crm", identity_type: "group", identity_value: "Future Studio", eligible: 0 },
      { feature_key: "communication", identity_type: "role", identity_value: "member", eligible: null },
    ]);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.normalized).toEqual([
      { feature_key: "finance", identity_type: "role", identity_value: "staff", eligible: 1 },
      { feature_key: "crm", identity_type: "group", identity_value: "Future Studio", eligible: 0 },
      { feature_key: "communication", identity_type: "role", identity_value: "member", eligible: null },
    ]);
  });

  test("rejects unknown features, identity types, empty values and bad eligible values", () => {
    const { validateEligibilityChanges } = require("@/models/authorization/index");
    const result = validateEligibilityChanges([
      { feature_key: "not_a_feature", identity_type: "role", identity_value: "staff", eligible: 1 },
      { feature_key: "finance", identity_type: "planet", identity_value: "staff", eligible: 1 },
      { feature_key: "finance", identity_type: "role", identity_value: "  ", eligible: 1 },
      { feature_key: "finance", identity_type: "role", identity_value: "staff", eligible: 7 },
      { feature_key: "finance", identity_type: "role", identity_value: "staff", eligible: "yes" },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(5);
    expect(result.normalized).toEqual([]);
  });

  test("rejects an empty batch", () => {
    const { validateEligibilityChanges } = require("@/models/authorization/index");
    expect(validateEligibilityChanges([]).valid).toBe(false);
    expect(validateEligibilityChanges(null).valid).toBe(false);
    expect(validateEligibilityChanges(undefined).valid).toBe(false);
  });

  test("feature catalog covers every module-mapped and seeded feature", () => {
    const { FEATURE_KEYS } = require("@/models/authorization/index");
    expect(FEATURE_KEYS).toEqual(
      expect.arrayContaining([
        "crm",
        "communication",
        "finance",
        "programs",
        "reports",
        "security",
        "settings",
      ]),
    );
  });

  test("capabilities within eligibility are valid (Phase 2)", () => {
    const { validateCapabilitiesWithinEligibility } = require("@/models/authorization/index");
    const result = validateCapabilitiesWithinEligibility(
      { programs: { view: 1 }, contacts: { view: 1 } },
      { programs: true, crm: true },
    );
    expect(result.valid).toBe(true);
    expect(result.violations).toEqual([]);
  });

  test("ineligible feature capabilities are rejected (template boundary)", () => {
    const { validateCapabilitiesWithinEligibility } = require("@/models/authorization/index");
    const result = validateCapabilitiesWithinEligibility(
      { programs: { view: 1 }, finance: { view: 1 } },
      { programs: true, finance: false },
    );
    expect(result.valid).toBe(false);
    expect(result.violations).toEqual([
      { module: "finance", capability: "view", feature: "finance" },
    ]);
  });

  test("unset eligibility (missing = fail closed) rejects template caps", () => {
    const { validateCapabilitiesWithinEligibility } = require("@/models/authorization/index");
    const result = validateCapabilitiesWithinEligibility(
      { finance: { view: 1 } },
      { programs: true }, // finance row missing entirely
    );
    expect(result.valid).toBe(false);
    expect(result.violations[0]).toEqual({
      module: "finance",
      capability: "view",
      feature: "finance",
    });
  });

  test("infra modules without a feature mapping are not eligibility-bound", () => {
    const { validateCapabilitiesWithinEligibility } = require("@/models/authorization/index");
    const result = validateCapabilitiesWithinEligibility(
      { org_membership: { manage: 2 } },
      {},
    );
    expect(result.valid).toBe(true);
  });

  test("the template-ceiling catch-up mirrors the canonical defaults (no drift)", () => {
    // The catch-up exists for databases whose eligibility bootstrap ran BEFORE
    // the seeded default templates were reconciled with their roles' ceilings.
    // It must add exactly what a fresh database gets from the defaults — a
    // divergence would make the two populations behave differently.
    const {
  TEMPLATE_CEILING_ROWS,
  FEATURE_ELIGIBILITY_DEFAULTS,
} = require("@/models/authorization/eligibility");
    const rows = Object.entries(TEMPLATE_CEILING_ROWS);
    expect(rows.length).toBeGreaterThan(0);
    for (const [featureKey, roles] of rows) {
      expect(FEATURE_ELIGIBILITY_DEFAULTS[featureKey]).toBeDefined();
      for (const role of roles) {
        expect(FEATURE_ELIGIBILITY_DEFAULTS[featureKey]).toContain(role);
      }
    }
  });

  test("capability catalog exposes labels and risk for every module", () => {
    const { CAPABILITY_CATALOG } = require("@/models/authorization/capability-catalog");
    const { PERMISSION_MODULES } = require("@/server/authz/capabilities");
    for (const [mod, def] of Object.entries(PERMISSION_MODULES)) {
      expect(CAPABILITY_CATALOG[mod]).toBeDefined();
      for (const cap of def.capabilities) {
        expect(CAPABILITY_CATALOG[mod].capabilities[cap]).toBeDefined();
      }
    }
  });
});

