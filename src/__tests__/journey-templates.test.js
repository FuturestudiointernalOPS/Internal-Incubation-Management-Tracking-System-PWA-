/**
 * Contract tests — Journey template library (Save-as-Template).
 *
 * POST /api/ventures/[id]/journey/save-template
 *   → entire Venture journey (stages + bound milestones + top-level tasks)
 *     becomes an independent, structure-only library template
 * POST /api/ventures/[id]/journey/apply-journey-template
 *   → fresh journey stages (first active, rest locked) + fresh milestones and
 *     tasks; 409 when the Venture already has stages
 * GET /api/journey-templates — library listing with structural counts
 */

const executed = [];

const VENTURE_DB_ID = "11111111-1111-4111-8111-111111111111";
const STAGE_1 = "22222222-2222-4222-8222-222222222222";
const STAGE_2 = "33333333-3333-4333-8333-333333333333";
const MS_1 = "44444444-4444-4444-8444-444444444444";
const MS_2 = "55555555-5555-4555-8555-555555555555";
const SESSION = { cid: "staff-1", name: "Test Staff", role: "super_admin" };

function makeFakeDb() {
  const flags = { existingStages: false, hasStages: true };

  const execute = jest.fn(async ({ sql, args = [] }) => {
    executed.push({ sql, args });
    if (sql.startsWith("CREATE TABLE IF NOT EXISTS venture_journey_stages")) return { rows: [] };
    if (sql.includes("FROM ventures WHERE id::text")) return { rows: [{ id: VENTURE_DB_ID }] };
    if (sql.includes("SELECT COUNT(*) AS n FROM venture_journey_stages")) {
      return { rows: [{ n: flags.existingStages ? 2 : 0 }] };
    }
    if (sql.includes("SELECT id, name FROM venture_journey_templates WHERE id = ?")) {
      return { rows: [{ id: "tpl-1", name: "F&F Journey" }] };
    }
    // Save path: the Venture's current stages
    if (sql.includes("SELECT * FROM venture_journey_stages WHERE venture_id = ?") && sql.includes("ORDER BY stage_order ASC")) {
      return flags.hasStages
        ? {
            rows: [
              { id: STAGE_1, venture_id: VENTURE_DB_ID, name: "Family & Friends", description: "d1", objective: "o1", stage_order: 1, status: "active" },
              { id: STAGE_2, venture_id: VENTURE_DB_ID, name: "GTM", description: null, objective: null, stage_order: 2, status: "locked" },
            ],
          }
        : { rows: [] };
    }
    // Library listing
    if (sql.includes("FROM venture_journey_templates t") && sql.includes("ORDER BY t.created_at DESC")) {
      return { rows: [{ id: "tpl-1", name: "F&F Journey", description: null, stage_count: 2, milestone_count: 3, task_count: 5 }] };
    }
    return { rows: [] };
  });

  const tx = jest.fn(async (sql, args = []) => {
    executed.push({ tx: true, sql, args });
    // Save path inside the transaction
    if (sql.includes("SELECT * FROM venture_milestones WHERE journey_stage_id = ?")) {
      const stageId = String(args[0]);
      return {
        rows:
          stageId === STAGE_1
            ? [{ id: MS_1, title: "Pitch Deck", description: null, objective: null, priority: "high", display_order: 1 }]
            : stageId === STAGE_2
              ? [{ id: MS_2, title: "Persona", description: null, objective: null, priority: "medium", display_order: 1 }]
              : [],
      };
    }
    if (sql.includes("SELECT * FROM venture_tasks") && sql.includes("parent_task_id IS NULL")) {
      const msId = String(args[0]);
      return {
        rows:
          msId === MS_1
            ? [{ id: 11, title: "Define problem", description: null, priority: "high", labels: [], checklist: [], review_required: true, required_deliverable_type: "document", display_order: 1 }]
            : msId === MS_2
              ? [{ id: 22, title: "Interviews", description: null, priority: "medium", labels: [], checklist: [], review_required: false, required_deliverable_type: null, display_order: 1 }]
              : [],
      };
    }
    // Apply path inside the transaction
    if (sql.includes("SELECT * FROM venture_journey_template_stages WHERE template_id = ?")) {
      return {
        rows: [
          { id: "ts1", name: "Family & Friends", description: "d1", objective: "o1", stage_order: 1 },
          { id: "ts2", name: "GTM", description: null, objective: null, stage_order: 2 },
        ],
      };
    }
    if (sql.includes("SELECT * FROM venture_journey_template_milestones WHERE stage_id = ?")) {
      const stageId = String(args[0]);
      return {
        rows: stageId === "ts1" ? [{ id: "tms1", title: "Pitch Deck", description: null, objective: null, priority: "high", display_order: 1 }] : [{ id: "tms2", title: "Persona", description: null, objective: null, priority: "medium", display_order: 1 }],
      };
    }
    if (sql.includes("SELECT * FROM venture_journey_template_tasks WHERE milestone_id = ?")) {
      const msId = String(args[0]);
      return {
        rows: msId === "tms1" ? [{ id: "ttk1", title: "Define problem", description: null, priority: "high", labels: [], checklist: [], review_required: true, required_deliverable_type: "document", display_order: 1 }] : [{ id: "ttk2", title: "Interviews", description: null, priority: "medium", labels: [], checklist: [], review_required: false, required_deliverable_type: null, display_order: 1 }],
      };
    }
    // RETURNING id for the new journey stage
    if (sql.includes("INSERT INTO venture_journey_stages") && sql.includes("RETURNING id")) {
      executed._stageSeq = (executed._stageSeq || 0) + 1;
      return { rows: [{ id: `new-stage-${executed._stageSeq}` }] };
    }
    return { rows: [] };
  });

  return { execute, transaction: jest.fn(async (cb) => cb(tx)), flags };
}

const mockDb = makeFakeDb();

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: mockDb,
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn().mockResolvedValue(SESSION),
  requireAuth: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/lib/ventureOperatingPlans", () => ({
  resolvePlanAccess: jest.fn().mockResolvedValue({ ok: true, global: true, code: "VNT-TEST" }),
  allowsPlanAction: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/lib/ventureAuth", () => ({
  requireVentureAccess: jest.fn().mockResolvedValue({ session: SESSION }),
}));

jest.mock("@/lib/ventures", () => ({
  addVentureHistory: jest.fn().mockResolvedValue(true),
}));

const { POST: savePOST } = require("@/app/api/ventures/[id]/journey/save-template/route");
const { POST: applyPOST } = require("@/app/api/ventures/[id]/journey/apply-journey-template/route");
const { GET: listGET } = require("@/app/api/journey-templates/route");

const readJson = async (res) => res.json();
const ctx = { params: { id: VENTURE_DB_ID } };

beforeEach(() => {
  executed.length = 0;
  delete executed._stageSeq;
  jest.clearAllMocks();
  mockDb.flags.existingStages = false;
  mockDb.flags.hasStages = true;
});

function insertsMatching(sqlLike) {
  return executed.filter((q) => q.sql.includes(sqlLike));
}

describe("POST /journey/save-template — save entire journey as template", () => {
  test("copies stages + bound milestones + top-level tasks into the library", async () => {
    const res = await savePOST(new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ name: "F&F Blueprint" }) }), ctx);
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.success).toBe(true);
    expect(data.name).toBe("F&F Blueprint");
    expect(data.stages).toBe(2);
    expect(data.milestones).toBe(2);
    expect(data.tasks).toBe(2);

    const tplInsert = insertsMatching("INSERT INTO venture_journey_templates")[0];
    expect(tplInsert).toBeDefined();
    expect(tplInsert.args[1]).toBe("F&F Blueprint");

    // 2 template stages bound to the new template id, ordered
    const stageInserts = insertsMatching("INSERT INTO venture_journey_template_stages");
    expect(stageInserts.length).toBe(2);
    for (const ins of stageInserts) {
      expect(ins.args[1]).toBe(tplInsert.args[0]);
    }
    expect(insertsMatching("INSERT INTO venture_journey_template_milestones").length).toBe(2);
    expect(insertsMatching("INSERT INTO venture_journey_template_tasks").length).toBe(2);
    // review config preserved on template tasks
    const taskInsert = insertsMatching("INSERT INTO venture_journey_template_tasks").find((t) => t.args[2] === "Define problem");
    expect(taskInsert.args).toEqual(expect.arrayContaining(["TRUE", "document"]));

    const { addVentureHistory } = require("@/lib/ventures");
    expect(addVentureHistory).toHaveBeenCalledWith(expect.objectContaining({ event_type: "JOURNEY_TEMPLATE_SAVED" }));
  });

  test("returns 400 when the Venture has no stages", async () => {
    mockDb.flags.hasStages = false;
    const res = await savePOST(new Request("http://localhost/x", { method: "POST", body: "{}" }), ctx);
    expect(res.status).toBe(400);
  });
});

describe("POST /journey/apply-journey-template — generate journey from saved template", () => {
  test("creates fresh stages (first active) with milestones and tasks", async () => {
    const res = await applyPOST(new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ template_id: "tpl-1" }) }), ctx);
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.success).toBe(true);
    expect(data.stages).toBe(2);
    expect(data.milestones).toBe(2);
    expect(data.tasks).toBe(2);

    const stageInserts = insertsMatching("INSERT INTO venture_journey_stages");
    expect(stageInserts.length).toBe(2);
    expect(stageInserts[0].args[5]).toBe("active");
    expect(stageInserts[1].args[5]).toBe("locked");
    // Milestones bound to the freshly returned stage ids
    const msInserts = insertsMatching("INSERT INTO venture_milestones");
    expect(msInserts.length).toBe(2);
    for (const ins of msInserts) {
      expect(["new-stage-1", "new-stage-2"]).toContain(ins.args[8]); // journey_stage_id
    }
    expect(insertsMatching("INSERT INTO venture_tasks").length).toBe(2);
    expect(insertsMatching("INSERT INTO venture_tasks")[0].sql).toContain("'backlog'");
  });

  test("returns 409 when the Venture already has journey stages", async () => {
    mockDb.flags.existingStages = true;
    const res = await applyPOST(new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ template_id: "tpl-1" }) }), ctx);
    expect(res.status).toBe(409);
  });
});

describe("GET /api/journey-templates — library listing", () => {
  test("returns templates with structural counts", async () => {
    const res = await listGET(new Request("http://localhost/api/journey-templates"));
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.success).toBe(true);
    expect(data.templates[0]).toMatchObject({ id: "tpl-1", stage_count: 2, milestone_count: 3, task_count: 5 });
  });
});
