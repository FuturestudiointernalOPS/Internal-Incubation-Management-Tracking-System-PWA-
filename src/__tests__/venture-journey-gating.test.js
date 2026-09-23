/**
 * Contract test — GET /api/ventures/[id]/journey roadmap visibility
 * (Vinance 3).
 *
 * This REPLACES the earlier "hide the future" rule. The Venture-perspective
 * contract is now:
 *
 *   - a member receives EVERY Journey and EVERY Milestone with its real status
 *     (the map is honest — nothing silently disappears and progress counts are
 *     real), but the WORK inside a not-yet-released (`locked`) item is withheld
 *     and the row is stamped `sealed: true`
 *   - staff and global roles keep receiving the FULL roadmap, unsealed
 *   - the author flags are still never handed to a member
 */

const executed = [];
const VENTURE_DB_ID = "11111111-1111-4111-8111-111111111111";

const STAGES_FIXTURE = [
  { id: "s1", name: "Family & Friends", description: "Raise from the network", objective: "First cheque", target_date: "2026-01-31", stage_order: 1, status: "completed", completed_at: "2026-02-01", created_at: null },
  { id: "s2", name: "Go-To-Market", description: "Find the first ten customers", objective: "Repeatable sales", target_date: "2026-05-31", stage_order: 2, status: "active", completed_at: null, created_at: null },
  { id: "s3", name: "Investment Prep", description: "Raise a seed round", objective: "Signed term sheet", target_date: "2026-09-30", stage_order: 3, status: "locked", completed_at: null, created_at: null },
];

const MILESTONES_FIXTURE = [
  { id: "m1", title: "Pitch Deck", description: "Build the deck", objective: "Tell the story", status: "completed", progress: 100, target_date: "2025-11-30", priority: "high", display_order: 1, created_at: null, journey_stage_id: "s1" },
  { id: "m2", title: "Customer Validation", description: "Twenty interviews", objective: "Prove demand", status: "in_progress", progress: 40, target_date: "2026-04-30", priority: "high", display_order: 1, created_at: null, journey_stage_id: "s2" },
  { id: "m3", title: "Financial Model", description: "Build the model", objective: "Know the numbers", status: "locked", progress: 0, target_date: "2026-06-30", priority: "medium", display_order: 2, created_at: null, journey_stage_id: "s2" },
  { id: "m4", title: "Term Sheet", description: "Negotiate terms", objective: "Close the round", status: "locked", progress: 0, target_date: "2026-09-30", priority: "medium", display_order: 1, created_at: null, journey_stage_id: "s3" },
];

// d1 hangs off the OPEN milestone, d2 off a LOCKED one — d2 is the leak this
// test exists to prevent.
const DELIVERABLES_FIXTURE = [
  { id: "d1", milestone_id: "m2", title: "Validation report", description: null, deliverable_type: "document", status: "submitted", approval_status: "pending", due_date: null, attachment_url: null, attachment_name: null, rejection_reason: null, reviewer_name: null },
  { id: "d2", milestone_id: "m3", title: "Model seed", description: null, deliverable_type: "document", status: "not_started", approval_status: null, due_date: null, attachment_url: null, attachment_name: null, rejection_reason: null, reviewer_name: null },
];

const mockDb = {
  execute: jest.fn(async ({ sql }) => {
    executed.push({ sql });
    if (sql.startsWith("CREATE TABLE IF NOT EXISTS venture_journey_stages")) return { rows: [] };
    if (sql.includes("FROM ventures WHERE id::text")) return { rows: [{ id: VENTURE_DB_ID }] };
    if (sql.includes("FROM venture_deliverables")) return { rows: DELIVERABLES_FIXTURE };
    if (sql.includes("FROM venture_milestones")) return { rows: MILESTONES_FIXTURE };
    if (sql.includes("FROM venture_journey_stages") && sql.includes("ORDER BY stage_order ASC")) {
      return { rows: STAGES_FIXTURE };
    }
    return { rows: [] };
  }),
};

const mockAuth = {
  getSession: jest.fn(),
};

const mockPlans = {
  resolvePlanAccess: jest.fn(),
  allowsPlanAction: jest.fn(),
};

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: mockDb,
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(() => mockAuth.getSession()),
}));

jest.mock("@/lib/ventureAuth", () => ({
  requireVentureAccess: jest.fn().mockResolvedValue({ session: { cid: "member-1", name: "Founder", role: "founder" } }),
  roleIsPrivileged: jest.requireActual("@/lib/ventureAuth").roleIsPrivileged,
}));

jest.mock("@/lib/ventureOperatingPlans", () => ({
  resolvePlanAccess: jest.fn((...a) => mockPlans.resolvePlanAccess(...a)),
  allowsPlanAction: jest.fn((...a) => mockPlans.allowsPlanAction(...a)),
}));

const { GET } = require("@/app/api/ventures/[id]/journey/route");

const readJson = async (res) => res.json();
const fetchJourney = async () => GET(new Request("http://localhost/api/ventures/VNT-1/journey"), { params: { id: VENTURE_DB_ID } });
const stageById = (data, id) => (data.stages || []).find((stage) => stage.id === id);
const milestoneById = (stage, id) => (stage.milestones || []).find((milestone) => milestone.id === id);

/** A member: not a privileged role, and no authoring access to this Venture. */
const asMember = () => {
  mockAuth.getSession.mockResolvedValue({ cid: "member-1", role: "founder" });
  mockPlans.resolvePlanAccess.mockResolvedValue({ ok: false });
  mockPlans.allowsPlanAction.mockResolvedValue(false);
};

/** Staff instrument: privileged role with authoring access. */
const asStaff = () => {
  mockAuth.getSession.mockResolvedValue({ cid: "staff-1", role: "super_admin" });
  mockPlans.resolvePlanAccess.mockResolvedValue({ ok: true, global: true });
  mockPlans.allowsPlanAction.mockResolvedValue(true);
};

beforeEach(() => {
  executed.length = 0;
  jest.clearAllMocks();
  asMember();
});

describe("GET /api/ventures/[id]/journey — the member's map is complete", () => {
  test("every Journey is listed, including the ones not yet reached", async () => {
    const data = await readJson(await fetchJourney());
    expect(data.success).toBe(true);
    expect(data.guided).toBe(true);
    expect((data.stages || []).map((stage) => stage.status)).toEqual(["completed", "active", "locked"]);
    expect(data.stages.length).toBe(3);
  });

  test("a Journey not yet released is sealed: named, but its planning is withheld", async () => {
    const data = await readJson(await fetchJourney());
    const future = stageById(data, "s3");
    expect(future.name).toBe("Investment Prep");
    expect(future.sealed).toBe(true);
    expect(future.description).toBeUndefined();
    expect(future.objective).toBeUndefined();
  });

  test("a released Journey is open and keeps its description", async () => {
    const data = await readJson(await fetchJourney());
    const now = stageById(data, "s2");
    expect(now.sealed).toBe(false);
    expect(now.description).toBe("Find the first ten customers");
  });

  test("milestone counts stay REAL — a sealed milestone is still on the map", async () => {
    const data = await readJson(await fetchJourney());
    // s2 holds two milestones, one open and one sealed.
    expect(stageById(data, "s2").milestone_counts).toEqual({ total: 2, completed: 0 });
    expect(stageById(data, "s1").milestone_counts).toEqual({ total: 1, completed: 1 });
    expect(stageById(data, "s3").milestone_counts).toEqual({ total: 1, completed: 0 });
  });
});

describe("GET /api/ventures/[id]/journey — the work is sealed, not the map", () => {
  test("the current milestone is open, with its work and its deliverables", async () => {
    const data = await readJson(await fetchJourney());
    const current = milestoneById(stageById(data, "s2"), "m2");
    expect(current.sealed).toBe(false);
    expect(current.description).toBe("Twenty interviews");
    expect(current.objective).toBe("Prove demand");
    expect(current.deliverables.map((deliverable) => deliverable.id)).toEqual(["d1"]);
  });

  test("a future milestone keeps its title and target date but no work", async () => {
    const data = await readJson(await fetchJourney());
    const future = milestoneById(stageById(data, "s2"), "m3");
    expect(future.title).toBe("Financial Model");
    expect(future.status).toBe("locked");
    expect(future.target_date).toBe("2026-06-30");
    expect(future.sealed).toBe(true);
    expect(future.description).toBeUndefined();
    expect(future.objective).toBeUndefined();
    expect(future.progress).toBeUndefined();
    // The deliverable attached to it is NOT handed over.
    expect(future.deliverables).toEqual([]);
  });

  test("a milestone inside an unreleased Journey is sealed too", async () => {
    const data = await readJson(await fetchJourney());
    const deep = milestoneById(stageById(data, "s3"), "m4");
    expect(deep.title).toBe("Term Sheet");
    expect(deep.sealed).toBe(true);
    expect(deep.description).toBeUndefined();
  });

  test("a member is never handed the author flags", async () => {
    const data = await readJson(await fetchJourney());
    expect(data.access).toBeNull();
    expect(data.milestone_authority).toBe(false);
  });
});

describe("GET /api/ventures/[id]/journey — staff keep the whole roadmap unsealed", () => {
  test("every stage and milestone is open, and the author flags are present", async () => {
    asStaff();
    const data = await readJson(await fetchJourney());
    expect(data.success).toBe(true);
    expect(data.stages.length).toBe(3);
    expect(data.stages.map((stage) => stage.sealed)).toEqual([false, false, false]);
    expect(data.access).toEqual({ create: true, edit: true, manage: true });

    const future = milestoneById(stageById(data, "s2"), "m3");
    expect(future.sealed).toBe(false);
    expect(future.description).toBe("Build the model");
    // The deliverable of a locked milestone IS visible to staff.
    expect(future.deliverables.map((deliverable) => deliverable.id)).toEqual(["d2"]);
  });
});
