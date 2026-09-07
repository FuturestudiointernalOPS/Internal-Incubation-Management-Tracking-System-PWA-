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
 */

jest.mock("@/lib/auth", () => ({ getSession: jest.fn() }));

const { isStaffActorForVenture } = require("@/lib/ventureAuth");

function makeDb({ assigned = false, rowsFor = () => null } = {}) {
  const calls = [];
  const execute = jest.fn(async ({ sql, args = [] }) => {
    calls.push({ sql, args });
    if (sql.includes("SELECT venture_id FROM ventures WHERE id = ?")) {
      return { rows: [{ venture_id: "VNT-RESOLVED" }] };
    }
    if (sql.includes("venture_staff_assignments") && assigned) {
      return { rows: [{}] }; // active assignment exists
    }
    if (rowsFor) {
      const custom = rowsFor(sql, args);
      if (custom !== null) return { rows: custom };
    }
    return { rows: [] };
  });
  return { execute, calls };
}

describe("isStaffActorForVenture", () => {
  it("grants global Venture authority without any DB lookup", async () => {
    const db = makeDb();
    const ok = await isStaffActorForVenture(db, "VNT-ABC", { role: "super_admin", cid: "sa" });
    expect(ok).toBe(true);
    expect(db.execute).not.toHaveBeenCalled();
  });

  it("grants developer and admin roles too", async () => {
    const db = makeDb();
    expect(await isStaffActorForVenture(db, "VNT-ABC", { role: "developer", cid: "d1" })).toBe(true);
    expect(await isStaffActorForVenture(db, "VNT-ABC", { role: "admin", cid: "a1" })).toBe(true);
  });

  it("denies a member (founder) with no assignment", async () => {
    const db = makeDb({ assigned: false });
    const ok = await isStaffActorForVenture(db, "VNT-ABC", { role: "founder", cid: "F-1" });
    expect(ok).toBe(false);
  });

  it("denies plain staff WITHOUT an assignment", async () => {
    const db = makeDb({ assigned: false });
    const ok = await isStaffActorForVenture(db, "VNT-ABC", { role: "staff", cid: "S-1" });
    expect(ok).toBe(false);
  });

  it("grants delegated staff WITH an active assignment", async () => {
    const db = makeDb({ assigned: true });
    const ok = await isStaffActorForVenture(db, "VNT-ABC", { role: "staff", cid: "S-1" });
    expect(ok).toBe(true);
  });

  it("resolves an internal UUID before checking the assignment", async () => {
    const db = makeDb({ assigned: true });
    const ok = await isStaffActorForVenture(db, "11111111-1111-1111-1111-111111111111", { role: "staff", cid: "S-1" });
    expect(ok).toBe(true);
    expect(db.calls[0].args[0]).toBe("11111111-1111-1111-1111-111111111111");
    // Second call is the assignment lookup against the resolved VNT code.
    expect(db.calls[1].sql).toContain("venture_staff_assignments");
    expect(db.calls[1].args[0]).toBe("VNT-RESOLVED");
  });

  it("denies when there is no session", async () => {
    const db = makeDb();
    expect(await isStaffActorForVenture(db, "VNT-ABC", null)).toBe(false);
  });
});
