/**
 * Plan import — correcting a proposal, and applying one (Phase 3).
 *
 * These are the two steps that carry risk: a correction must not quietly rewrite
 * a plan, and an apply must not half-build a programme. So the tests pin the
 * guards — a person a human already placed keeps their place, a correction
 * reports what moved, and a draft can only be applied once.
 */
const mockChat = jest.fn();
jest.mock("@/lib/deepseek", () => ({
  deepseekIntelligence: { chat: (...args) => mockChat(...args) },
  default: { chat: (...args) => mockChat(...args) },
}));

jest.mock("@/lib/ventures", () => ({ addDependency: jest.fn(async () => ({ success: true })) }));

const mockContacts = { byName: new Map() };
jest.mock("@/lib/db", () => {
  const state = {
    executeImpl: async () => ({ rows: [] }),
    queryImpl: async () => ({ rows: [] }),
    queries: [],
  };
  return {
    __esModule: true,
    default: {
      execute: jest.fn(async (arg) => state.executeImpl(arg)),
      transaction: jest.fn(async (fn) =>
        fn(async (sql, args = []) => {
          state.queries.push({ sql, args });
          return state.queryImpl(sql, args);
        }),
      ),
    },
    initDb: jest.fn().mockResolvedValue(true),
    __state: state,
  };
});

const { __state: state } = require("@/lib/db");
const { addDependency } = require("@/lib/ventures");
const { diffProposals, revisePlanProposal, applyPlanImport } = require("@/services/ventures/planImport");

const PROPOSAL = {
  journeys: [
    {
      name: "Growth engine",
      objective: "Reach 500 customers",
      start_date: "2026-10-01",
      target_date: "2026-12-22",
      milestones: [
        {
          ref: "MS01",
          name: "Readiness",
          tasks: [
            {
              ref: "MS01-01",
              title: "Interview customers",
              owner_name: "Amina",
              start_date: "2026-10-03",
              due_date: "2026-10-14",
              priority: "high",
              depends_on: [],
              deliverables: [{ title: "Interview summary" }],
            },
          ],
        },
      ],
    },
  ],
  unplaced: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockContacts.byName.clear();
  state.queries = [];
  state.queryImpl = async (sql) => (/RETURNING id/.test(sql) ? { rows: [{ id: 101 }] } : { rows: [] });
  state.executeImpl = async ({ sql, args = [] }) => {
    if (String(sql).includes("LOWER(name) = LOWER(?)")) {
      const cid = mockContacts.byName.get(String(args[0]).toLowerCase());
      return { rows: cid ? [{ cid }] : [] };
    }
    return { rows: [{ id: "draft-1" }] };
  };
  addDependency.mockResolvedValue({ success: true });
});

describe("diffProposals — what a correction actually moved", () => {
  test("no change is no change", () => {
    expect(diffProposals(PROPOSAL, JSON.parse(JSON.stringify(PROPOSAL)))).toEqual([]);
  });

  test("a re-dated task and a renamed owner are both reported, with their values", () => {
    const after = JSON.parse(JSON.stringify(PROPOSAL));
    after.journeys[0].milestones[0].tasks[0].due_date = "2026-11-01";
    after.journeys[0].milestones[0].tasks[0].owner_name = "Aminata";

    const changes = diffProposals(PROPOSAL, after);
    const due = changes.find((change) => change.field === "due_date");
    const owner = changes.find((change) => change.field === "owner_name");

    expect(due).toMatchObject({ scope: "task", from: "2026-10-14", to: "2026-11-01" });
    expect(owner).toMatchObject({ from: "Amina", to: "Aminata" });
  });

  test("an added task shows up as a count change on its milestone", () => {
    const after = JSON.parse(JSON.stringify(PROPOSAL));
    after.journeys[0].milestones[0].tasks.push({ ref: "MS01-02", title: "New task", depends_on: [], deliverables: [] });
    const changes = diffProposals(PROPOSAL, after);
    expect(changes.find((change) => change.scope === "tasks")).toMatchObject({ from: "1", to: "2" });
  });
});

describe("revisePlanProposal — a suggestion, never a write", () => {
  const instruction = "Move the due date to November";

  test("an empty instruction is refused before the model is even called", async () => {
    const out = await revisePlanProposal({ proposal: PROPOSAL, instruction: "   " });
    expect(out.ok).toBe(false);
    expect(mockChat).not.toHaveBeenCalled();
  });

  test("a person the reviewer already placed keeps their place", async () => {
    // Amina was resolved by hand and stored on the draft.
    const stored = JSON.parse(JSON.stringify(PROPOSAL));
    stored.journeys[0].milestones[0].tasks[0].owner_cid = "c-amina";

    mockChat.mockResolvedValue(JSON.stringify(stored));

    const out = await revisePlanProposal({ proposal: stored, instruction });
    expect(out.ok).toBe(true);
    // Nothing in contacts matches "Amina" — but the human's choice survives.
    expect(out.proposal.journeys[0].milestones[0].tasks[0].owner_cid).toBe("c-amina");
    expect(out.unmatched_owners).toEqual([]);
  });

  test("a name the analyst changed is re-checked, not assumed", async () => {
    mockContacts.byName.set("aminata", "c-aminata");
    const renamed = JSON.parse(JSON.stringify(PROPOSAL));
    renamed.journeys[0].milestones[0].tasks[0].owner_name = "Aminata";
    mockChat.mockResolvedValue(JSON.stringify(renamed));

    const out = await revisePlanProposal({ proposal: PROPOSAL, instruction: "Amina is Aminata" });
    const task = out.proposal.journeys[0].milestones[0].tasks[0];
    expect(task.owner_name).toBe("Aminata");
    expect(task.owner_cid).toBe("c-aminata");
    expect(out.changes.some((change) => change.field === "owner_name")).toBe(true);
  });

  test("garbage from the model is refused, not repaired", async () => {
    mockChat.mockResolvedValue("I could not do that.");
    const out = await revisePlanProposal({ proposal: PROPOSAL, instruction });
    expect(out.ok).toBe(false);
    expect(out.error).toMatch(/no usable JSON/i);
  });
});

describe("applyPlanImport — a programme, built once", () => {
  test("stages, milestones, tasks, deliverables and edges are created", async () => {
    const withEdge = JSON.parse(JSON.stringify(PROPOSAL));
    withEdge.journeys[0].milestones[0].tasks.push({
      ref: "MS01-02",
      title: "Second task",
      owner_name: null,
      depends_on: ["MS01-01"],
      deliverables: [{ title: "Proof" }],
    });
    // Give each task its own id back from the fake.
    let nextId = 200;
    state.queryImpl = async (sql) => {
      if (/INSERT INTO venture_tasks/.test(sql)) {
        nextId += 1;
        return { rows: [{ id: nextId }] };
      }
      return { rows: [] };
    };

    const out = await applyPlanImport({ dbId: "v-1", importId: "d-1", proposal: withEdge, actorCid: "c-1" });

    expect(out.error).toBeUndefined();
    expect(out.counts).toMatchObject({
      journeys: 1,
      milestones: 1,
      tasks: 2,
      deliverables: 2,
      dependencies: 1,
    });

    const stageInsert = state.queries.find((entry) => /INSERT INTO venture_journey_stages/.test(entry.sql));
    expect(stageInsert.sql).toContain("'plan_import'");
    // The first journey opens; that is what makes an undated plan usable at all.
    expect(stageInsert.args).toContain("active");

    const milestoneInsert = state.queries.find((entry) => /INSERT INTO venture_milestones/.test(entry.sql));
    expect(milestoneInsert.sql).toContain("start_date");
    expect(milestoneInsert.args).toContain("not_started");

    const taskInsert = state.queries.find((entry) => /INSERT INTO venture_tasks/.test(entry.sql));
    // The tracker's planned start is stored (the column exists for this).
    expect(taskInsert.sql).toContain("start_date");
    expect(taskInsert.args).toContain("2026-10-03");

    const deliverableInsert = state.queries.find((entry) => /INSERT INTO venture_deliverables/.test(entry.sql));
    expect(deliverableInsert.args).toContain("Interview summary");

    // source blocks target: MS01-01 blocks MS01-02.
    expect(addDependency).toHaveBeenCalledTimes(1);
    expect(addDependency.mock.calls[0][0]).toMatchObject({
      ventureId: "v-1",
      sourceType: "task",
      targetType: "task",
      sourceId: 201,
      targetId: 202,
    });
  });

  test("a refused edge is reported, and does not lose the rest of the programme", async () => {
    const withEdge = JSON.parse(JSON.stringify(PROPOSAL));
    withEdge.journeys[0].milestones[0].tasks.push({
      ref: "MS01-02",
      title: "Second task",
      depends_on: ["MS01-01"],
      deliverables: [],
    });
    addDependency.mockRejectedValueOnce(new Error("Circular dependency detected."));

    const out = await applyPlanImport({ dbId: "v-1", importId: "d-1", proposal: withEdge });
    expect(out.error).toBeUndefined();
    expect(out.counts.tasks).toBe(2);
    expect(out.warnings[0]).toMatch(/Circular dependency detected/);
  });

  test("a draft that is not open cannot be applied a second time", async () => {
    state.executeImpl = async () => ({ rows: [] }); // the guarded UPDATE matched nothing
    const out = await applyPlanImport({ dbId: "v-1", importId: "d-1", proposal: PROPOSAL });
    expect(out.error).toMatch(/already applied or discarded/i);
  });
});
