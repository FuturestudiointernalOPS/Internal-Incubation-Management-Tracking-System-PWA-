/**
 * Phase 4 security verification — staff-actor gate (ventureAuth).
 *
 * The staff-actor helper decides who may use staff instruments (review
 * queues, investment/fundraising mutations, analytics). These tests pin:
 *  - global Venture authority always passes;
 *  - founders/team members (mere membership) never pass;
 *  - plain staff WITHOUT an assignment never pass;
 *  - delegated staff WITH an active assignment pass;
 *  - internal-UUID ids resolve to the VNT code before the assignment check.
 *
 * The gate now reads through a store that owns its db, so the table shape is
 * driven by the module mock rather than an injected double.
 */

jest.mock("@/lib/auth", () => ({ getSession: jest.fn() }));

jest.mock("@/lib/db", () => {
  const state = { calls: [], assigned: false };
  const execute = jest.fn(async ({ sql, args = [] }) => {
    state.calls.push({ sql, args });
    // The Venture's own facts, whatever shape of id the caller named it by.
    if (sql.includes("FROM ventures")) {
      return { rows: [{ code: "VNT-RESOLVED", status: "active", is_archived: 0 }] };
    }
    // Membership and the delegated assignment are asked in ONE statement.
    if (sql.includes("FROM venture_members") || sql.includes("venture_staff_assignments")) {
      return { rows: [{ is_member: false, is_assigned: state.assigned }] };
    }
    return { rows: [] };
  });
  return {
    __esModule: true,
    default: { execute },
    initDb: jest.fn().mockResolvedValue(true),
    __state: state,
  };
});

const mockDb = require("@/lib/db").default;
const { __state: state } = require("@/lib/db");
const { isStaffActorForVenture } = require("@/lib/ventureAuth");
const { resetVentureAccessCache } = require("@/lib/ventureAccessFacts");

// The relationship is remembered process-wide for a real 10 s window: empty it
// per test so one test's assignment cannot answer the next one's question.
beforeEach(() => {
  resetVentureAccessCache();
  state.calls.length = 0;
  state.assigned = false;
});

function makeDb({ assigned = false } = {}) {
  state.assigned = assigned;
  return { execute: mockDb.execute, calls: state.calls };
}

describe("isStaffActorForVenture", () => {
  it("grants global Venture authority without any DB lookup", async () => {
    const db = makeDb();
    const allowed = await isStaffActorForVenture("VNT-ABC", { role: "super_admin", cid: "sa" });
    expect(allowed).toBe(true);
    expect(db.execute).not.toHaveBeenCalled();
  });

  it("no longer grants the retired developer/admin roles (they resolve to staff/none)", async () => {
    makeDb();
    expect(await isStaffActorForVenture("VNT-ABC", { role: "developer", cid: "d1" })).toBe(false);
    expect(await isStaffActorForVenture("VNT-ABC", { role: "admin", cid: "a1" })).toBe(false);
  });

  it("denies a member (founder) with no assignment", async () => {
    makeDb({ assigned: false });
    const allowed = await isStaffActorForVenture("VNT-ABC", { role: "founder", cid: "F-1" });
    expect(allowed).toBe(false);
  });

  it("denies plain staff WITHOUT an assignment", async () => {
    makeDb({ assigned: false });
    const allowed = await isStaffActorForVenture("VNT-ABC", { role: "staff", cid: "S-1" });
    expect(allowed).toBe(false);
  });

  it("grants delegated staff WITH an active assignment", async () => {
    makeDb({ assigned: true });
    const allowed = await isStaffActorForVenture("VNT-ABC", { role: "staff", cid: "S-1" });
    expect(allowed).toBe(true);
  });

  it("resolves an internal UUID before checking the assignment", async () => {
    const db = makeDb({ assigned: true });
    const allowed = await isStaffActorForVenture("11111111-1111-1111-1111-111111111111", { role: "staff", cid: "S-1" });
    expect(allowed).toBe(true);
    expect(db.calls[0].args[0]).toBe("11111111-1111-1111-1111-111111111111");
    // Second call is the assignment lookup against the resolved VNT code.
    expect(db.calls[1].sql).toContain("venture_staff_assignments");
    expect(db.calls[1].args[0]).toBe("VNT-RESOLVED");
  });

  it("denies when there is no session", async () => {
    makeDb();
    expect(await isStaffActorForVenture("VNT-ABC", null)).toBe(false);
  });
});
