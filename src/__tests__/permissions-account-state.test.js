/**
 * PHASE 4 — sous-lot 1 : l'état du compte comme PRÉALABLE de la décision
 * (spec §11, décision D2).
 *
 * Un compte non « active » est refusé AVANT l'éligibilité et la capacité ; un
 * statut inconnu (pas de ligne contact) laisse le comportement antérieur
 * inchangé, de sorte que le changement est additif et ne peut pas refuser en
 * masse une session sans ligne contact.
 */
const accountRow = { current: {} };

jest.mock("@/models/authorization/contextReads", () => ({
  getUserCapabilityGrants: jest.fn(async () => ({ rows: [] })),
  getUserCapabilityRestrictions: jest.fn(async () => ({ rows: [] })),
  getContactAccessProfileAndGroup: jest.fn(async () => ({ rows: [accountRow.current] })),
  resolveContactBaseProfile: jest.fn(async () => ({ rows: [] })),
  resolveRoleDefaultBaseProfile: jest.fn(async () => ({ rows: [] })),
  getBaseCapabilityRows: jest.fn(async () => ({
    rows: [{ module: "crm", capability: "view", access_level: 1 }],
  })),
  getGroupCapabilityRows: jest.fn(async () => ({ rows: [] })),
  getFeatureEligibilityRows: jest.fn(async () => ({
    rows: [{ feature_key: "crm", identity_type: "role", identity_value: "staff", eligible: 1 }],
  })),
}));

jest.mock("@/services/authorization/membership", () => ({
  getEffectiveGroupsForUser: jest.fn(async () => []),
}));
jest.mock("@/models/authorization/profileAssignmentsStore", () => ({
  listActiveProfileKeys: jest.fn(async () => ({ rows: [] })),
}));
jest.mock("@/services/authorization/contextBootstrap", () => ({
  ensureEligibilitySeeded: jest.fn(async () => true),
}));
jest.mock("@/models/authorization/backfill", () => ({
  ensureCapabilityBackfills: jest.fn(async () => {}),
}));
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [] })) },
  initDb: jest.fn(async () => {}),
}));

const { authorize, resolveAuthorizationContext } = require("@/services/authorization/context");

describe("authorize — la porte du compte (spec §11)", () => {
  const base = (over = {}) => ({
    cid: "U1",
    role: "staff",
    isSuperAdmin: false,
    accountStatus: "active",
    eligibility: { crm: true },
    effective: { crm: { view: 2 } },
    grants: {},
    restrictions: {},
    ...over,
  });

  test("compte actif : la capacité décide normalement", () => {
    expect(authorize(base(), "crm", "view")).toBe(true);
  });

  test.each(["inactive", "pending", "archived", "suspended"])(
    "compte %s : refusé même avec la capacité",
    (status) => {
      expect(authorize(base({ accountStatus: status }), "crm", "view")).toBe(false);
    },
  );

  test("statut inconnu (null) : comportement antérieur conservé", () => {
    expect(authorize(base({ accountStatus: null }), "crm", "view")).toBe(true);
  });

  test("super admin : la porte du compte ne s'applique pas (bypass préservé)", () => {
    const sa = {
      cid: "SA",
      role: "super_admin",
      isSuperAdmin: true,
      accountStatus: "suspended",
      eligibility: null,
      effective: {},
      grants: {},
      restrictions: {},
    };
    expect(authorize(sa, "crm", "view")).toBe(true);
  });
});

describe("resolveAuthorizationContext — expose accountStatus (plomberie)", () => {
  test("un contact non actif est repris dans le contexte et refusé", async () => {
    accountRow.current = { status: "suspended" };
    const ctx = await resolveAuthorizationContext({ cid: "U1", role: "staff" });
    expect(ctx.accountStatus).toBe("suspended");
    expect(authorize(ctx, "crm", "view")).toBe(false);
  });

  test("un contact actif reste autorisé", async () => {
    accountRow.current = { status: "active" };
    const ctx = await resolveAuthorizationContext({ cid: "U1", role: "staff" });
    expect(ctx.accountStatus).toBe("active");
    expect(authorize(ctx, "crm", "view")).toBe(true);
  });

  test("aucune ligne contact : statut null, comportement conservé", async () => {
    accountRow.current = {};
    const ctx = await resolveAuthorizationContext({ cid: "U1", role: "staff" });
    expect(ctx.accountStatus).toBeNull();
    expect(authorize(ctx, "crm", "view")).toBe(true);
  });
});
