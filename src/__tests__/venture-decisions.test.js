/**
 * The decisions, pinned: 1C (dates are a suggestion), 2B (task ids),
 * 4B (the tracker's extra columns travel with the task).
 */
const mockChat = jest.fn();
jest.mock("@/lib/deepseek", () => ({
  deepseekIntelligence: { chat: (...args) => mockChat(...args) },
  default: { chat: (...args) => mockChat(...args) },
}));

jest.mock("@/lib/ventures", () => ({ addDependency: jest.fn(async () => ({ success: true })) }));

jest.mock("@/lib/db", () => {
  const state = { executeImpl: async () => ({ rows: [] }), queryImpl: async () => ({ rows: [] }), queries: [] };
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
const { deriveProposalDates, interpretPlanSheet, applyPlanImport } = require("@/services/ventures/planImport");

const journeyWith = (milestone) => [{ name: "Growth engine", objective: null, milestones: [milestone] }];

beforeEach(() => {
  jest.clearAllMocks();
  state.queries = [];
  state.queryImpl = async (sql) => (/RETURNING id/.test(sql) ? { rows: [{ id: 301 }] } : { rows: [] });
  state.executeImpl = async () => ({ rows: [{ id: "draft-1" }] });
});

describe("1C — dates the sheet never stated are a SUGGESTION", () => {
  test("a milestone spans its own tasks and the journey spans its milestones", () => {
    const warnings = [];
    const journeys = journeyWith({
      name: "Readiness",
      start_date: null,
      target_date: null,
      tasks: [
        { title: "A", start_date: "2026-10-03", due_date: "2026-10-14" },
        { title: "B", start_date: "2026-10-15", due_date: "2026-11-02" },
      ],
    });

    deriveProposalDates(journeys, warnings);

    expect(journeys[0].milestones[0].start_date).toBe("2026-10-03");
    expect(journeys[0].milestones[0].target_date).toBe("2026-11-02");
    expect(journeys[0].start_date).toBe("2026-10-03");
    expect(journeys[0].target_date).toBe("2026-11-02");
    // Every derived level says so, and the reviewer is told the rule.
    expect(journeys[0].milestones[0].dates_derived).toBe(true);
    expect(journeys[0].dates_derived).toBe(true);
    expect(warnings.join(" ")).toMatch(/SUGGESTED from the task dates/);
  });

  test("a date the tracker DID state is never overwritten", () => {
    const warnings = [];
    // NOTE: the dates belong to the JOURNEY here. A journey with no dates of its
    // own would legitimately be derived from its milestones — which is the row
    // below, and exactly what makes this assertion worth making.
    const journeys = [
      {
        name: "Growth engine",
        start_date: "2026-01-01",
        target_date: "2026-01-31",
        milestones: [
          {
            name: "Readiness",
            start_date: "2026-02-01",
            target_date: "2026-02-28",
            tasks: [{ title: "A", start_date: "2026-10-03", due_date: "2026-10-14" }],
          },
        ],
      },
    ];

    deriveProposalDates(journeys, warnings);

    expect(journeys[0].start_date).toBe("2026-01-01");
    expect(journeys[0].target_date).toBe("2026-01-31");
    expect(journeys[0].milestones[0].start_date).toBe("2026-02-01");
    expect(journeys[0].milestones[0].target_date).toBe("2026-02-28");
    expect(journeys[0].dates_derived).toBeUndefined();
    expect(journeys[0].milestones[0].dates_derived).toBeUndefined();
    expect(warnings).toEqual([]);
  });

  test("tasks with no dates suggest nothing at all", () => {
    const warnings = [];
    const journeys = journeyWith({ name: "Readiness", tasks: [{ title: "A" }] });
    deriveProposalDates(journeys, warnings);
    expect(journeys[0].milestones[0].start_date).toBeUndefined();
    expect(warnings).toEqual([]);
  });
});

describe("2B — inferred task references are said out loud", () => {
  test("refs_derived from the analyst becomes a warning and a flag", async () => {
    mockChat.mockResolvedValue(
      JSON.stringify({
        refs_derived: true,
        journeys: [
          {
            name: "J",
            milestones: [
              { ref: "MS01", name: "M", tasks: [{ ref: "MS01-01", title: "T", deliverables: [] }] },
            ],
          },
        ],
      }),
    );
    const out = await interpretPlanSheet({ sheets: [{ name: "Tracker", rows: [["ID"]] }] });
    expect(out.ok).toBe(true);
    expect(out.proposal.refs_derived).toBe(true);
    expect(out.warnings.join(" ")).toMatch(/numbered by row order/);
  });

  test("an explicit task id per row is not flagged", async () => {
    mockChat.mockResolvedValue(
      JSON.stringify({
        journeys: [
          {
            name: "J",
            milestones: [{ name: "M", tasks: [{ ref: "T-001", title: "T", deliverables: [] }] }],
          },
        ],
      }),
    );
    const out = await interpretPlanSheet({ sheets: [{ name: "Tracker", rows: [["Task ID"]] }] });
    expect(out.proposal.refs_derived).toBe(false);
    expect(out.warnings.join(" ")).not.toMatch(/row order/);
  });
});

describe("4B — the tracker's extra columns travel with the task", () => {
  test("Support and Phase become labels, Definition of Done becomes the description", async () => {
    const proposal = {
      journeys: [
        {
          name: "J",
          milestones: [
            {
              name: "M",
              tasks: [
                {
                  ref: "T1",
                  title: "Interview customers",
                  support: "David",
                  phase: "Phase 1",
                  definition_of_done: "10 interviews completed",
                  deliverables: [],
                  depends_on: [],
                },
              ],
            },
          ],
        },
      ],
      unplaced: [],
    };

    await applyPlanImport({ dbId: "v-1", importId: "d-1", proposal });

    const taskInsert = state.queries.find((entry) => /INSERT INTO venture_tasks/.test(entry.sql));
    // args: 0 venture, 1 milestone, 2 title, 3 description, 4 priority, 5 start, 6 due,
    // 7 owner_cid, 8 owner_name, 9 display_order, 10 labels
    expect(JSON.parse(taskInsert.args[10])).toEqual(["Support: David", "Phase 1"]);
    expect(taskInsert.args[3]).toBe("10 interviews completed");
    // No schema grew for it.
    expect(taskInsert.sql).not.toContain("support");
    expect(taskInsert.sql).not.toContain("definition_of_done");
  });
});
