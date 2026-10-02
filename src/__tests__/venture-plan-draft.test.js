/**
 * Plan import — the DRAFT (Phase 2).
 *
 * The proposal a reviewer corrects has to survive: it is the only thing that
 * carries the tracker's dates, owners, deliverables and dependency references,
 * none of which any platform table holds. These tests pin the parts that make
 * the draft trustworthy — stats and the unmatched-owner list are COMPUTED from
 * what is stored, never accepted from the caller, and an open draft is the only
 * thing that can be edited.
 */
jest.mock("@/lib/deepseek", () => ({
  deepseekIntelligence: { chat: jest.fn() },
  default: { chat: jest.fn() },
}));

jest.mock("@/lib/db", () => {
  const state = {
    executeImpl: async () => ({ rows: [] }),
    queryImpl: async () => ({ rows: [] }),
  };
  return {
    __esModule: true,
    default: {
      execute: jest.fn(async (arg) => state.executeImpl(arg)),
      transaction: jest.fn(async (fn) => fn(async (sql, args = []) => state.queryImpl(sql, args))),
    },
    initDb: jest.fn().mockResolvedValue(true),
    __state: state,
  };
});

const { __state: state } = require("@/lib/db");
const {
  computeProposalStats,
  collectUnmatchedOwners,
  createPlanImport,
  updatePlanImportProposal,
  discardPlanImport,
  getOpenPlanImport,
} = require("@/services/ventures/planImport");

/** One journey, one milestone, two tasks; one owner known, one not. */
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
          objective: null,
          start_date: null,
          target_date: null,
          tasks: [
            {
              ref: "MS01-01",
              title: "Interview customers",
              owner_name: "Amina",
              owner_cid: "c-amina",
              start_date: "2026-10-03",
              due_date: "2026-10-14",
              priority: "high",
              depends_on: [],
              deliverables: [{ title: "Interview summary" }],
            },
            {
              ref: "MS01-02",
              title: "Redesign onboarding",
              owner_name: "Ghost",
              owner_cid: null,
              start_date: null,
              due_date: null,
              priority: "medium",
              depends_on: ["MS01-01"],
              deliverables: [{ title: "New workflow" }, { title: "Approval note" }],
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
  state.executeImpl = async () => ({ rows: [] });
  state.queryImpl = async () => ({ rows: [] });
});

describe("computeProposalStats", () => {
  test("counts what the proposal actually holds", () => {
    expect(computeProposalStats(PROPOSAL)).toEqual({
      journeys: 1,
      milestones: 1,
      tasks: 2,
      deliverables: 3,
    });
  });

  test("an empty or broken proposal counts as zero, not as a crash", () => {
    const zeros = { journeys: 0, milestones: 0, tasks: 0, deliverables: 0 };
    expect(computeProposalStats(null)).toEqual(zeros);
    expect(computeProposalStats({ journeys: [{ milestones: [{ tasks: [{ deliverables: null }] }] }] })).toEqual({
      journeys: 1,
      milestones: 1,
      tasks: 1,
      deliverables: 0,
    });
  });
});

describe("collectUnmatchedOwners", () => {
  test("names the people a review still has to place, once each", () => {
    expect(collectUnmatchedOwners(PROPOSAL)).toEqual(["Ghost"]);
  });

  test("a task with no owner is not an unmatched owner", () => {
    expect(
      collectUnmatchedOwners({ journeys: [{ milestones: [{ tasks: [{ owner_name: "  ", owner_cid: null }] }] }] }),
    ).toEqual([]);
  });
});

describe("createPlanImport", () => {
  test("computes the counts itself and supersedes the open draft", async () => {
    const calls = [];
    state.queryImpl = async (sql, args = []) => {
      calls.push({ sql, args });
      if (/^SELECT id FROM venture_plan_imports/.test(sql)) return { rows: [{ id: "old-draft" }] };
      if (/^INSERT INTO venture_plan_imports/.test(sql)) return { rows: [{ id: "new-draft" }] };
      return { rows: [] };
    };

    const out = await createPlanImport({
      ventureId: "v-1",
      fileName: "tracker.xlsx",
      fileKind: "xlsx",
      sheets: [{ name: "Tracker", rows: 28 }],
      proposal: PROPOSAL,
      warnings: ["a warning"],
      actorCid: "c-staff",
    });

    expect(out.id).toBe("new-draft");
    expect(out.superseded).toBe(1);

    const insert = calls.find((call) => /^INSERT INTO venture_plan_imports/.test(call.sql));
    // stats + unmatched owners are DERIVED, never taken from the caller
    expect(JSON.parse(insert.args[5])).toEqual({ journeys: 1, milestones: 1, tasks: 2, deliverables: 3 });
    expect(JSON.parse(insert.args[6])).toEqual(["Ghost"]);
    expect(JSON.parse(insert.args[7])).toEqual(["a warning"]);
    expect(insert.args[8]).toBe("c-staff");
  });

  test("with no open draft nothing is superseded", async () => {
    state.queryImpl = async (sql) =>
      /^INSERT INTO venture_plan_imports/.test(sql) ? { rows: [{ id: "first" }] } : { rows: [] };
    const out = await createPlanImport({ ventureId: "v-1", proposal: PROPOSAL });
    expect(out.superseded).toBe(0);
    expect(out.id).toBe("first");
  });
});

describe("updatePlanImportProposal", () => {
  test("recomputes the counts from what was saved", async () => {
    const calls = [];
    state.executeImpl = async ({ sql, args = [] }) => {
      calls.push({ sql, args });
      return {
        rows: [
          {
            id: "d-1",
            venture_id: "v-1",
            proposal: JSON.stringify(PROPOSAL),
            stats: JSON.stringify({ journeys: 1, milestones: 1, tasks: 2, deliverables: 3 }),
            unmatched_owners: JSON.stringify(["Ghost"]),
            warnings: JSON.stringify([]),
            sheets: JSON.stringify([]),
            status: "proposed",
          },
        ],
      };
    };

    const edited = { ...PROPOSAL, journeys: [{ ...PROPOSAL.journeys[0], milestones: [] }] };
    const out = await updatePlanImportProposal({ id: "d-1", ventureId: "v-1", proposal: edited });

    const call = calls.find((entry) => /^UPDATE venture_plan_imports/.test(entry.sql));
    expect(JSON.parse(call.args[1])).toEqual({ journeys: 1, milestones: 0, tasks: 0, deliverables: 0 });
    expect(JSON.parse(call.args[2])).toEqual([]);
    // Only an OPEN draft is editable — the guard is in the statement itself.
    expect(call.sql).toContain("status = 'proposed'");
    expect(out.draft.id).toBe("d-1");
  });

  test("a draft that is no longer open cannot be edited", async () => {
    state.executeImpl = async () => ({ rows: [] });
    const out = await updatePlanImportProposal({ id: "gone", ventureId: "v-1", proposal: PROPOSAL });
    expect(out.error).toMatch(/no longer open/i);
    expect(out.draft).toBeUndefined();
  });
});

describe("discardPlanImport", () => {
  test("says whether a draft was actually closed", async () => {
    state.executeImpl = async () => ({ rows: [{ id: "d-1" }] });
    expect(await discardPlanImport({ id: "d-1", ventureId: "v-1" })).toEqual({ discarded: true });

    state.executeImpl = async () => ({ rows: [] });
    expect(await discardPlanImport({ id: "d-1", ventureId: "v-1" })).toEqual({ discarded: false });
  });
});

describe("getOpenPlanImport", () => {
  test("no open draft is null, not an error", async () => {
    state.executeImpl = async () => ({ rows: [] });
    expect(await getOpenPlanImport("v-1")).toBe(null);
  });

  test("a stored draft comes back with its jsonb read, not as text", async () => {
    state.executeImpl = async () => ({
      rows: [
        {
          id: "d-9",
          venture_id: "v-1",
          proposal: JSON.stringify(PROPOSAL),
          stats: JSON.stringify({ journeys: 1, milestones: 1, tasks: 2, deliverables: 3 }),
          unmatched_owners: JSON.stringify(["Ghost"]),
          warnings: JSON.stringify(["w"]),
          sheets: JSON.stringify([{ name: "Tracker", rows: 28 }]),
          status: "proposed",
        },
      ],
    });
    const draft = await getOpenPlanImport("v-1");
    expect(draft.proposal.journeys[0].milestones[0].tasks[1].owner_name).toBe("Ghost");
    expect(draft.stats.tasks).toBe(2);
    expect(draft.unmatched_owners).toEqual(["Ghost"]);
    expect(draft.sheets[0].name).toBe("Tracker");
  });
});
