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
const { canManageMilestones, releaseFirstMilestoneForStage, completeStageIfAllMilestonesDone } = require("@/lib/ventureMilestoneEngine");

/** db double with an in-memory venture_milestones table. */
function fakeDb(rows) {
  const state = rows.map((row) => ({ ...row }));
  const calls = [];
  const handler = async (sql, args = []) => {
    calls.push({ sql, args });
    if (sql.includes("SELECT id, display_order FROM venture_milestones")) {
      return {
        rows: [...state].sort(
          (left, right) =>
            (Number(left.display_order) || 0) - (Number(right.display_order) || 0) ||
            String(left.created_at).localeCompare(String(right.created_at)),
        ),
      };
    }
    if (sql.includes("SELECT id, title, status, progress, target_date, display_order, created_at")) {
      return { rows: [...state] };
    }
    if (sql.includes("UPDATE venture_milestones SET display_order = ? WHERE id = ?")) {
      const [order, id] = args;
      const row = state.find((candidate) => String(candidate.id) === String(id));
      if (row) row.display_order = order;
      return { rows: [] };
    }
    return { rows: [] };
  };
  return {
    state,
    calls,
    execute: async ({ sql, args = [] }) => handler(sql, args),
    transaction: async (runInTransaction) => runInTransaction((sql, args = []) => handler(sql, args)),
  };
}

const orderOf = (db) => {
  const sorted = [...db.state].sort(
    (left, right) => (Number(left.display_order) || 0) - (Number(right.display_order) || 0),
  );
  return sorted.map((row) => row.id);
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
    expect(db.state.find((row) => row.id === "m2").display_order).toBe(1);
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

describe("milestone structure authority (matrix `milestones.edit` / Super Admin only)", () => {
  // The authority now comes from the permission MATRIX, so the double models the
  // two queries hasVentureCapability makes: the assignment (responsibility +
  // scope) and the matrix cell for that responsibility. It mirrors the seeded
  // truth — a Lead Manager holds `milestones.edit`, a Coach does not.
  const MATRIX = { lead_manager: true, coach: false };

  function authDb({
    codeRow = { id: "db-1", venture_id: "VNT-1" },
    responsibility = null,
    scope = "venture_wide",
    failCode = false,
  } = {}) {
    return {
      execute: async ({ sql, args }) => {
        if (sql.includes("FROM ventures WHERE venture_id = ? OR id::text = ?")) {
          if (failCode) throw new Error("no ventures table");
          return { rows: codeRow ? [codeRow] : [] };
        }
        if (sql.includes("FROM venture_staff_assignments")) {
          return {
            rows: responsibility
              ? [{
                  responsibility_code: responsibility,
                  scope_type: scope,
                  scope_ref_type: null,
                  scope_ref_id: null,
                }]
              : [],
          };
        }
        if (sql.includes("venture_permission_matrix")) {
          return { rows: [{ allowed: MATRIX[args?.[0]] ? 1 : 0 }] };
        }
        return { rows: [] };
      },
    };
  }

  test("super_admin always may manage milestones", async () => {
    expect(await canManageMilestones(authDb(), { id: "VNT-1", cid: "u1", role: "super_admin" })).toBe(true);
  });

  test("an assigned Lead Manager may manage milestones", async () => {
    expect(
      await canManageMilestones(authDb({ responsibility: "lead_manager" }), {
        id: "VNT-1",
        cid: "lm-1",
        role: "staff",
      }),
    ).toBe(true);
  });

  test("a COACH may not restructure the roadmap, even with a real assignment", async () => {
    // The defect this closes: the matrix said a coach could create/edit a
    // milestone, and the engine's old hand-rolled check disagreed with it. A
    // coach holds a genuine assignment, so the old check's shape was right for a
    // lead manager and wrong here.
    expect(
      await canManageMilestones(authDb({ responsibility: "coach" }), {
        id: "VNT-1",
        cid: "coach-1",
        role: "staff",
      }),
    ).toBe(false);
  });

  test("a milestone-scoped Lead Manager does not confer roadmap restructuring", async () => {
    // The cell is venture-wide: scope narrows where you work, not whether you
    // may rewrite the plan.
    expect(
      await canManageMilestones(authDb({ responsibility: "lead_manager", scope: "milestone" }), {
        id: "VNT-1",
        cid: "lm-2",
        role: "staff",
      }),
    ).toBe(false);
  });

  test("staff with no assignment at all may not", async () => {
    expect(
      await canManageMilestones(authDb({ responsibility: null }), {
        id: "VNT-1",
        cid: "nobody",
        role: "staff",
      }),
    ).toBe(false);
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
    const state = milestones.map((milestone) => ({ ...milestone }));
    const handler = async (sql, args = []) => {
      if (sql.includes("SELECT status FROM venture_journey_stages")) {
        return { rows: stageMissing ? [] : [{ status: stageStatus }] };
      }
      if (sql.includes("SELECT id, status FROM venture_milestones")) {
        return {
          rows: [...state].sort((left, right) => (Number(left.display_order) || 0) - (Number(right.display_order) || 0)),
        };
      }
      if (sql.includes("UPDATE venture_milestones SET status = 'not_started'")) {
        const row = state.find((candidate) => String(candidate.id) === String(args[0]));
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

describe("a journey closes ONLY when every milestone is completed", () => {
  function stageDb({ stages, milestones }) {
    const stageRows = stages.map((stage) => ({ ...stage }));
    const milestoneRows = milestones.map((milestone) => ({ ...milestone }));
    const handler = async (sql, args = []) => {
      if (sql.includes("SELECT id, name, status, stage_order FROM venture_journey_stages")) {
        const stage = stageRows.find((candidate) => String(candidate.id) === String(args[0]));
        return { rows: stage ? [stage] : [] };
      }
      if (sql.includes("SELECT id, status FROM venture_milestones")) {
        return {
          rows: milestoneRows.filter((milestone) => String(milestone.journey_stage_id) === String(args[1])).sort(
            (left, right) => (Number(left.display_order) || 0) - (Number(right.display_order) || 0),
          ),
        };
      }
      if (sql.includes("SELECT status FROM venture_journey_stages WHERE id = ? AND venture_id = ?")) {
        const stage = stageRows.find((candidate) => String(candidate.id) === String(args[0]));
        return { rows: stage ? [{ status: stage.status }] : [] };
      }
      if (sql.includes("UPDATE venture_journey_stages SET status = 'completed'")) {
        const stage = stageRows.find((candidate) => String(candidate.id) === String(args[1]));
        if (stage) { stage.status = "completed"; stage.approved_by = args[0]; }
        return { rows: [] };
      }
      if (sql.includes("SELECT id FROM venture_journey_stages WHERE venture_id = ? AND stage_order = ? AND status = 'locked'")) {
        const stage = stageRows.find((candidate) => Number(candidate.stage_order) === Number(args[1]) && candidate.status === "locked");
        return { rows: stage ? [{ id: stage.id }] : [] };
      }
      if (sql.includes("UPDATE venture_journey_stages SET status = 'active' WHERE id = ?")) {
        const stage = stageRows.find((candidate) => String(candidate.id) === String(args[0]));
        if (stage) stage.status = "active";
        return { rows: [] };
      }
      if (sql.includes("UPDATE venture_milestones SET status = 'not_started'")) {
        const milestone = milestoneRows.find((candidate) => String(candidate.id) === String(args[0]));
        if (milestone && milestone.status === "locked") milestone.status = "not_started";
        return { rows: [] };
      }
      return { rows: [] };
    };
    return { stages: stageRows, milestones: milestoneRows, execute: async ({ sql, args = [] }) => handler(sql, args) };
  }

  test("closes the journey, activates the next one and releases its first milestone", async () => {
    const db = stageDb({
      stages: [
        { id: "s1", name: "Family & Friends", status: "active", stage_order: 1 },
        { id: "s2", name: "GTM", status: "locked", stage_order: 2 },
      ],
      milestones: [
        { id: "m1", status: "completed", journey_stage_id: "s1", display_order: 1 },
        { id: "m2", status: "completed", journey_stage_id: "s1", display_order: 2 },
        { id: "m3", status: "locked", journey_stage_id: "s2", display_order: 1 },
      ],
    });
    const out = await completeStageIfAllMilestonesDone(db, { dbId: "v1", stageId: "s1", cid: "lm-1" });
    expect(out.completed).toBe(true);
    expect(out.next_stage_id).toBe("s2");
    expect(db.stages.find((stage) => stage.id === "s1").status).toBe("completed");
    expect(db.stages.find((stage) => stage.id === "s2").status).toBe("active");
    expect(db.milestones.find((milestone) => milestone.id === "m3").status).toBe("not_started");
  });

  test("does not close while any milestone is still open", async () => {
    const db = stageDb({
      stages: [{ id: "s1", name: "A", status: "active", stage_order: 1 }],
      milestones: [
        { id: "m1", status: "completed", journey_stage_id: "s1", display_order: 1 },
        { id: "m2", status: "in_progress", journey_stage_id: "s1", display_order: 2 },
      ],
    });
    const out = await completeStageIfAllMilestonesDone(db, { dbId: "v1", stageId: "s1" });
    expect(out.completed).toBe(false);
    expect(db.stages[0].status).toBe("active");
  });

  test("a journey with no milestones never closes (nothing to close on)", async () => {
    const db = stageDb({ stages: [{ id: "s1", name: "A", status: "active", stage_order: 1 }], milestones: [] });
    const out = await completeStageIfAllMilestonesDone(db, { dbId: "v1", stageId: "s1" });
    expect(out.completed).toBe(false);
    expect(db.stages[0].status).toBe("active");
  });

  test("only an active journey can close", async () => {
    const db = stageDb({
      stages: [{ id: "s1", name: "A", status: "locked", stage_order: 1 }],
      milestones: [{ id: "m1", status: "completed", journey_stage_id: "s1", display_order: 1 }],
    });
    const out = await completeStageIfAllMilestonesDone(db, { dbId: "v1", stageId: "s1" });
    expect(out.completed).toBe(false);
  });
});
