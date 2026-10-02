/**
 * PHASE 4 — the change log, and reassessment.
 *
 * Two promises to keep. The change log must SAY WHAT MOVED (so a Date and the
 * string the browser sent are never reported as a change) and must never break a
 * save it is describing. A reassessment must be TOLD what already exists, or the
 * analyst proposes the same programme twice.
 */
const mockChat = jest.fn();
jest.mock("@/lib/deepseek", () => ({
  deepseekIntelligence: {
    chat: (...args) => mockChat(...args),
    chatDetailed: async (...args) => ({ content: await mockChat(...args), finishReason: "stop", truncated: false }),
  },
  default: { chat: (...args) => mockChat(...args) },
}));

jest.mock("@/lib/ventures", () => ({ addDependency: jest.fn() }));

jest.mock("@/lib/db", () => {
  const state = { executeImpl: async () => ({ rows: [] }), calls: [] };
  return {
    __esModule: true,
    default: {
      execute: jest.fn(async (arg) => {
        state.calls.push(arg);
        return state.executeImpl(arg);
      }),
      transaction: jest.fn(async (fn) => fn(async () => ({ rows: [] }))),
    },
    initDb: jest.fn().mockResolvedValue(true),
    __state: state,
  };
});

const { __state: state } = require("@/lib/db");
const { normaliseChangeValue, diffFields, recordVentureChange, listVentureChanges } = require("@/models/ventureChangeLog");
const { buildExistingProgramme, interpretPlanSheet, buildPlanPrompt } = require("@/services/ventures/planImport");

beforeEach(() => {
  jest.clearAllMocks();
  state.calls = [];
  state.executeImpl = async () => ({ rows: [] });
});

describe("normaliseChangeValue — one comparable form", () => {
  test("a date column and the day the browser sent are the same value", () => {
    const fromDatabase = new Date(2026, 11, 22, 0, 0, 0);
    expect(normaliseChangeValue(fromDatabase)).toBe("2026-12-22");
    expect(normaliseChangeValue("2026-12-22")).toBe("2026-12-22");
    expect(normaliseChangeValue("2026-12-22T00:00:00.000Z")).toBe("2026-12-22");
  });

  test("nothing and emptiness are the same nothing", () => {
    expect(normaliseChangeValue(null)).toBe(null);
    expect(normaliseChangeValue(undefined)).toBe(null);
    expect(normaliseChangeValue("   ")).toBe(null);
  });

  test("real text survives", () => {
    expect(normaliseChangeValue("Go-to-Market System")).toBe("Go-to-Market System");
    expect(normaliseChangeValue(42)).toBe("42");
  });
});

describe("diffFields — only what moved", () => {
  test("saving an unchanged date reports nothing", () => {
    const before = { target_date: new Date(2026, 11, 22), title: "Readiness" };
    expect(diffFields(before, { target_date: "2026-12-22" }, ["target_date", "title"])).toEqual([]);
  });

  test("a real change carries what it was and what it became", () => {
    const changes = diffFields({ target_date: null }, { target_date: "2026-11-01" }, ["target_date"]);
    expect(changes).toEqual([{ field: "target_date", from: null, to: "2026-11-01" }]);
  });

  test("a field that was not sent is not a change", () => {
    expect(diffFields({ title: "A", description: "D" }, { description: "D" }, ["title", "description"])).toEqual([]);
  });
});

describe("recordVentureChange — never breaks the thing it describes", () => {
  test("one row per changed field", async () => {
    await recordVentureChange({
      dbId: "v-1",
      entityType: "milestone",
      entityId: "m-1",
      entityLabel: "Readiness",
      action: "updated",
      actorCid: "c-1",
      changes: [
        { field: "target_date", from: null, to: "2026-11-01" },
        { field: "priority", from: "low", to: "high" },
      ],
    });
    expect(state.calls).toHaveLength(2);
    expect(state.calls[0].args[5]).toBe("target_date");
    expect(state.calls[1].args[6]).toBe("low");
    expect(state.calls[1].args[7]).toBe("high");
  });

  test("an action with nothing to compare writes one row", async () => {
    await recordVentureChange({ dbId: "v-1", entityType: "journey", entityId: "j-1", action: "activated" });
    expect(state.calls).toHaveLength(1);
    expect(state.calls[0].args[4]).toBe("activated");
    expect(state.calls[0].args[5]).toBe(null);
  });

  test("an unknown entity type is refused rather than stored", async () => {
    await recordVentureChange({ dbId: "v-1", entityType: "spaceship", entityId: "x", action: "updated" });
    expect(state.calls).toHaveLength(0);
  });

  test("a failing write is swallowed — the change already happened", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    state.executeImpl = async () => {
      throw new Error("connection lost");
    };
    await expect(
      recordVentureChange({ dbId: "v-1", entityType: "journey", entityId: "j-1", action: "updated" }),
    ).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("listVentureChanges", () => {
  test("narrowing by entity keeps the scope and the cap", async () => {
    state.executeImpl = async () => ({ rows: [{ id: "r1" }] });
    const rows = await listVentureChanges({ dbId: "v-1", entityType: "milestone", entityId: "m-1", limit: 9999 });
    expect(rows).toEqual([{ id: "r1" }]);
    const { sql, args } = state.calls[0];
    expect(sql).toContain("venture_id = ?");
    expect(sql).toContain("entity_type = ?");
    expect(sql).toContain("entity_id = ?");
    expect(args).toEqual(["v-1", "milestone", "m-1", 500]); // capped
  });

  test("no venture is no history, not a query", async () => {
    expect(await listVentureChanges({ dbId: null })).toEqual([]);
    expect(state.calls).toHaveLength(0);
  });
});

describe("buildExistingProgramme — what a reassessment must be told", () => {
  test("a Venture with no programme says nothing", async () => {
    const out = await buildExistingProgramme({ dbId: "v-1" });
    expect(out.text).toBe("");
    expect(out.counts).toEqual({ journeys: 0, milestones: 0, tasks: 0 });
  });

  test("journeys, milestones and task counts come back as compact lines", async () => {
    state.executeImpl = async ({ sql }) => {
      if (String(sql).includes("FROM venture_journey_stages")) {
        return { rows: [{ id: "j-1", name: "Market Readiness", status: "active" }] };
      }
      if (String(sql).includes("FROM venture_milestones")) {
        return {
          rows: [
            { journey_stage_id: "j-1", title: "Target customer defined", status: "completed", task_count: "4" },
            { journey_stage_id: "j-2", title: "Someone else's", status: "upcoming", task_count: "9" },
          ],
        };
      }
      return { rows: [] };
    };

    const out = await buildExistingProgramme({ dbId: "v-1" });
    expect(out.text).toContain("JOURNEY: Market Readiness [active]");
    expect(out.text).toContain("MILESTONE: Target customer defined [completed] — 4 tasks");
    // A milestone belonging to another journey is not listed under this one.
    expect(out.text).not.toContain("Someone else's");
    expect(out.counts).toEqual({ journeys: 1, milestones: 2, tasks: 4 });
  });
});

describe("reassessment reaches the analyst", () => {
  test("the existing programme is in the user message, and the rules are system", () => {
    const { messages } = buildPlanPrompt({
      sheetText: "r1: A=MS01",
      existingProgrammeText: "JOURNEY: Market Readiness [active]",
    });
    expect(messages[0].content).toMatch(/Never propose it again/i);
    expect(messages[1].content).toContain("PROGRAMME ALREADY IN THE PLATFORM");
    expect(messages[1].content).toContain("JOURNEY: Market Readiness [active]");
  });

  test("a tracker that adds nothing new is a REAL answer, not a failure", async () => {
    mockChat.mockResolvedValue(
      JSON.stringify({
        journeys: [],
        already_covered: [{ sheet_item: "Market study", existing: "MS01 — Market Readiness" }],
        notes: "Everything here already exists.",
      }),
    );
    const out = await interpretPlanSheet({
      sheets: [{ name: "Tracker", rows: [["ID", "Task"]] }],
      existingProgrammeText: "JOURNEY: Market Readiness [active]",
    });
    expect(out.ok).toBe(true);
    expect(out.proposal.journeys).toEqual([]);
    expect(out.proposal.already_covered).toHaveLength(1);
  });

  test("an empty answer with no explanation is still refused", async () => {
    mockChat.mockResolvedValue(JSON.stringify({ journeys: [] }));
    const out = await interpretPlanSheet({ sheets: [{ name: "Tracker", rows: [["ID"]] }] });
    expect(out.ok).toBe(false);
    expect(out.error).toMatch(/no journey/i);
  });
});
