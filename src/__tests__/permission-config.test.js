/**
 * Configuration-driven permission model (Phase 3).
 *
 * These tests prove the ENGINE reacts to persisted CONFIGURATION (profile
 * rows + eligibility + grants + restrictions) — not to hard-coded matrices.
 * Simulating "Super Admin changes the configuration" = changing the profile
 * rows passed through mergeEffectiveCapabilities, exactly as the resolver
 * reads them from access_profile_capabilities.
 */
const { authorize, mergeEffectiveCapabilities } = require("@/lib/authorization/resolver");
const { MODULE_TO_FEATURE } = require("@/lib/authorization/eligibility");

function resolveCtx({ role = "staff", eligibility = {}, profileCaps = {}, grants = {}, restrictions = {} }) {
  return {
    cid: "U1",
    role,
    isSuperAdmin: false,
    eligibility,
    effective: mergeEffectiveCapabilities(profileCaps, {}, grants, restrictions),
    grants,
    restrictions,
  };
}

// Staff is eligible for every module-mapped feature (approved matrix).
const STAFF_ELIG = Object.fromEntries(
  Object.keys(MODULE_TO_FEATURE).map((m) => [MODULE_TO_FEATURE[m], true]),
);

// The NEW Staff Default profile rows (post Phase 3 configuration).
const NEW_STAFF_DEFAULT = {
  reports: { create: 2 }, // Weekly Operations (standups/retros) — kept by design
  projects: { view: 1, create: 2, edit: 3, delete: 4 }, // matrix Projects = 4
  tasks: { view: 1, create: 2, edit: 3, delete: 4 }, // unchanged (not in matrix)
  messaging: { view: 1, send: 2 }, // unchanged
  internal_comms: { create_announcements: 2, moderate: 3 }, // unchanged (not in matrix)
  investor: { view: 1, create: 2, edit: 3 }, // unchanged (not in matrix)
};

describe("Configuration-driven permission model (Phase 3)", () => {
  test("TEST 1 — Staff eligible for CRM with default 0: no automatic CRM access", () => {
    const ctx = resolveCtx({ eligibility: STAFF_ELIG, profileCaps: NEW_STAFF_DEFAULT });
    expect(authorize(ctx, "contacts", "view")).toBe(false);
  });

  test("TEST 2 — config change CRM default 0→1: view allowed, create still denied", () => {
    const withCrmView = { ...NEW_STAFF_DEFAULT, contacts: { view: 1 } };
    const ctx = resolveCtx({ eligibility: STAFF_ELIG, profileCaps: withCrmView });
    expect(authorize(ctx, "contacts", "view")).toBe(true);
    expect(authorize(ctx, "contacts", "create")).toBe(false);
  });

  test("TEST 3 — config change CRM default 1→4: full CRUD", () => {
    const withCrmFull = { ...NEW_STAFF_DEFAULT, contacts: { view: 1, create: 2, edit: 3, delete: 4 } };
    const ctx = resolveCtx({ eligibility: STAFF_ELIG, profileCaps: withCrmFull });
    expect(authorize(ctx, "contacts", "view")).toBe(true);
    expect(authorize(ctx, "contacts", "create")).toBe(true);
    expect(authorize(ctx, "contacts", "edit")).toBe(true);
    expect(authorize(ctx, "contacts", "delete")).toBe(true);
  });

  test("TEST 4 — individual grant works for an eligible Staff member", () => {
    const ctx = resolveCtx({ eligibility: STAFF_ELIG, profileCaps: NEW_STAFF_DEFAULT, grants: { contacts: { view: 3 } } });
    expect(authorize(ctx, "contacts", "view")).toBe(true);
  });

  test("TEST 5 — ineligible user: individual grant cannot bypass eligibility", () => {
    const ctx = resolveCtx({ eligibility: { crm: false }, profileCaps: NEW_STAFF_DEFAULT, grants: { contacts: { view: 3 } } });
    expect(authorize(ctx, "contacts", "view")).toBe(false);
  });

  test("TEST 6 — individual restriction removes Delete even at CRUD 4", () => {
    const withCrmFull = { ...NEW_STAFF_DEFAULT, contacts: { view: 1, create: 2, edit: 3, delete: 4 } };
    const ctx = resolveCtx({
      eligibility: STAFF_ELIG,
      profileCaps: withCrmFull,
      restrictions: { contacts: new Set(["delete"]) },
    });
    expect(authorize(ctx, "contacts", "view")).toBe(true);
    expect(authorize(ctx, "contacts", "delete")).toBe(false);
  });

  test("TEST 7/8 — Weekly Operations works; general Reports access is NOT in the staff default", () => {
    const ctx = resolveCtx({ eligibility: STAFF_ELIG, profileCaps: NEW_STAFF_DEFAULT });
    // standup/retro/op-report submission rides on reports.create
    expect(authorize(ctx, "reports", "create")).toBe(true);
    // ...but staff get no general reports module access (no view/delete)
    expect(authorize(ctx, "reports", "view")).toBe(false);
    expect(authorize(ctx, "reports", "delete")).toBe(false);
  });

  test("TEST 9 — Participant default (no projects): global Projects denied", () => {
    const participantDefault = { messaging: { view: 1, send: 2 } };
    const ctx = resolveCtx({ role: "participant", eligibility: { internal_comms: true }, profileCaps: participantDefault });
    expect(authorize(ctx, "projects", "view")).toBe(false);
  });

  test("TEST 10 — knowledge/programs/ventures are eligible for Staff but NOT in the new default", () => {
    const ctx = resolveCtx({ eligibility: STAFF_ELIG, profileCaps: NEW_STAFF_DEFAULT });
    expect(authorize(ctx, "knowledge", "view")).toBe(false);
    expect(authorize(ctx, "programs", "edit")).toBe(false);
    expect(authorize(ctx, "ventures", "create")).toBe(false);
  });
});
