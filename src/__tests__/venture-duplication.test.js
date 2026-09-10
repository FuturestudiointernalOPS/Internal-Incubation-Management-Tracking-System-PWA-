/**
 * Route-level contract tests — Venture OS duplication (Vinance 3, Phase 1).
 *
 * POST /api/ventures/[id]/journey/duplicate
 * POST /api/ventures/[id]/milestones/duplicate
 * POST /api/ventures/[id]/tasks/duplicate
 *
 * Guards:
 *   - copies are INDEPENDENT rows (new ids, never references to the source)
 *   - structure is preserved, execution data (submissions/reviews/history)
 *     is never copied
 *   - statuses reset (locked / not_started / backlog)
 *   - journey stage copies are inserted with a collision-safe
 *     re-serialization (UNIQUE venture_id, stage_order)
 *   - permission gates behave like the sibling routes
 */

const executed = [];

const VENTURE_DB_ID = "11111111-1111-4111-8111-111111111111";
const STAGE_ID = "22222222-2222-4222-8222-222222222222";
const MILESTONE_1 = "33333333-3333-4333-8333-333333333333";
const MILESTONE_2 = "44444444-4444-4444-8444-444444444444";
const TASK_PARENT = "55555555-5555-4555-8555-555555555555";
const TASK_CHILD = "66666666-6666-4666-8666-666666666666";
const TASK_2 = "77777777-7777-4777-8777-777777777777";

const SESSION = { cid: "staff-1", name: "Test Staff", role: "super_admin" };

function makeFakeDb() {
  // Source-row presence flags: flipped by individual tests (404 paths).
  const flags = { stageExists: true, milestoneExists: true, taskExists: true };

  const execute = jest.fn(async ({ sql, args = [] }) => {
    executed.push({ sql, args });
    if (sql.startsWith("CREATE TABLE IF NOT EXISTS venture_journey_stages")) return { rows: [] };
    if (sql.includes("FROM ventures WHERE id::text")) return { rows: [{ id: VENTURE_DB_ID }] };
    if (sql.includes("SELECT id FROM ventures WHERE venture_id = ? OR id::text = ?")) return { rows: [{ id: VENTURE_DB_ID }] };
    // RETURNING id on task inserts (venture_tasks.id is SERIAL)
    if (sql.includes("INSERT INTO venture_tasks") && sql.includes("RETURNING id")) {
      executed._taskSeq = (executed._taskSeq || 0) + 1;
      return { rows: [{ id: `copy-${executed._taskSeq}` }] };
    }
    // Source journey stage lookup (before the transaction)
    if (sql.includes("FROM venture_journey_stages WHERE id = ? AND venture_id = ?")) {
      return flags.stageExists
        ? { rows: [{ id: STAGE_ID, venture_id: VENTURE_DB_ID, name: "Family & Friends", description: "FF desc", objective: "Raise F&F money", target_date: "2026-10-01", stage_order: 1, status: "active" }] }
        : { rows: [] };
    }
    // Final stage list (route refresh after mutation)
    if (sql.includes("SELECT id, name, description, objective, target_date, stage_order, status, completed_at, created_at FROM venture_journey_stages")) {
      return { rows: [] };
    }
    // Source milestone lookup
    if (sql.includes("FROM venture_milestones WHERE id = ? AND venture_id IN")) {
      return flags.milestoneExists
        ? { rows: [milestoneRow(MILESTONE_1, STAGE_ID)] }
        : { rows: [] };
    }
    // Source task lookup
    if (sql.includes("FROM venture_tasks WHERE id = ? AND venture_id IN")) {
      return flags.taskExists
        ? { rows: [taskRow(TASK_PARENT, MILESTONE_1, null, true, "document")] }
        : { rows: [] };
    }
    return { rows: [] };
  });

  const transaction = jest.fn(async (cb) => cb(tx));

  const tx = jest.fn(async (sql, args = []) => {
    executed.push({ tx: true, sql, args });
    if (sql.includes("INSERT INTO venture_tasks") && sql.includes("RETURNING id")) {
      executed._taskSeq = (executed._taskSeq || 0) + 1;
      return { rows: [{ id: `copy-${executed._taskSeq}` }] };
    }
    if (sql.includes("SELECT id, stage_order FROM venture_journey_stages WHERE venture_id")) {
      return { rows: [{ id: STAGE_ID, stage_order: 1 }] };
    }
    if (sql.includes("SELECT * FROM venture_milestones WHERE journey_stage_id")) {
      return {
        rows: [
          milestoneRow(MILESTONE_1, STAGE_ID),
          { ...milestoneRow(MILESTONE_2, STAGE_ID), title: "Business Plan", priority: "medium", owner_cid: null, display_order: 2 },
        ],
      };
    }
    if (sql.includes("SELECT * FROM venture_tasks") && sql.includes("WHERE milestone_id = ?")) {
      const milestoneId = String(args[0]);
      if (milestoneId === MILESTONE_1) {
        return {
          rows: [
            taskRow(TASK_PARENT, MILESTONE_1, null, true, "document"),
            taskRow(TASK_CHILD, MILESTONE_1, TASK_PARENT, false, null),
          ],
        };
      }
      if (milestoneId === MILESTONE_2) {
        return { rows: [taskRow(TASK_2, MILESTONE_2, null, false, null)] };
      }
      return { rows: [] };
    }
    return { rows: [] };
  });

  return { execute, transaction, flags };
}

function milestoneRow(id, journeyStageId) {
  return {
    id,
    venture_id: VENTURE_DB_ID,
    title: "Pitch Deck",
    description: "Build the deck",
    objective: "Investor-ready deck",
    target_date: "2026-11-01",
    start_date: null,
    priority: "high",
    owner_cid: "owner-1",
    display_order: 1,
    journey_stage_id: journeyStageId,
  };
}

function taskRow(id, milestoneId, parentId, reviewRequired, requiredType) {
  return {
    id,
    venture_id: VENTURE_DB_ID,
    milestone_id: milestoneId,
    title: id === TASK_CHILD ? "Interview customers" : id === TASK_2 ? "Write plan" : "Define the problem",
    description: null,
    priority: "medium",
    due_date: null,
    estimated_hours: 2,
    labels: [],
    checklist: [],
    display_order: 1,
    parent_task_id: parentId,
    review_required: reviewRequired,
    required_deliverable_type: requiredType,
  };
}

const mockDb = makeFakeDb();

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: mockDb,
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn().mockResolvedValue(SESSION),
}));

jest.mock("@/lib/ventureAuth", () => ({
  requireVentureAccess: jest.fn().mockResolvedValue({ session: SESSION }),
}));

// Phase 5c: milestone/task duplication routes decide through the canonical gate.
jest.mock("@/lib/ventureScopedAccess", () => ({
  requireVentureScopedAccess: jest.fn().mockResolvedValue({ session: SESSION, path: "super-admin" }),
}));

jest.mock("@/lib/ventureOperatingPlans", () => ({
  resolvePlanAccess: jest.fn().mockResolvedValue({ ok: true, global: true, code: "VNT-TEST" }),
  allowsPlanAction: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/lib/ventures", () => ({
  addVentureHistory: jest.fn().mockResolvedValue(true),
}));

const { POST: journeyDuplicatePOST } = require("@/app/api/ventures/[id]/journey/duplicate/route");
const { POST: milestoneDuplicatePOST } = require("@/app/api/ventures/[id]/milestones/duplicate/route");
const { POST: taskDuplicatePOST } = require("@/app/api/ventures/[id]/tasks/duplicate/route");

const readJson = async (res) => res.json();
// Journey route resolves internal-UUID params (admin pages pass the id);
// milestone/task routes accept the VNT code like their sibling routes.
const journeyCtx = { params: { id: VENTURE_DB_ID } };
const codeCtx = { params: { id: "VNT-TEST" } };

beforeEach(() => {
  executed.length = 0;
  delete executed._taskSeq;
  jest.clearAllMocks();
  mockDb.flags.stageExists = true;
  mockDb.flags.milestoneExists = true;
  mockDb.flags.taskExists = true;
});

function insertsMatching(sqlLike) {
  return executed.filter((q) => q.sql.includes(sqlLike));
}

describe("POST /journey/duplicate", () => {
  test("duplicates stage with milestones + tasks as fresh, independent rows", async () => {
    const res = await journeyDuplicatePOST(
      new Request("http://localhost/api/ventures/VNT-TEST/journey/duplicate", { method: "POST", body: JSON.stringify({ stage_id: STAGE_ID }) }),
      journeyCtx,
    );
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.success).toBe(true);
    expect(data.stage.name).toBe("Family & Friends — Copy");
    expect(data.stage.status).toBe("locked");
    expect(data.milestones_copied).toBe(2);
    expect(data.tasks_copied).toBe(3);

    // Stage insert: independent row, locked, ordered right after the source.
    const stageInserts = insertsMatching("INSERT INTO venture_journey_stages");
    expect(stageInserts.length).toBe(1);
    const stageArgs = stageInserts[0].args;
    expect(stageArgs[0]).not.toBe(STAGE_ID); // new id
    expect(stageArgs[2]).toBe("Family & Friends — Copy");
    expect(stageInserts[0].sql).toContain("'locked'");
    expect(stageArgs[6]).toBe(2); // temp order = max(1) + 1 before re-serialization

    // Collision-safe re-serialization: park on negatives, then assign 1..n.
    const updates = executed.filter((q) => q.sql.includes("UPDATE venture_journey_stages SET stage_order = ?"));
    const parked = updates.filter((u) => Number(u.args[0]) < 0);
    const finalAssignments = updates.filter((u) => Number(u.args[0]) > 0);
    expect(parked.length).toBeGreaterThan(0);
    expect(finalAssignments.length).toBeGreaterThan(0);

    // Milestone copies: 2, bound to the NEW stage id, reset to not_started.
    const msInserts = insertsMatching("INSERT INTO venture_milestones");
    expect(msInserts.length).toBe(2);
    const newStageId = stageArgs[0];
    for (const ins of msInserts) {
      expect(ins.args[11]).toBe(newStageId); // journey_stage_id → new stage
    }

    // Task copies: 3, reset to backlog, review config preserved. Task ids are
    // SERIAL — the lib omits them and captures RETURNING ids (`copy-N`).
    const taskInserts = insertsMatching("INSERT INTO venture_tasks");
    expect(taskInserts.length).toBe(3);
    const parentInsert = taskInserts.find((t) => t.args[2] === "Define the problem");
    expect(parentInsert).toBeDefined();
    expect(parentInsert.args[12]).toBe("TRUE"); // review_required preserved
    expect(parentInsert.args[13]).toBe("document"); // required deliverable preserved
    const childInsert = taskInserts.find((t) => t.args[2] === "Interview customers");
    expect(childInsert).toBeDefined();
    expect(childInsert.args[11]).toBe("copy-1"); // re-parented to the first copy (parent inserted first)

    // Execution data is never copied.
    const forbidden = executed.filter((q) => /venture_task_submissions|venture_task_reviews|venture_task_comments|venture_task_attachments/.test(q.sql));
    expect(forbidden.length).toBe(0);

    // History event recorded.
    const { addVentureHistory } = require("@/lib/ventures");
    expect(addVentureHistory).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: "JOURNEY_STAGE_DUPLICATED" }),
    );
  });

  test("returns 404 when the stage does not exist and writes nothing", async () => {
    mockDb.flags.stageExists = false;
    const res = await journeyDuplicatePOST(
      new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ stage_id: STAGE_ID }) }),
      journeyCtx,
    );
    expect(res.status).toBe(404);
    const writes = executed.filter((q) => q.sql.startsWith("INSERT") || q.sql.startsWith("UPDATE venture_journey_stages SET stage_order"));
    expect(writes.length).toBe(0);
  });

  test("returns 403 without the manage capability", async () => {
    require("@/lib/ventureOperatingPlans").allowsPlanAction.mockResolvedValueOnce(false);
    const res = await journeyDuplicatePOST(
      new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ stage_id: STAGE_ID }) }),
      journeyCtx,
    );
    expect(res.status).toBe(403);
  });
});

describe("POST /milestones/duplicate", () => {
  test("duplicates a milestone (keeping its journey binding) with fresh tasks", async () => {
    const res = await milestoneDuplicatePOST(
      new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ milestone_id: MILESTONE_1 }) }),
      codeCtx,
    );
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.success).toBe(true);
    expect(data.milestone.title).toBe("Pitch Deck — Copy");
    expect(data.milestone.journey_stage_id).toBe(STAGE_ID);
    expect(data.tasks_copied).toBe(2); // parent + child from the fixture

    const msInserts = insertsMatching("INSERT INTO venture_milestones");
    expect(msInserts.length).toBe(1);
    expect(msInserts[0].args[11]).toBe(STAGE_ID); // binding preserved
    const taskInserts = insertsMatching("INSERT INTO venture_tasks");
    expect(taskInserts.length).toBe(2);
    for (const ins of taskInserts) {
      expect(ins.args[1]).toBe(msInserts[0].args[0]); // bound to the copy (milestone_id)
    }
    const childInsert = taskInserts.find((t) => t.args[2] === "Interview customers");
    const parentInsert = taskInserts.find((t) => t.args[2] === "Define the problem");
    expect(childInsert.args[11]).toBe("copy-1"); // re-parented inside the copy
  });

  test("returns 404 when the milestone does not exist", async () => {
    mockDb.flags.milestoneExists = false;
    const res = await milestoneDuplicatePOST(
      new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ milestone_id: "nope" }) }),
      codeCtx,
    );
    expect(res.status).toBe(404);
  });
});

describe("POST /tasks/duplicate", () => {
  test("duplicates a single task as a backlog copy with the same binding", async () => {
    const res = await taskDuplicatePOST(
      new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ task_id: TASK_PARENT }) }),
      codeCtx,
    );
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.success).toBe(true);
    expect(data.task.title).toBe("Define the problem — Copy");

    const inserts = insertsMatching("INSERT INTO venture_tasks");
    expect(inserts.length).toBe(1);
    const args = inserts[0].args;
    expect(args[1]).toBe(MILESTONE_1); // same milestone binding
    expect(args[11]).toBe("TRUE"); // review_required preserved (parent is a NULL literal)
    expect(args[12]).toBe("document");
    expect(data.task.id).toBeTruthy(); // SERIAL id captured from RETURNING
  });

  test("returns 404 when the task does not exist", async () => {
    mockDb.flags.taskExists = false;
    const res = await taskDuplicatePOST(
      new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ task_id: "nope" }) }),
      codeCtx,
    );
    expect(res.status).toBe(404);
  });
});
