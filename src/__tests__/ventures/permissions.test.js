/**
 * Venture permission/planning policy regression tests (Phase 5 isolation).
 *
 * These assert the delegation policy that protects other domains:
 *   - global roles are the only org-wide Venture authority;
 *   - delegated staff act only through assignments;
 *   - scoped assignments can view/comment but never author or manage;
 *   - runtime capability resolution honours scope references.
 *
 * `hasVentureCapability` now reads through a store that owns its db, so its
 * table shape is driven by the module mock; `allowsPlanAction` still takes an
 * injected db and keeps its local double.
 */

jest.mock("@/lib/db", () => {
  const state = { handler: async () => ({ rows: [] }) };
  return {
    __esModule: true,
    default: { execute: jest.fn(async ({ sql, args = [] }) => state.handler(sql, args)) },
    initDb: jest.fn().mockResolvedValue(true),
    __state: state,
  };
});

const { __state: mockState } = require("@/lib/db");
const { hasVentureCapability } = require("@/services/ventures/permissions");
const { allowsPlanAction } = require("@/services/ventures/operatingPlans");

// ── Fake db: matrix allows every queried cell unless overridden ────────────
function installMatrix({ allowAllActions = true, allowOnlyAction = null } = {}) {
  mockState.handler = async (sql, args) => {
    if (sql.includes("venture_permission_overrides")) return { rows: [] };
    if (sql.includes("venture_permission_matrix")) {
      const action = args && args.length >= 3 ? args[2] : "view";
      const allowed = allowOnlyAction ? action === allowOnlyAction : allowAllActions;
      return { rows: [{ allowed: allowed ? 1 : 0 }] };
    }
    if (sql.includes("venture_staff_assignments")) return { rows: [] };
    return { rows: [] };
  };
}

describe("allowsPlanAction (operating_plan area policy)", () => {
  it("grants global roles every action", async () => {
    installMatrix();
    const access = { ok: true, code: "VNT-A", global: true, assignments: [] };
    for (const action of ["view", "create", "edit", "manage", "delete"]) {
      expect(await allowsPlanAction(access, action)).toBe(true);
    }
  });

  it("grants a venture-wide Lead Manager the manage action", async () => {
    installMatrix();
    const access = {
      ok: true, code: "VNT-A", global: false,
      assignments: [{ id: 1, responsibility_code: "lead_manager", scope_type: "venture_wide" }],
    };
    expect(await allowsPlanAction(access, "manage")).toBe(true);
    expect(await allowsPlanAction(access, "view")).toBe(true);
  });

  it("never lets a venture-wide Lead Manager delete — the matrix has no say on it", async () => {
    // installMatrix() allows EVERY cell, so this proves the refusal is the
    // policy's own rule and not a dependent of the matrix: permanent deletion
    // is a Super Admin act, never delegated.
    installMatrix();
    const access = {
      ok: true, code: "VNT-A", global: false,
      assignments: [{ id: 1, responsibility_code: "lead_manager", scope_type: "venture_wide" }],
    };
    expect(await allowsPlanAction(access, "manage")).toBe(true);
    expect(await allowsPlanAction(access, "delete")).toBe(false);
  });

  it("lets a scoped coach view but NEVER author or manage", async () => {
    installMatrix();
    const access = {
      ok: true, code: "VNT-A", global: false,
      assignments: [{ id: 2, responsibility_code: "coach", scope_type: "milestone" }],
    };
    expect(await allowsPlanAction(access, "view")).toBe(true);
    expect(await allowsPlanAction(access, "create")).toBe(false);
    expect(await allowsPlanAction(access, "manage")).toBe(false);
    expect(await allowsPlanAction(access, "delete")).toBe(false);
  });

  it("denies everything when the matrix denies the cell", async () => {
    installMatrix({ allowOnlyAction: "nothing" });
    const access = {
      ok: true, code: "VNT-A", global: false,
      assignments: [{ id: 3, responsibility_code: "coach", scope_type: "venture_wide" }],
    };
    expect(await allowsPlanAction(access, "view")).toBe(false);
  });
});

describe("hasVentureCapability (runtime scope resolution)", () => {
  /** A coach scoped to milestone 42, granting only the `view` cell. */
  function installScopedDb() {
    mockState.handler = async (sql, args) => {
      if (sql.includes("venture_staff_assignments")) {
        return {
          rows: [
            {
              responsibility_code: "coach",
              scope_type: "milestone",
              scope_ref_type: "milestone",
              scope_ref_id: "42",
            },
          ],
        };
      }
      if (sql.includes("venture_permission_overrides")) return { rows: [] };
      if (sql.includes("venture_permission_matrix")) {
        const action = args && args.length >= 3 ? args[2] : "view";
        return { rows: [{ allowed: action === "view" ? 1 : 0 }] };
      }
      return { rows: [] };
    };
  }

  it("denies scoped access when no scope reference is supplied", async () => {
    installScopedDb();
    const allowed = await hasVentureCapability({
      ventureId: "VNT-A",
      contactId: "staff-1",
      area: "internal_notes",
      action: "view",
    });
    expect(allowed).toBe(false);
  });

  it("grants the capability when the object is inside the assignment scope", async () => {
    installScopedDb();
    const allowed = await hasVentureCapability({
      ventureId: "VNT-A",
      contactId: "staff-1",
      area: "internal_notes",
      action: "view",
      scopeRefType: "milestone",
      scopeRefId: "42",
    });
    expect(allowed).toBe(true);
  });

  it("denies capabilities the matrix does not grant (edit)", async () => {
    installScopedDb();
    const allowed = await hasVentureCapability({
      ventureId: "VNT-A",
      contactId: "staff-1",
      area: "internal_notes",
      action: "edit",
      scopeRefType: "milestone",
      scopeRefId: "42",
    });
    expect(allowed).toBe(false);
  });

  it("denies when the user has no assignment at all", async () => {
    mockState.handler = async () => ({ rows: [] });
    const allowed = await hasVentureCapability({
      ventureId: "VNT-A",
      contactId: "nobody",
      area: "internal_notes",
      action: "view",
      scopeRefType: "milestone",
      scopeRefId: "42",
    });
    expect(allowed).toBe(false);
  });
});
