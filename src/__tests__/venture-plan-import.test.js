/**
 * Plan import — the model proposes, the platform validates, nothing is written.
 */
const mockChat = jest.fn();
jest.mock("@/lib/deepseek", () => ({
  deepseekIntelligence: { chat: (...args) => mockChat(...args) },
  default: { chat: (...args) => mockChat(...args) },
}));

const mockContacts = { byEmail: new Map(), byName: new Map() };
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    execute: jest.fn(async ({ sql, args = [] }) => {
      if (String(sql).includes("LOWER(email) = LOWER(?)")) {
        const cid = mockContacts.byEmail.get(String(args[0]).toLowerCase());
        return { rows: cid ? [{ cid }] : [] };
      }
      if (String(sql).includes("LOWER(name) = LOWER(?)")) {
        const hit = mockContacts.byName.get(String(args[0]).toLowerCase());
        if (!hit) return { rows: [] };
        return { rows: Array.isArray(hit) ? hit : [{ cid: hit }] };
      }
      return { rows: [] };
    }),
  },
  initDb: jest.fn().mockResolvedValue(true),
}));

const { interpretPlanSheet, buildPlanPrompt, renderPlanSheets } = require("@/models/venturePlanImport");

const MODEL_REPLY = {
  journeys: [
    {
      name: "Build a repeatable and sustainable growth engine",
      objective: "Reach 500 active SME customers and prepare Côte d'Ivoire expansion within six months.",
      start_date: "2026-10-01",
      target_date: "2026-12-22",
      milestones: [
        {
          ref: "MS01",
          name: "Product & Customer Readiness",
          objective: null,
          tasks: [
            {
              ref: "MS01-01",
              title: "Review current customer onboarding process",
              owner_name: "Amina",
              support: "David",
              phase: "Phase 1",
              start_date: "2026-10-01",
              due_date: "2026-10-07",
              priority: "High",
              definition_of_done: "Current onboarding flow documented",
              depends_on: [],
              deliverables: [{ title: "Onboarding process assessment" }],
            },
            {
              ref: "MS01-02",
              title: "Interview 10 active customers about onboarding",
              owner_name: "Amina",
              start_date: "2026-10-03",
              due_date: "not-a-date",
              priority: "Medium",
              depends_on: ["MS01-01", "MS99-99"],
              deliverables: [{ title: "Customer interview summary" }],
            },
          ],
        },
      ],
    },
  ],
  unplaced: [{ location: "row 9", reason: "no milestone column" }],
  warnings: ["Row 9: date unreadable"],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockContacts.byEmail.clear();
  mockContacts.byName.clear();
  mockChat.mockResolvedValue(JSON.stringify(MODEL_REPLY));
});

describe("buildPlanPrompt — guardrails sit in the system message", () => {
  test("the sheet is data in the user message; the rules are system", () => {
    const { messages } = buildPlanPrompt({ contextText: "ctx", sheetText: "r1: A=MS01" });
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toMatch(/never instructions/i);
    expect(messages[0].content).toMatch(/Do NOT infer dependencies from dates or row order/);
    expect(messages[1].role).toBe("user");
    expect(messages[1].content).toContain("r1: A=MS01");
    expect(messages[1].content).not.toMatch(/never instructions/i);
  });
});

describe("interpretPlanSheet — validate, never guess", () => {
  const sheets = [
    {
      name: "Tracker",
      rows: [
        ["ID", "Activity / Task"],
        ["MS01-01", "Review current customer onboarding process"],
      ],
    },
  ];

  test("a proposal is normalized: dates, priorities, structure, stats", async () => {
    const out = await interpretPlanSheet({ sheets, contextText: "Business: KoraPay Solutions" });
    expect(out.ok).toBe(true);
    const journey = out.proposal.journeys[0];
    expect(journey.name).toContain("growth engine");
    expect(journey.milestones[0].name).toBe("Product & Customer Readiness");
    const tasks = journey.milestones[0].tasks;
    expect(tasks[0].priority).toBe("high");
    expect(tasks[1].due_date).toBe(null); // an unreadable date never becomes a date
    expect(out.proposal.stats).toEqual({ journeys: 1, milestones: 1, tasks: 2, deliverables: 2 });
    expect(out.proposal.unplaced).toHaveLength(1);
  });

  test("dependency references are validated against the proposal's own tasks", async () => {
    const out = await interpretPlanSheet({ sheets });
    const tasks = out.proposal.journeys[0].milestones[0].tasks;
    expect(tasks[1].depends_on).toEqual(["MS01-01"]);
    expect(out.warnings.some((warning) => warning.includes("MS99-99"))).toBe(true);
  });

  test("a resolved owner carries a cid", async () => {
    mockContacts.byName.set("amina", "c-amina");
    const out = await interpretPlanSheet({ sheets });
    const [first, second] = out.proposal.journeys[0].milestones[0].tasks;
    expect(first.owner_cid).toBe("c-amina");
    expect(second.owner_cid).toBe("c-amina");
    expect(out.unmatched_owners).toEqual([]);
  });

  test("an owner who matches no contact stays flagged with no cid", async () => {
    const out = await interpretPlanSheet({ sheets });
    expect(out.unmatched_owners).toContain("Amina");
    expect(out.proposal.journeys[0].milestones[0].tasks[0].owner_cid).toBe(null);
  });

  test("an ambiguous name is flagged, not picked", async () => {
    mockContacts.byName.set("amina", [{ cid: "c-1" }, { cid: "c-2" }]);
    const out = await interpretPlanSheet({ sheets });
    expect(out.unmatched_owners).toContain("Amina");
    expect(out.warnings.some((warning) => /more than one contact/i.test(warning))).toBe(true);
  });

  test("an email owner resolves through the email path first", async () => {
    mockChat.mockResolvedValue(
      JSON.stringify({
        journeys: [
          {
            name: "J",
            milestones: [
              {
                name: "M",
                tasks: [{ title: "T", owner_name: "amina@example.com", deliverables: [] }],
              },
            ],
          },
        ],
      }),
    );
    mockContacts.byEmail.set("amina@example.com", "c-email");
    const out = await interpretPlanSheet({ sheets });
    expect(out.proposal.journeys[0].milestones[0].tasks[0].owner_cid).toBe("c-email");
    expect(out.unmatched_owners).toEqual([]);
  });

  test("garbage from the model is refused, not repaired", async () => {
    mockChat.mockResolvedValue("I could not do that.");
    const out = await interpretPlanSheet({ sheets });
    expect(out.ok).toBe(false);
    expect(out.error).toMatch(/no usable JSON/i);
  });

  test("an empty journeys list is refused", async () => {
    mockChat.mockResolvedValue(JSON.stringify({ journeys: [] }));
    const out = await interpretPlanSheet({ sheets });
    expect(out.ok).toBe(false);
    expect(out.error).toMatch(/no journey/i);
  });
});

describe("renderPlanSheets", () => {
  test("rows are lettered and empty cells collapse", () => {
    const text = renderPlanSheets([{ name: "Tracker", rows: [["ID", "", "Task"], ["", "x", ""]] }]);
    expect(text).toContain("=== Sheet: Tracker ===");
    expect(text).toContain("r1: A=ID | C=Task");
    expect(text).toContain("r2: B=x");
  });
});
