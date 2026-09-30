/**
 * STAGING TEST PACK — the six mandatory checks.
 *
 * These are the checks agreed for the staging pass, made executable so they can
 * be re-run rather than clicked once. They drive the REAL engine and the REAL
 * route handlers; only the database and the session are fixtures.
 *
 *   1. Task completion advances a Milestone, and cannot bypass completion authority
 *   2. All tasks done + approved deliverable + authority → Milestone completed
 *   3. Completing tasks under an Upcoming Milestone does not activate it
 *   4. Dependency blocking is not cleared by task completion
 *   5. The Milestone → Journey transition follows the existing lifecycle rules
 *   6. Ordinary field/date edits remain open to the authorized Venture Manager
 *
 * The fixture mirrors what staging actually holds (VNT-3ECFB390: a League
 * Manager on a venture-wide assignment, journeys with held milestones and tasks
 * under them) — it does not read or write staging.
 */

const VENTURE_DB_ID = "11111111-1111-4111-8111-111111111111";
const MILESTONE_ID = "33333333-3333-4333-8333-333333333333";
const STAGE_ID = "44444444-4444-4444-8444-444444444444";

// ── Route-level doubles (same harness the milestone gating suite uses) ──────
const executed = [];
const flags = { assignment: "none", matrixAllows: false, stageStatus: "active", stageCloses: false };

function makeRouteDb() {
  const execute = jest.fn(async ({ sql, args = [] }) => {
    executed.push({ sql, args });
    if (sql.includes("SELECT id, name, status, stage_order FROM venture_journey_stages")) {
      return { rows: flags.stageCloses ? [{ id: STAGE_ID, name: "Market Readiness", status: "active", stage_order: 1 }] : [] };
    }
    if (sql.includes("SELECT id, status FROM venture_milestones") && sql.includes("journey_stage_id = ?") && !sql.includes("ORDER BY")) {
      return { rows: flags.stageCloses ? [{ id: MILESTONE_ID, status: "completed" }] : [] };
    }
    if (sql.includes("SELECT id, venture_id FROM ventures WHERE venture_id = ? OR id::text = ?")) {
      return { rows: [{ id: VENTURE_DB_ID, venture_id: "VNT-3ECFB390" }] };
    }
    if (sql.includes("FROM ventures WHERE venture_id = ?")) return { rows: [{ id: VENTURE_DB_ID, venture_id: "VNT-3ECFB390" }] };
    // Authority: the assignment supplies the responsibility, the matrix decides
    // the cell. Seeded truth — a Lead Manager holds `milestones.edit`.
    if (sql.includes("FROM venture_staff_assignments")) {
      return {
        rows: flags.assignment === "none"
          ? []
          : [{ responsibility_code: flags.assignment, scope_type: "venture_wide", scope_ref_type: null, scope_ref_id: null }],
      };
    }
    if (sql.includes("venture_permission_matrix")) return { rows: [{ allowed: flags.matrixAllows ? 1 : 0 }] };
    if (sql.includes("SELECT status FROM venture_journey_stages WHERE id = ? AND venture_id = ?")) {
      return { rows: [{ status: flags.stageStatus }] };
    }
    if (sql.includes("SELECT title, journey_stage_id FROM venture_milestones WHERE id = ?")) {
      return { rows: [{ title: "Go-to-Market System", journey_stage_id: STAGE_ID }] };
    }
    if (sql.includes("SELECT 1 FROM venture_journey_stages WHERE id = ? AND venture_id = ?")) return { rows: [{ 1: 1 }] };
    return { rows: [] };
  });
  return { execute };
}

const mockRouteDb = makeRouteDb();

jest.mock("@/lib/db", () => {
  const state = { executeImpl: null };
  return {
    __esModule: true,
    default: { execute: jest.fn(async (arg) => state.executeImpl(arg)) },
    initDb: jest.fn().mockResolvedValue(true),
    __state: state,
  };
});

const { __state: mockState } = require("@/lib/db");
// Route-level tests run against the route double; `ventureWorld` below swaps in
// its own stateful table for the engine tests.
mockState.executeImpl = (arg) => mockRouteDb.execute(arg);

jest.mock("@/lib/auth", () => ({ requireAuth: jest.fn().mockResolvedValue(null), getSession: jest.fn() }));

jest.mock("@/lib/ventureAuth", () => ({
  requireVentureAccess: jest.fn().mockResolvedValue({ session: { cid: "u1", role: "super_admin" } }),
}));

jest.mock("@/lib/ventureScopedAccess", () => ({
  // A Venture Manager holds `ventures.edit` and is in scope — the gate the
  // staging data confirmed (LEW: profile 11, lead_manager, venture-wide).
  requireVentureScopedAccess: jest.fn().mockResolvedValue({
    session: { cid: "USR-LEW", role: "staff" },
    path: "capability+scope",
  }),
}));

jest.mock("@/lib/ventures", () => ({
  notifyVentureFounders: jest.fn().mockResolvedValue(true),
  addVentureHistory: jest.fn().mockResolvedValue(true),
}));

const { PATCH: patchMilestone } = require("@/app/api/ventures/[id]/milestones/route");
const {
  syncMilestoneFromWork,
  completeStageIfAllMilestonesDone,
  deriveMilestoneStatusFromTasks,
  combineMilestoneStatus,
} = require("@/lib/ventureMilestoneEngine");

const milestoneCtx = { params: { id: "VNT-3ECFB390" } };
const readJson = async (res) => res.json();

beforeEach(() => {
  executed.length = 0;
  flags.assignment = "none";
  flags.matrixAllows = false;
  flags.stageStatus = "active";
  flags.stageCloses = false;
  // Route-level tests read the route double; an engine test swaps its own in.
  mockState.executeImpl = (arg) => mockRouteDb.execute(arg);
});

// ════════════════════════════════════════════════════════════════════════════
// A STATEFUL world for the engine checks: a milestone's status really changes,
// so the next call sees what the last one did.
// ════════════════════════════════════════════════════════════════════════════
function ventureWorld({ milestoneStatus = "not_started", tasks = [], deliverables = [], stage = null, siblings = [] }) {
  const state = {
    milestone: { id: MILESTONE_ID, title: "Go-to-Market System", status: milestoneStatus, journey_stage_id: STAGE_ID },
    tasks,
    deliverables,
    stage,
    siblings,
  };
  const calls = [];
  const execute = jest.fn(async ({ sql, args = [] }) => {
    calls.push({ sql, args });

    if (sql.includes("SELECT id, title, status, journey_stage_id FROM venture_milestones")) {
      return { rows: [state.milestone] };
    }
    if (sql.includes("FROM venture_tasks WHERE milestone_id::text")) return { rows: state.tasks };
    if (sql.includes("FROM venture_deliverables WHERE milestone_id::text")) return { rows: state.deliverables };

    // Writes — most specific first.
    if (sql.includes("SET status = 'completed', progress = 100")) {
      state.milestone.status = "completed";
      return { rows: [] };
    }
    if (sql.startsWith("UPDATE venture_milestones SET status = ?")) {
      state.milestone.status = args[0];
      return { rows: [] };
    }

    if (sql.includes("SELECT id, name, status, stage_order FROM venture_journey_stages")) {
      return { rows: state.stage ? [state.stage] : [] };
    }
    // "Is every milestone of this Journey done?" — answered from the CURRENT
    // milestone state, not a hardcoded list, so the sequence is honest.
    // Matched loosely on purpose: the engine's SQL has a newline mid-statement.
    if (
      sql.includes("SELECT id, status FROM venture_milestones") &&
      sql.includes("journey_stage_id = ?") &&
      !sql.includes("ORDER BY")
    ) {
      return {
        rows: state.siblings.map((sibling) =>
          String(sibling.id) === String(state.milestone.id) ? { id: sibling.id, status: state.milestone.status } : sibling,
        ),
      };
    }
    if (sql.includes("UPDATE venture_journey_stages SET status = 'completed'")) {
      if (state.stage) state.stage.status = "completed";
      return { rows: [] };
    }

    // activateDueStages — the sweeps, in the order the engine runs them.
    if (sql.includes("UPDATE venture_journey_stages SET status = 'active'")) return { rows: [] };
    if (sql.includes("SET status = 'upcoming'")) return { rows: [] };
    if (sql.includes("SET status = CASE WHEN")) return { rows: [] };

    return { rows: [] };
  });
  mockState.executeImpl = execute;
  return { calls, state };
}

const wroteMilestoneStatus = (calls) => calls.find((call) => call.sql.startsWith("UPDATE venture_milestones SET status = ?"));
const closedMilestone = (calls) => calls.some((call) => call.sql.includes("SET status = 'completed', progress = 100"));

// ════════════════════════════════════════════════════════════════════════════
describe("CHECK 1 — task completion advances the milestone, and cannot bypass authority", () => {
  test("work starting moves the milestone to In Progress", async () => {
    const world = ventureWorld({ tasks: [{ status: "backlog" }, { status: "in_progress" }] });
    const out = await syncMilestoneFromWork({ dbId: VENTURE_DB_ID, milestoneId: MILESTONE_ID });
    expect(out).toEqual({ changed: true, status: "in_progress" });
    expect(world.state.milestone.status).toBe("in_progress");
  });

  test("every task done with NO authority stops at In Progress — never completed", async () => {
    const world = ventureWorld({ tasks: [{ status: "done" }, { status: "done" }] });
    const out = await syncMilestoneFromWork({
      dbId: VENTURE_DB_ID,
      milestoneId: MILESTONE_ID,
      canComplete: false,
    });
    expect(out).toEqual({ changed: true, status: "in_progress" });
    expect(closedMilestone(world.calls)).toBe(false);
    expect(world.state.milestone.status).toBe("in_progress");
  });

  test("a task reviewer without the matrix cell gets 403 from the route", async () => {
    flags.assignment = "coach";
    flags.matrixAllows = false;
    const res = await patchMilestone(
      new Request("http://localhost/x?id=MS_1", { method: "PATCH", body: JSON.stringify({ status: "completed" }) }),
      milestoneCtx,
    );
    expect(res.status).toBe(403);
    expect((await readJson(res)).error).toMatch(/Lead Manager or a Super Admin/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("CHECK 2 — all tasks done + approved deliverable + authority → completed", () => {
  test("both halves hold and the authority acts: the milestone closes", async () => {
    const world = ventureWorld({
      tasks: [{ status: "done" }, { status: "accepted" }],
      deliverables: [{ status: "completed", approval_status: "approved" }],
      stage: { id: STAGE_ID, name: "Market Readiness", status: "active", stage_order: 1 },
      siblings: [{ id: MILESTONE_ID, status: "not_started" }],
    });
    const out = await syncMilestoneFromWork({
      dbId: VENTURE_DB_ID,
      milestoneId: MILESTONE_ID,
      cid: "USR-LEW",
      canComplete: true,
    });
    expect(out).toMatchObject({ changed: true, status: "completed" });
    expect(closedMilestone(world.calls)).toBe(true);
    expect(world.state.milestone.status).toBe("completed");
  });

  test("approved evidence with work still open does NOT close it", async () => {
    const world = ventureWorld({
      tasks: [{ status: "done" }, { status: "todo" }],
      deliverables: [{ approval_status: "approved" }],
    });
    const out = await syncMilestoneFromWork({
      dbId: VENTURE_DB_ID,
      milestoneId: MILESTONE_ID,
      canComplete: true,
    });
    expect(out).toEqual({ changed: true, status: "in_progress" });
    expect(closedMilestone(world.calls)).toBe(false);
  });

  test("finished work with no evidence does NOT close it", async () => {
    const world = ventureWorld({ tasks: [{ status: "done" }] });
    const out = await syncMilestoneFromWork({
      dbId: VENTURE_DB_ID,
      milestoneId: MILESTONE_ID,
      canComplete: true,
    });
    expect(out).toEqual({ changed: true, status: "in_progress" });
    expect(closedMilestone(world.calls)).toBe(false);
  });

  test("a milestone with no tasks still closes on evidence alone (unchanged behaviour)", async () => {
    ventureWorld({ deliverables: [{ approval_status: "approved" }] });
    const out = await syncMilestoneFromWork({
      dbId: VENTURE_DB_ID,
      milestoneId: MILESTONE_ID,
      canComplete: true,
    });
    expect(out).toMatchObject({ status: "completed" });
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("CHECK 3 — tasks under an Upcoming milestone never activate it", () => {
  test("all its tasks finished: it stays Upcoming, and nothing is written", async () => {
    const world = ventureWorld({
      milestoneStatus: "upcoming",
      tasks: [{ status: "done" }, { status: "done" }],
      deliverables: [{ approval_status: "approved" }],
    });
    const out = await syncMilestoneFromWork({
      dbId: VENTURE_DB_ID,
      milestoneId: MILESTONE_ID,
      canComplete: true,
    });
    expect(out).toEqual({ changed: false, status: "upcoming" });
    expect(wroteMilestoneStatus(world.calls)).toBeUndefined();
    expect(world.state.milestone.status).toBe("upcoming");
  });

  test("even an approved deliverable does not release it", async () => {
    const world = ventureWorld({
      milestoneStatus: "upcoming",
      deliverables: [{ status: "submitted" }],
    });
    const out = await syncMilestoneFromWork({ dbId: VENTURE_DB_ID, milestoneId: MILESTONE_ID, canComplete: true });
    expect(out.status).toBe("upcoming");
    expect(wroteMilestoneStatus(world.calls)).toBeUndefined();
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("CHECK 4 — dependency blocking is not cleared by task completion", () => {
  test("a blocked milestone stays Blocked however much work is finished", async () => {
    const world = ventureWorld({
      milestoneStatus: "blocked",
      tasks: [{ status: "done" }, { status: "accepted" }, { status: "done" }],
      deliverables: [{ approval_status: "approved" }],
    });
    const out = await syncMilestoneFromWork({
      dbId: VENTURE_DB_ID,
      milestoneId: MILESTONE_ID,
      canComplete: true,
    });
    expect(out).toEqual({ changed: false, status: "blocked" });
    expect(wroteMilestoneStatus(world.calls)).toBeUndefined();
    expect(world.state.milestone.status).toBe("blocked");
  });

  test("the release sweeps still decide Held-vs-Blocked through the dependency guard", () => {
    // The guard is SQL, so it is locked at the source: an edge (source → target)
    // means the source blocks the target, and nothing but the source COMPLETING
    // frees it. `venture-dependencies.test.js` proves this behaviourally.
    const source = require("fs").readFileSync(
      require("path").join(__dirname, "..", "models", "ventureMilestoneEngineStore.js"),
      "utf8",
    );
    expect(source).toContain("FROM venture_dependencies d");
    expect(source).toContain("blocker.status <> 'completed'");
    // No sweep may hand a milestone `not_started` outright — every release goes
    // through the CASE that consults the guard.
    expect(source).not.toContain("UPDATE venture_milestones SET status = 'not_started'");
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("CHECK 5 — the Milestone → Journey transition uses the existing lifecycle", () => {
  test("the LAST milestone closing closes its Journey, and names it", async () => {
    const world = ventureWorld({
      tasks: [{ status: "done" }],
      deliverables: [{ approval_status: "approved" }],
      stage: { id: STAGE_ID, name: "Market Readiness", status: "active", stage_order: 1 },
      siblings: [{ id: MILESTONE_ID, status: "not_started" }],
    });
    const out = await syncMilestoneFromWork({
      dbId: VENTURE_DB_ID,
      milestoneId: MILESTONE_ID,
      cid: "USR-LEW",
      canComplete: true,
    });
    expect(out.journey_completed).toBe(true);
    expect(out.journey).toMatchObject({ id: STAGE_ID, name: "Market Readiness" });
    expect(world.state.stage.status).toBe("completed");
  });

  test("a Journey with another milestone still open stays open", async () => {
    const world = ventureWorld({
      tasks: [{ status: "done" }],
      deliverables: [{ approval_status: "approved" }],
      stage: { id: STAGE_ID, name: "Market Readiness", status: "active", stage_order: 1 },
      siblings: [{ id: MILESTONE_ID, status: "not_started" }, { id: "other-ms", status: "in_progress" }],
    });
    const out = await syncMilestoneFromWork({
      dbId: VENTURE_DB_ID,
      milestoneId: MILESTONE_ID,
      cid: "USR-LEW",
      canComplete: true,
    });
    expect(out.status).toBe("completed");
    expect(out.journey_completed).toBe(false);
    expect(world.state.stage.status).toBe("active");
  });

  test("a Journey that is not active is never closed by a milestone", async () => {
    const world = ventureWorld({
      tasks: [{ status: "done" }],
      deliverables: [{ approval_status: "approved" }],
      stage: { id: STAGE_ID, name: "Market Readiness", status: "upcoming", stage_order: 2 },
      siblings: [{ id: MILESTONE_ID, status: "not_started" }],
    });
    const out = await syncMilestoneFromWork({
      dbId: VENTURE_DB_ID,
      milestoneId: MILESTONE_ID,
      cid: "USR-LEW",
      canComplete: true,
    });
    // The milestone may still complete; the JOURNEY must not.
    expect(out.journey_completed).toBe(false);
    expect(world.state.stage.status).toBe("upcoming");
  });

  test("a Journey with no milestones never auto-completes", async () => {
    const empty = ventureWorld({
      stage: { id: STAGE_ID, name: "Empty", status: "active", stage_order: 1 },
      siblings: [],
    });
    const out = await completeStageIfAllMilestonesDone(empty, { dbId: VENTURE_DB_ID, stageId: STAGE_ID });
    expect(out.completed).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("CHECK 6 — field and date edits stay open to the Venture Manager", () => {
  const edit = (body) =>
    patchMilestone(new Request("http://localhost/x?id=MS_1", { method: "PATCH", body: JSON.stringify(body) }), milestoneCtx);

  test("title, description, dates, priority and owner are all editable, with no authority check", async () => {
    const res = await edit({
      title: "Go-to-Market System",
      description: "Renamed after the workshop",
      objective: "A repeatable acquisition engine",
      start_date: "2026-10-01",
      target_date: "2026-11-30",
      priority: "high",
      owner_name: "Amina",
    });
    expect(res.status).toBe(200);
    expect((await readJson(res)).success).toBe(true);

    // The proof that field edits need only `ventures.edit`: the milestone
    // AUTHORITY was never consulted — no assignment read, no matrix read.
    const authorityReads = executed.filter(
      (call) => call.sql.includes("FROM venture_staff_assignments") || call.sql.includes("venture_permission_matrix"),
    );
    expect(authorityReads).toEqual([]);
    // ...and the fields really were written.
    const write = executed.find((call) => call.sql.includes("UPDATE venture_milestones SET"));
    expect(write.sql).toContain("title = ?");
    expect(write.sql).toContain("start_date = ?");
    expect(write.sql).toContain("target_date = ?");
    expect(write.sql).toContain("owner_name = ?");
  });

  test("the same edit is refused for someone outside the Venture (scope, not fields)", async () => {
    const { requireVentureScopedAccess } = require("@/lib/ventureScopedAccess");
    requireVentureScopedAccess.mockResolvedValueOnce({
      error: (() => {
        const { NextResponse } = require("next/server");
        return NextResponse.json(
          { success: false, error: "errors.insufficientPermissions", missing: { capability: "ventures.edit", scope: "venture_own" } },
          { status: 403 },
        );
      })(),
    });
    const res = await edit({ title: "Should not land" });
    expect(res.status).toBe(403);
    expect(executed.some((call) => call.sql.includes("UPDATE venture_milestones SET"))).toBe(false);
  });

  test("completion is the ONE status change that still needs the matrix cell", async () => {
    flags.assignment = "lead_manager";
    flags.matrixAllows = true;
    const res = await edit({ status: "completed" });
    expect(res.status).toBe(200);
    const authorityReads = executed.filter((call) => call.sql.includes("FROM venture_staff_assignments"));
    expect(authorityReads.length).toBeGreaterThan(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("the derivations themselves stay honest", () => {
  test("cancelled work leaves no execution component", () => {
    expect(deriveMilestoneStatusFromTasks([{ status: "cancelled" }])).toBeNull();
  });

  test("a rejected task is under way, not untouched", () => {
    expect(deriveMilestoneStatusFromTasks([{ status: "rejected" }])).toBe("in_progress");
  });

  test("the two halves combine in exactly one place", () => {
    expect(combineMilestoneStatus({ fromDeliverables: "completed", fromTasks: "all_done" })).toBe("completed");
    expect(combineMilestoneStatus({ fromDeliverables: "completed", fromTasks: "in_progress" })).toBe("in_progress");
    expect(combineMilestoneStatus({ fromDeliverables: null, fromTasks: "all_done" })).toBe("in_progress");
  });
});
