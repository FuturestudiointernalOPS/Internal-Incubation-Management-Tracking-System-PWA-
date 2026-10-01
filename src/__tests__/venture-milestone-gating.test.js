/**
 * Contract tests — milestone progression engine (Vinance 3, Phase 3).
 *
 * POST/PATCH /api/ventures/[id]/milestones guards:
 *   - only the assigned Lead Manager or a Super Admin may mark a milestone
 *     completed (decision locked earlier); coaches/staff/founders get 403
 *   - completing a milestone unlocks NOTHING by position: an active Journey's
 *     milestones are already all available
 *   - new milestones bound to an ACTIVE Journey start available; in a
 *     not-started or finished Journey they wait 'upcoming'
 */

const executed = [];
const VENTURE_DB_ID = "11111111-1111-4111-8111-111111111111";
const MILESTONE_1 = "33333333-3333-4333-8333-333333333333";

function makeFakeDb() {
  const flags = { stageStatus: "active", assignment: "none", stageCloses: false };
  const execute = jest.fn(async ({ sql, args = [] }) => {
    executed.push({ sql, args });
    // The stage that a completed milestone might CLOSE (the closing report is
    // asked for at exactly this moment).
    if (sql.includes("SELECT id, name, status, stage_order FROM venture_journey_stages")) {
      return { rows: flags.stageCloses ? [{ id: "s1", name: "Family & Friends", status: "active", stage_order: 1 }] : [] };
    }
    // Its milestones, for “is every one of them done?”. The release query also
    // reads this table but orders by display_order, so it is excluded here.
    if (sql.includes("SELECT id, status FROM venture_milestones") && sql.includes("journey_stage_id = ?") && !sql.includes("ORDER BY")) {
      return { rows: flags.stageCloses ? [{ id: MILESTONE_1, status: "completed" }] : [] };
    }
    if (sql.includes("SELECT id, venture_id FROM ventures WHERE venture_id = ? OR id::text = ?")) {
      return { rows: [{ id: VENTURE_DB_ID, venture_id: "VNT-TEST" }] };
    }
    if (sql.includes("SELECT id FROM ventures WHERE venture_id = ? OR id::text = ?")) {
      return { rows: [{ id: VENTURE_DB_ID }] };
    }
    if (sql.includes("SELECT id FROM ventures WHERE venture_id = ?") && !sql.includes("OR")) {
      return { rows: [{ id: VENTURE_DB_ID }] };
    }
    // Milestone authority is read from the permission MATRIX: the assignment
    // supplies the responsibility, the matrix decides the cell. The seeded truth
    // this mirrors — a Lead Manager holds `milestones.edit`, a Coach does not.
    if (sql.includes("FROM venture_staff_assignments")) {
      const responsibility =
        flags.assignment === "lead" ? "lead_manager" : flags.assignment === "coach" ? "coach" : null;
      return {
        rows: responsibility
          ? [
              {
                responsibility_code: responsibility,
                scope_type: "venture_wide",
                scope_ref_type: null,
                scope_ref_id: null,
              },
            ]
          : [],
      };
    }
    if (sql.includes("venture_permission_matrix")) {
      return { rows: [{ allowed: args[0] === "lead_manager" ? 1 : 0 }] };
    }
    // computeInitialMilestoneStatus: the Journey the milestone will join
    if (sql.includes("SELECT status FROM venture_journey_stages WHERE id = ? AND venture_id = ?")) {
      return { rows: [{ status: flags.stageStatus }] };
    }
    // title lookup after completion
    if (sql.includes("SELECT title, journey_stage_id FROM venture_milestones WHERE id = ?")) {
      return { rows: [{ title: "Pitch Deck", journey_stage_id: "s1" }] };
    }
    if (sql.includes("SELECT 1 FROM venture_journey_stages WHERE id = ? AND venture_id = ?")) {
      return { rows: [{ 1: 1 }] };
    }
    return { rows: [] };
  });
  return { execute, flags };
}

const mockDb = makeFakeDb();

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: mockDb,
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/lib/auth", () => ({
  requireAuth: jest.fn().mockResolvedValue(null),
  getSession: jest.fn(),
}));

jest.mock("@/lib/ventureAuth", () => ({
  requireVentureAccess: jest.fn().mockResolvedValue({ session: { cid: "u1", role: "super_admin" } }),
}));

// Phase 5c: the routes now decide through the canonical gate only.
jest.mock("@/lib/ventureScopedAccess", () => ({
  requireVentureScopedAccess: jest.fn().mockResolvedValue({ session: { cid: "u1", role: "super_admin" }, path: "super-admin" }),
}));

jest.mock("@/lib/ventures", () => ({
  notifyVentureFounders: jest.fn().mockResolvedValue(true),
  addVentureHistory: jest.fn().mockResolvedValue(true),
}));

const { POST, PATCH } = require("@/app/api/ventures/[id]/milestones/route");
const readJson = async (res) => res.json();
const ctx = { params: { id: "VNT-TEST" } };

beforeEach(() => {
  executed.length = 0;
  jest.clearAllMocks();
  mockDb.flags.stageStatus = "active";
  mockDb.flags.assignment = "none";
  mockDb.flags.stageCloses = false;
});

describe("a completion that CLOSES a journey says so", () => {
  const complete = () =>
    PATCH(
      new Request("http://localhost/x?id=MS_1", { method: "PATCH", body: JSON.stringify({ status: "completed" }) }),
      ctx,
    );

  test("the response carries the closed journey, so its closing report can be asked for", async () => {
    mockDb.flags.stageCloses = true;
    const data = await readJson(await complete());
    expect(data.success).toBe(true);
    expect(data.journey_completed).toBe(true);
    expect(data.journey).toMatchObject({ id: "s1", name: "Family & Friends" });
  });

  test("a completion that leaves the journey open claims nothing", async () => {
    mockDb.flags.stageCloses = false;
    const data = await readJson(await complete());
    expect(data.success).toBe(true);
    expect(data.journey_completed).toBe(false);
    expect(data.journey).toBeNull();
  });
});

describe("milestone completion authority (Lead Manager / Super Admin only)", () => {
  test("super_admin may complete a milestone — and nothing is unlocked by position", async () => {
    const res = await PATCH(
      new Request("http://localhost/x?id=MS_1", { method: "PATCH", body: JSON.stringify({ status: "completed" }) }),
      ctx,
    );
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.success).toBe(true);

    const completedUpdate = executed.find((query) => query.sql.includes("UPDATE venture_milestones SET status = 'completed'"));
    expect(completedUpdate).toBeDefined();
    // No sweep may assign `not_started` outright: every release decides between
    // `not_started` and `blocked` from the dependency edges.
    const unguardedRelease = executed.find((query) => query.sql.includes("SET status = 'not_started'"));
    expect(unguardedRelease).toBeUndefined();
    const guardedSweeps = executed.filter((query) => query.sql.includes("SET status = CASE WHEN"));
    expect(guardedSweeps.length).toBeGreaterThan(0);
    for (const sweep of guardedSweeps) {
      expect(sweep.sql).toContain("FROM venture_dependencies");
    }

    const { notifyVentureFounders } = require("@/lib/ventures");
    expect(notifyVentureFounders).toHaveBeenCalledWith(
      VENTURE_DB_ID,
      "Milestone approved",
      expect.any(String),
      expect.objectContaining({ milestone_id: "MS_1" }),
      expect.objectContaining({ templateKey: "venture.notif.milestoneApproved" }),
    );
  });

  test("coach/founder without a lead_manager assignment gets 403", async () => {
    require("@/lib/ventureScopedAccess").requireVentureScopedAccess.mockResolvedValueOnce({ session: { cid: "coach-1", role: "staff" }, path: "capability+scope" });
    const res = await PATCH(
      new Request("http://localhost/x?id=MS_1", { method: "PATCH", body: JSON.stringify({ status: "completed" }) }),
      ctx,
    );
    expect(res.status).toBe(403);
    const completedUpdate = executed.find((query) => query.sql.includes("UPDATE venture_milestones SET status = 'completed'"));
    expect(completedUpdate).toBeUndefined();
  });

  test("assigned Lead Manager may complete (assignment row found)", async () => {
    mockDb.flags.assignment = "lead";
    require("@/lib/ventureScopedAccess").requireVentureScopedAccess.mockResolvedValueOnce({ session: { cid: "lm-1", role: "staff" }, path: "capability+scope" });
    const res = await PATCH(
      new Request("http://localhost/x?id=MS_1", { method: "PATCH", body: JSON.stringify({ status: "completed" }) }),
      ctx,
    );
    expect(res.status).toBe(200);
  });

  test("non-completion transitions stay open to the existing flow (no gate)", async () => {
    require("@/lib/ventureScopedAccess").requireVentureScopedAccess.mockResolvedValueOnce({ session: { cid: "coach-1", role: "staff" }, path: "capability+scope" });
    const res = await PATCH(
      new Request("http://localhost/x?id=MS_1", { method: "PATCH", body: JSON.stringify({ status: "under_review" }) }),
      ctx,
    );
    expect(res.status).toBe(200);
  });
});

describe("milestone creation — availability follows the Journey", () => {
  test("a milestone in an active Journey starts available", async () => {
    const res = await POST(
      new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ title: "Pitch Deck", journey_stage_id: "s1" }) }),
      ctx,
    );
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.status).toBe("not_started");
  });

  test("a milestone in a not-started Journey waits upcoming", async () => {
    mockDb.flags.stageStatus = "upcoming";
    const res = await POST(
      new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ title: "Business Plan", journey_stage_id: "s1" }) }),
      ctx,
    );
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.status).toBe("upcoming");
  });

  test("a milestone in a finished Journey waits upcoming", async () => {
    mockDb.flags.stageStatus = "completed";
    const res = await POST(
      new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ title: "Extra", journey_stage_id: "s1" }) }),
      ctx,
    );
    const data = await readJson(res);
    expect(data.status).toBe("upcoming");
  });

  test("unbound milestones keep the legacy default", async () => {
    const res = await POST(new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ title: "Legacy" }) }), ctx);
    const data = await readJson(res);
    expect(data.status).toBe("not_started");
  });
});
