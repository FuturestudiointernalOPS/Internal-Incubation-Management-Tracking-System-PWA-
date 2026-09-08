/**
 * Contract tests — milestone progression engine (Vinance 3, Phase 3).
 *
 * POST/PATCH /api/ventures/[id]/milestones guards:
 *   - only the assigned Lead Manager or a Super Admin may mark a milestone
 *     completed (decision locked earlier); coaches/staff/founders get 403
 *   - completing a milestone unlocks the NEXT locked milestone in the same
 *     Journey stage (sequential release)
 *   - new milestones bound to a stage start 'locked' unless they are the
 *     stage's first milestone or follow a completed one
 */

const executed = [];
const VENTURE_DB_ID = "11111111-1111-4111-8111-111111111111";
const MS_1 = "33333333-3333-4333-8333-333333333333";
const MS_2 = "44444444-4444-4444-8444-444444444444";

function makeFakeDb() {
  const flags = { lastStatus: null, nextLocked: true, assignment: "none" };
  const execute = jest.fn(async ({ sql, args = [] }) => {
    executed.push({ sql, args });
    if (sql.includes("SELECT id, venture_id FROM ventures WHERE venture_id = ? OR id::text = ?")) {
      return { rows: [{ id: VENTURE_DB_ID, venture_id: "VNT-TEST" }] };
    }
    if (sql.includes("SELECT id FROM ventures WHERE venture_id = ? OR id::text = ?")) {
      return { rows: [{ id: VENTURE_DB_ID }] };
    }
    if (sql.includes("SELECT id FROM ventures WHERE venture_id = ?") && !sql.includes("OR")) {
      return { rows: [{ id: VENTURE_DB_ID }] };
    }
    if (sql.includes("FROM venture_staff_assignments") && sql.includes("lead_manager")) {
      return { rows: flags.assignment === "lead" ? [{ 1: 1 }] : [] };
    }
    // computeInitialMilestoneStatus: latest milestone in the stage
    if (sql.includes("ORDER BY COALESCE(display_order, 0) DESC, created_at DESC")) {
      return { rows: flags.lastStatus ? [{ status: flags.lastStatus }] : [] };
    }
    // completeMilestoneAndUnlockNext: source milestone + next locked
    if (sql.includes("SELECT id, journey_stage_id FROM venture_milestones WHERE id = ? AND venture_id = ?")) {
      return { rows: [{ id: MS_1, journey_stage_id: "s1" }] };
    }
    if (sql.includes("status = 'locked'") && sql.includes("ORDER BY COALESCE(display_order, 0), created_at ASC")) {
      return { rows: flags.nextLocked ? [{ id: MS_2 }] : [] };
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
  mockDb.flags.lastStatus = null;
  mockDb.flags.nextLocked = true;
  mockDb.flags.assignment = "none";
});

describe("milestone completion authority (Lead Manager / Super Admin only)", () => {
  test("super_admin may complete a milestone and unlocks the next locked one", async () => {
    const res = await PATCH(
      new Request("http://localhost/x?id=MS_1", { method: "PATCH", body: JSON.stringify({ status: "completed" }) }),
      ctx,
    );
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.success).toBe(true);

    const completedUpdate = executed.find((q) => q.sql.includes("UPDATE venture_milestones SET status = 'completed'"));
    expect(completedUpdate).toBeDefined();
    const unlockUpdate = executed.find((q) => q.sql.includes("UPDATE venture_milestones SET status = 'not_started'"));
    expect(unlockUpdate).toBeDefined();
    expect(unlockUpdate.args[0]).toBe(MS_2);

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
    require("@/lib/ventureAuth").requireVentureAccess.mockResolvedValueOnce({ session: { cid: "coach-1", role: "staff" } });
    const res = await PATCH(
      new Request("http://localhost/x?id=MS_1", { method: "PATCH", body: JSON.stringify({ status: "completed" }) }),
      ctx,
    );
    expect(res.status).toBe(403);
    const completedUpdate = executed.find((q) => q.sql.includes("UPDATE venture_milestones SET status = 'completed'"));
    expect(completedUpdate).toBeUndefined();
  });

  test("assigned Lead Manager may complete (assignment row found)", async () => {
    mockDb.flags.assignment = "lead";
    require("@/lib/ventureAuth").requireVentureAccess.mockResolvedValueOnce({ session: { cid: "lm-1", role: "staff" } });
    const res = await PATCH(
      new Request("http://localhost/x?id=MS_1", { method: "PATCH", body: JSON.stringify({ status: "completed" }) }),
      ctx,
    );
    expect(res.status).toBe(200);
  });

  test("non-completion transitions stay open to the existing flow (no gate)", async () => {
    require("@/lib/ventureAuth").requireVentureAccess.mockResolvedValueOnce({ session: { cid: "coach-1", role: "staff" } });
    const res = await PATCH(
      new Request("http://localhost/x?id=MS_1", { method: "PATCH", body: JSON.stringify({ status: "under_review" }) }),
      ctx,
    );
    expect(res.status).toBe(200);
  });
});

describe("milestone creation — sequential release", () => {
  test("first milestone of a stage starts available", async () => {
    const res = await POST(
      new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ title: "Pitch Deck", journey_stage_id: "s1" }) }),
      ctx,
    );
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.status).toBe("not_started");
  });

  test("a milestone following an unfinished one starts locked", async () => {
    mockDb.flags.lastStatus = "in_progress";
    const res = await POST(
      new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ title: "Business Plan", journey_stage_id: "s1" }) }),
      ctx,
    );
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.status).toBe("locked");
  });

  test("a milestone following a completed one starts available (new chain)", async () => {
    mockDb.flags.lastStatus = "completed";
    const res = await POST(
      new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ title: "Next", journey_stage_id: "s1" }) }),
      ctx,
    );
    const data = await readJson(res);
    expect(data.status).toBe("not_started");
  });

  test("unbound milestones keep the legacy default", async () => {
    const res = await POST(new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ title: "Legacy" }) }), ctx);
    const data = await readJson(res);
    expect(data.status).toBe("not_started");
  });
});
