/**
 * Venture permission/planning policy regression tests (Phase 5 isolation).
 *
 * These assert the delegation policy that protects other domains:
 *   - global roles are the only org-wide Venture authority;
 *   - delegated staff act only through assignments;
 *   - scoped assignments can view/comment but never author or manage;
 *   - runtime capability resolution honours scope references.
 * Pure unit tests with fake db — no environment, no external modules.
 */

const { hasVentureCapability } = require("@/lib/venturePermissions");
const { allowsPlanAction } = require("@/lib/ventureOperatingPlans");

// ── Fake db: matrix allows every queried cell unless overridden ────────────
function matrixAllowingDb({ allowAllActions = true, allowOnlyAction = null } = {}) {
  return {
    execute: async ({ sql, args }) => {
      if (sql.includes("venture_permission_overrides")) return { rows: [] };
      if (sql.includes("venture_permission_matrix")) {
        const action = args && args.length >= 3 ? args[2] : "view";
        const allowed = allowOnlyAction ? action === allowOnlyAction : allowAllActions;
        return { rows: [{ allowed: allowed ? 1 : 0 }] };
      }
      if (sql.includes("venture_staff_assignments")) return { rows: [] };
      return { rows: [] };
    },
  };
}

describe("allowsPlanAction (operating_plan area policy)", () => {
  const db = matrixAllowingDb();

  it("grants global roles every action", async () => {
    const access = { ok: true, code: "VNT-A", global: true, assignments: [] };
    for (const action of ["view", "create", "edit", "manage", "delete"]) {
      expect(await allowsPlanAction(db, access, action)).toBe(true);
    }
  });

  it("grants a venture-wide Lead Manager the manage action", async () => {
    const access = {
      ok: true, code: "VNT-A", global: false,
      assignments: [{ id: 1, responsibility_code: "lead_manager", scope_type: "venture_wide" }],
    };
    expect(await allowsPlanAction(db, access, "manage")).toBe(true);
    expect(await allowsPlanAction(db, access, "view")).toBe(true);
  });

  it("lets a scoped coach view but NEVER author or manage", async () => {
    const access = {
      ok: true, code: "VNT-A", global: false,
      assignments: [{ id: 2, responsibility_code: "coach", scope_type: "milestone" }],
    };
    expect(await allowsPlanAction(db, access, "view")).toBe(true);
    expect(await allowsPlanAction(db, access, "create")).toBe(false);
    expect(await allowsPlanAction(db, access, "manage")).toBe(false);
    expect(await allowsPlanAction(db, access, "delete")).toBe(false);
  });

  it("denies everything when the matrix denies the cell", async () => {
    const dbDeny = matrixAllowingDb({ allowOnlyAction: "nothing" });
    const access = {
      ok: true, code: "VNT-A", global: false,
      assignments: [{ id: 3, responsibility_code: "coach", scope_type: "venture_wide" }],
    };
    expect(await allowsPlanAction(dbDeny, access, "view")).toBe(false);
  });
});

describe("hasVentureCapability (runtime scope resolution)", () => {
  function scopedDb() {
    return {
      execute: async ({ sql, args }) => {
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
      },
    };
  }

  it("denies scoped access when no scope reference is supplied", async () => {
    const ok = await hasVentureCapability(scopedDb(), {
      ventureId: "VNT-A",
      contactId: "staff-1",
      area: "internal_notes",
      action: "view",
    });
    expect(ok).toBe(false);
  });

  it("grants the capability when the object is inside the assignment scope", async () => {
    const ok = await hasVentureCapability(scopedDb(), {
      ventureId: "VNT-A",
      contactId: "staff-1",
      area: "internal_notes",
      action: "view",
      scopeRefType: "milestone",
      scopeRefId: "42",
    });
    expect(ok).toBe(true);
  });

  it("denies capabilities the matrix does not grant (edit)", async () => {
    const ok = await hasVentureCapability(scopedDb(), {
      ventureId: "VNT-A",
      contactId: "staff-1",
      area: "internal_notes",
      action: "edit",
      scopeRefType: "milestone",
      scopeRefId: "42",
    });
    expect(ok).toBe(false);
  });

  it("denies when the user has no assignment at all", async () => {
    const noAssignmentDb = {
      execute: async ({ sql }) =>
        sql.includes("venture_staff_assignments") ? { rows: [] } : { rows: [] },
    };
    const ok = await hasVentureCapability(noAssignmentDb, {
      ventureId: "VNT-A",
      contactId: "nobody",
      area: "internal_notes",
      action: "view",
      scopeRefType: "milestone",
      scopeRefId: "42",
    });
    expect(ok).toBe(false);
  });
});
