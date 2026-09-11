/**
 * Phase 1 — milestones inside a journey.
 *
 * Locks in the two pieces of logic the new UI depends on:
 *   1. milestone ordering (display_order normalization + up/down swap)
 *   2. milestone STRUCTURE authority (Lead Manager / Super Admin only)
 *
 * Pure functions with injected db doubles — no module mocking needed.
 */
const { moveStageMilestone, listStageMilestones } = require("@/lib/ventureMilestoneOrder");
const { canManageMilestones, releaseFirstMilestoneForStage } = require("@/lib/ventureMilestoneEngine");

/** db double with an in-memory venture_milestones table. */
function fakeDb(rows) {
  const state = rows.map((r) => ({ ...r }));
  const calls = [];
  const handler = async (sql, args = []) => {
    calls.push({ sql, args });
    if (sql.includes("SELECT id, display_order FROM venture_milestones")) {
      return {
        rows: [...state].sort(
          (a, b) =>
            (Number(a.display_order) || 0) - (Number(b.display_order) || 0) ||
            String(a.created_at).localeCompare(String(b.created_at)),
        ),
      };
    }
    if (sql.includes("SELECT id, title, status, progress, target_date, display_order, created_at")) {
      return { rows: [...state] };
    }
    if (sql.includes("UPDATE venture_milestones SET display_order = ? WHERE id = ?")) {
      const [order, id] = args;
      const row = state.find((r) => String(r.id) === String(id));
      if (row) row.display_order = order;
      return { rows: [] };
    }
    return { rows: [] };
  };
  return {
    state,
    calls,
    execute: async ({ sql, args = [] }) => handler(sql, args),
    transaction: async (cb) => cb((sql, args = []) => handler(sql, args)),
  };
}

const orderOf = (db) => {
  const sorted = [...db.state].sort(
    (a, b) => (Number(a.display_order) || 0) - (Number(b.display_order) || 0),
  );
  return sorted.map((r) => r.id);
};

describe("milestone ordering inside a journey", () => {
  test("moves a milestone up by swapping display order", async () => {
    const db = fakeDb([
      { id: "m1", display_order: 1, created_at: "2026-01-01" },
      { id: "m2", display_order: 2, created_at: "2026-01-02" },
      { id: "m3", display_order: 3, created_at: "2026-01-03" },
    ]);
    const res = await moveStageMilestone(db, { dbId: "v1", stageId: "s1", milestoneId: "m3", direction: "up" });
    expect(res.success).toBe(true);
    expect(orderOf(db)).toEqual(["m1", "m3", "m2"]);
  });

  test("moves a milestone down by swapping display order", async () => {
    const db = fakeDb([
      { id: "m1", display_order: 1, created_at: "2026-01-01" },
      { id: "m2", display_order: 2, created_at: "2026-01-02" },
    ]);
    const res = await moveStageMilestone(db, { dbId: "v1", stageId: "s1", milestoneId: "m1", direction: "down" });
    expect(res.success).toBe(true);
    expect(orderOf(db)).toEqual(["m2", "m1"]);
  });

  test("normalizes legacy rows with NULL display_order before swapping", async () => {
    const db = fakeDb([
      { id: "m1", display_order: null, created_at: "2026-01-01" },
      { id: "m2", display_order: null, created_at: "2026-01-02" },
    ]);
    const res = await moveStageMilestone(db, { dbId: "v1", stageId: "s1", milestoneId: "m2", direction: "up" });
    expect(res.success).toBe(true);
    expect(orderOf(db)).toEqual(["m2", "m1"]);
    expect(db.state.find((r) => r.id === "m2").display_order).toBe(1);
  });

  test("refuses to move past the edge", async () => {
    const db = fakeDb([
      { id: "m1", display_order: 1, created_at: "2026-01-01" },
      { id: "m2", display_order: 2, created_at: "2026-01-02" },
    ]);
    const res = await moveStageMilestone(db, { dbId: "v1", stageId: "s1", milestoneId: "m1", direction: "up" });
    expect(res.error).toBe("Already at the edge.");
    expect(orderOf(db)).toEqual(["m1", "m2"]);
  });

  test("reports an unknown milestone", async () => {
    const db = fakeDb([{ id: "m1", display_order: 1, created_at: "2026-01-01" }]);
    const res = await moveStageMilestone(db, { dbId: "v1", stageId: "s1", milestoneId: "nope", direction: "up" });
    expect(res.error).toBe("Milestone not found in this journey.");
  });

  test("listStageMilestones returns an empty list when the read fails", async () => {
    const db = { execute: async () => { throw new Error("missing column"); } };
    expect(await listStageMilestones(db, { dbId: "v1", stageId: "s1" })).toEqual([]);
  });
});

describe("milestone structure authority (Lead Manager / Super Admin only)", () => {
  function authDb({ codeRow = { id: "db-1", venture_id: "VNT-1" }, assignment = false, failCode = false } = {}) {
    return {
      execute: async ({ sql }) => {
        if (sql.includes("FROM ventures WHERE venture_id = ? OR id::text = ?")) {
          if (failCode) throw new Error("no ventures table");
          return { rows: codeRow ? [codeRow] : [] };
        }
        if (sql.includes("FROM venture_staff_assignments")) {
          return { rows: assignment ? [{ "?column?": 1 }] : [] };
        }
        return { rows: [] };
      },
    };
  }

  test("super_admin always may manage milestones", async () => {
    expect(await canManageMilestones(authDb(), { id: "VNT-1", cid: "u1", role: "super_admin" })).toBe(true);
  });

  test("an assigned Lead Manager may manage milestones", async () => {
    expect(await canManageMilestones(authDb({ assignment: true }), { id: "VNT-1", cid: "lm-1", role: "staff" })).toBe(true);
  });

  test("staff without a lead_manager assignment may not", async () => {
    expect(await canManageMilestones(authDb({ assignment: false }), { id: "VNT-1", cid: "coach-1", role: "staff" })).toBe(false);
  });

  test("members (no cid) may not", async () => {
    expect(await canManageMilestones(authDb(), { id: "VNT-1", cid: null, role: "member" })).toBe(false);
  });

  test("an unresolvable venture is denied (fails closed)", async () => {
    expect(await canManageMilestones(authDb({ failCode: true }), { id: "VNT-9", cid: "lm-1", role: "staff" })).toBe(false);
  });
});

describe("release chain — first unfinished milestone of an active journey", () => {
  function releaseDb({ stageStatus = "active", stageMissing = false, milestones = [] } = {}) {
    const state = milestones.map((m) => ({ ...m }));
    const handler = async (sql, args = []) => {
      if (sql.includes("SELECT status FROM venture_journey_stages")) {
        return { rows: stageMissing ? [] : [{ status: stageStatus }] };
      }
      if (sql.includes("SELECT id, status FROM venture_milestones")) {
        return {
          rows: [...state].sort((a, b) => (Number(a.display_order) || 0) - (Number(b.display_order) || 0)),
        };
      }
      if (sql.includes("UPDATE venture_milestones SET status = 'not_started'")) {
        const row = state.find((r) => String(r.id) === String(args[0]));
        if (row && row.status === "locked") row.status = "not_started";
        return { rows: [] };
      }
      return { rows: [] };
    };
    return { state, execute: async ({ sql, args = [] }) => handler(sql, args) };
  }

  test("releases the first locked milestone when the journey is active", async () => {
    const db = releaseDb({ milestones: [{ id: "m1", status: "locked", display_order: 1 }] });
    const out = await releaseFirstMilestoneForStage(db, { dbId: "v1", stageId: "s1" });
    expect(out.released_milestone_id).toBe("m1");
    expect(db.state[0].status).toBe("not_started");
  });

  test("skips completed milestones and releases the next locked one", async () => {
    const db = releaseDb({
      milestones: [
        { id: "m1", status: "completed", display_order: 1 },
        { id: "m2", status: "locked", display_order: 2 },
      ],
    });
    const out = await releaseFirstMilestoneForStage(db, { dbId: "v1", stageId: "s1" });
    expect(out.released_milestone_id).toBe("m2");
  });

  test("does nothing when the first unfinished milestone is already released", async () => {
    const db = releaseDb({
      milestones: [
        { id: "m1", status: "in_progress", display_order: 1 },
        { id: "m2", status: "locked", display_order: 2 },
      ],
    });
    const out = await releaseFirstMilestoneForStage(db, { dbId: "v1", stageId: "s1" });
    expect(out.released_milestone_id).toBe(null);
    expect(db.state[1].status).toBe("locked");
  });

  test("does nothing while the journey is not active", async () => {
    const db = releaseDb({ stageStatus: "locked", milestones: [{ id: "m1", status: "locked", display_order: 1 }] });
    const out = await releaseFirstMilestoneForStage(db, { dbId: "v1", stageId: "s1" });
    expect(out.released_milestone_id).toBe(null);
    expect(db.state[0].status).toBe("locked");
  });

  test("does nothing when the journey cannot be resolved", async () => {
    const db = releaseDb({ stageMissing: true, milestones: [{ id: "m1", status: "locked", display_order: 1 }] });
    const out = await releaseFirstMilestoneForStage(db, { dbId: "v1", stageId: "s1" });
    expect(out.released_milestone_id).toBe(null);
  });

  test("does nothing when the journey has no milestones", async () => {
    const db = releaseDb();
    const out = await releaseFirstMilestoneForStage(db, { dbId: "v1", stageId: "s1" });
    expect(out.released_milestone_id).toBe(null);
  });
});
