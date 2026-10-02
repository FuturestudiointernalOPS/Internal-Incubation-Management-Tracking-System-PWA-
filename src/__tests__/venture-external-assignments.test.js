/**
 * EXTERNAL ASSIGNMENTS — a tracker name is a REFERENCE, never an account.
 *
 * The rule this file exists to protect (RULE 3): a name in a tracker must not
 * create an ImpactOS person. The first implementation got that wrong by giving
 * every unknown name a person row; these tests fail against that design and pass
 * against this one.
 *
 * The other half is that the plan must still WORK — RULE 1, 2, 6 and 10 — with
 * every assignee completely off-platform.
 */
jest.mock("@/lib/deepseek", () => ({
  deepseekIntelligence: { chat: jest.fn() },
  default: { chat: jest.fn() },
}));
jest.mock("@/lib/ventures", () => ({ addDependency: jest.fn(async () => ({ success: true })) }));

jest.mock("@/lib/db", () => {
  const state = { queries: [], updateRows: null };
  const run = async ({ sql, args = [] }) => {
    state.queries.push({ sql, args });
    const text = String(sql).replace(/\s+/g, " ").trim();

    // A single-assignment resolve returns the row it touched.
    if (text.includes("RETURNING id, ") && text.includes("AS name")) {
      return { rows: state.updateRows === "none" ? [] : [{ id: "e-1", name: "Amina" }] };
    }
    // Closing the draft comes FIRST: its table name starts with "venture_" too.
    if (text.startsWith("UPDATE venture_plan_imports") && text.includes("RETURNING id")) {
      return { rows: [{ id: "d-1" }] };
    }
    // A bulk resolve returns the ids it changed — and only the level that has them.
    if (text.startsWith("UPDATE venture_") && text.includes("RETURNING id")) {
      const name = String(args[2] || "").toLowerCase();
      const isTasks = text.startsWith("UPDATE venture_tasks ");
      return { rows: name === "amina" && isTasks ? [{ id: "a" }, { id: "b" }] : [] };
    }
    // The still-unresolved census.
    if (text.includes("AS name, COUNT(*) AS count")) {
      const isTask = text.includes("venture_tasks");
      return { rows: isTask ? [{ name: "Amina", count: "9" }, { name: "David", count: "3" }] : [] };
    }
    return { rows: [] };
  };
  return {
    __esModule: true,
    default: {
      execute: jest.fn(async (arg) => run(arg)),
      transaction: jest.fn(async (fn) => fn(async (sql, args = []) => run({ sql, args }))),
    },
    initDb: jest.fn().mockResolvedValue(true),
    __state: state,
  };
});

const mockChat = require("@/lib/deepseek").deepseekIntelligence.chat;
const { __state: state } = require("@/lib/db");
const { interpretPlanSheet, applyPlanImport } = require("@/services/ventures/planImport");
const {
  listExternalAssignees,
  resolveExternalAssignment,
  resolveExternalName,
  ASSIGNMENT_LEVELS,
} = require("@/models/ventureAssignments");

const SIX_NAMES = ["Amina", "David", "Chinedu", "Fatou", "Grace", "Alice"];

const trackerProposal = (names = SIX_NAMES) => ({
  journeys: [
    {
      name: "Growth engine",
      milestones: [
        {
          name: "MS01",
          tasks: names.map((name, index) => ({
            ref: `T${index + 1}`,
            title: `Work for ${name}`,
            owner_name: name,
            owner_cid: null,
            deliverables: [{ title: `Output for ${name}` }],
          })),
        },
      ],
    },
  ],
  unplaced: [],
});

beforeEach(() => {
  jest.clearAllMocks();
  state.queries = [];
  state.updateRows = null;
});

describe("RULE 3 — a name from a tracker creates NO person", () => {
  test("applying six unknown names writes no contact, no member and no person row", async () => {
    const out = await applyPlanImport({ dbId: "v-1", importId: "d-1", proposal: trackerProposal() });
    expect(out.error).toBeUndefined();

    const writes = state.queries.map((entry) => entry.sql).join(" \n ");
    expect(writes).not.toMatch(/INSERT INTO contacts/i);
    expect(writes).not.toMatch(/INSERT INTO venture_members/i);
    // The person table from the mistaken first cut is gone, not merely unused.
    expect(writes).not.toMatch(/venture_people/i);
    expect(writes).not.toMatch(/person_id/i);
  });

  test("the name is written as the ASSIGNMENT's name, and stays unresolved", async () => {
    await applyPlanImport({ dbId: "v-1", importId: "d-1", proposal: trackerProposal() });

    const taskInserts = state.queries.filter((entry) => /INSERT INTO venture_tasks/.test(entry.sql));
    expect(taskInserts).toHaveLength(6);
    for (const insert of taskInserts) {
      expect(insert.args[7]).toBe(null); // assigned_cid — no identity was invented
      expect(SIX_NAMES).toContain(insert.args[8]); // assigned_name — the tracker's own words
    }

    const deliverableInserts = state.queries.filter((entry) => /INSERT INTO venture_deliverables/.test(entry.sql));
    expect(deliverableInserts).toHaveLength(6);
    for (const insert of deliverableInserts) {
      expect(insert.args[4]).toBe(null); // assigned_cid
      expect(SIX_NAMES).toContain(insert.args[5]); // assigned_name survives to the deliverable
    }
  });
});

describe("RULE 1, 2, 6, 10 — the plan works with everyone off-platform", () => {
  test("applying is not blocked, and every name survives the round trip", async () => {
    const out = await applyPlanImport({ dbId: "v-1", importId: "d-1", proposal: trackerProposal() });
    expect(out.error).toBeUndefined();
    expect(out.counts.tasks).toBe(6);
    expect(out.counts.deliverables).toBe(6);
  });

  test("no invitation, no account flag and no membership is touched by assigning", async () => {
    await applyPlanImport({ dbId: "v-1", importId: "d-1", proposal: trackerProposal() });
    const writes = state.queries.map((entry) => entry.sql).join(" \n ");
    expect(writes).not.toMatch(/setup_token/i);
    expect(writes).not.toMatch(/invited_at/i);
    expect(writes).not.toMatch(/access_profile/i);
  });
});

describe("RULE 7 — the machine never guesses which person a name is", () => {
  test("an ambiguous name arrives as a name, with no contact chosen", async () => {
    mockChat.mockResolvedValue(
      JSON.stringify({
        journeys: [
          {
            name: "J",
            milestones: [
              { name: "M", tasks: [{ ref: "T1", title: "Legal filing", owner_name: "Alice", deliverables: [] }] },
            ],
          },
        ],
      }),
    );
    const out = await interpretPlanSheet({ sheets: [{ name: "Tracker", rows: [["ID"]] }] });
    const task = out.proposal.journeys[0].milestones[0].tasks[0];
    expect(task.owner_name).toBe("Alice");
    expect(task.owner_cid).toBe(null); // Alice Johnson or Alice Smith — a human decides
  });
});

describe("§5 option A and §9 — resolving keeps the name and the history", () => {
  test("one assignment gains the contact id and KEEPS its name", async () => {
    const out = await resolveExternalAssignment({
      dbId: "v-1",
      level: "task",
      entityId: "t-1",
      contactId: "c-amina",
      actorCid: "c-staff",
    });
    expect(out.resolved).toBe(1);

    const update = state.queries.find((entry) => /UPDATE venture_tasks/.test(entry.sql));
    expect(update.sql).toContain("assigned_cid = ?");
    // The name is NOT cleared: it is the record of what the tracker said.
    expect(update.sql).not.toMatch(/assigned_name\s*=/);
    expect(update.args[0]).toBe("c-amina");
  });

  test("a name on many rows resolves in ONE decision, across every level", async () => {
    const out = await resolveExternalName({ dbId: "v-1", displayName: "Amina", contactId: "c-amina" });
    // Two tasks came back for Amina; each level was asked, one at a time.
    expect(out.resolved).toBe(2);
    expect(out.counts.task).toBe(2);
    expect(out.resolved).toBe(Object.values(out.counts).reduce((sum, n) => sum + n, 0));

    // Every level is covered — not just tasks.
    const updatedTables = state.queries
      .filter((entry) => /assigned_cid = \?|owner_cid = \?/.test(entry.sql))
      .map((entry) => entry.sql.match(/UPDATE (venture_\w+)/)?.[1]);
    expect(new Set(updatedTables)).toEqual(
      new Set(Object.values(ASSIGNMENT_LEVELS).map((config) => config.table)),
    );
  });

  test("resolving promises nothing about membership or invitations", async () => {
    await resolveExternalName({ dbId: "v-1", displayName: "Amina", contactId: "c-amina" });
    const writes = state.queries.map((entry) => entry.sql).join(" \n ");
    expect(writes).not.toMatch(/venture_members/i);
    expect(writes).not.toMatch(/setup_token/i);
  });

  test("resolving an assignment that is not there is refused, not invented", async () => {
    state.updateRows = "none";
    const out = await resolveExternalAssignment({ dbId: "v-1", level: "task", entityId: "gone", contactId: "c-1" });
    expect(out.error).toBe("errors.notFound");
  });
});

describe("§6 — external assignments are reported, not treated as an error", () => {
  test("the census groups the remaining names with per-level counts", async () => {
    const found = await listExternalAssignees({ dbId: "v-1" });
    expect(found).toEqual([
      { name: "Amina", total: 9, levels: { task: 9 } },
      { name: "David", total: 3, levels: { task: 3 } },
    ]);
    // Nothing about a name with no account is phrased as a failure.
    for (const entry of found) expect(entry.name).toBeTruthy();
  });
});
