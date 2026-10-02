/**
 * Plan import — the model proposes, the platform validates, nothing is written.
 */
const mockChat = jest.fn();
/** What the provider would report for the answer: "length" means CUT OFF. */
let mockFinishReason = "stop";
jest.mock("@/lib/deepseek", () => ({
  deepseekIntelligence: {
    chat: (...args) => mockChat(...args),
    chatDetailed: async (...args) => ({
      content: await mockChat(...args),
      finishReason: mockFinishReason,
      truncated: mockFinishReason === "length",
    }),
  },
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

const {
  interpretPlanSheet,
  buildPlanPrompt,
  renderPlanSheets,
  PLAN_ANSWER_TOKENS,
  PLAN_CHUNK_ROWS,
  chunkPlanRows,
  mergePlanParts,
} = require("@/services/ventures/planImport");

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
  mockFinishReason = "stop";
  mockChat.mockResolvedValue(JSON.stringify(MODEL_REPLY));
});

describe("chunkPlanRows — one part when it fits, several when it does not", () => {
  const rows = (n) => Array.from({ length: n }, (_, i) => [`row ${i}`]);

  test("a sheet that fits stays ONE part", () => {
    expect(chunkPlanRows(rows(PLAN_CHUNK_ROWS))).toHaveLength(1);
    expect(chunkPlanRows(rows(5))[0].start).toBe(0);
  });

  test("a long sheet is cut into parts that carry their place in the sheet", () => {
    const parts = chunkPlanRows(rows(PLAN_CHUNK_ROWS * 3));
    expect(parts.length).toBeGreaterThan(1);
    expect(parts[0].start).toBe(0);
    // Each later part starts after the first — never at 0, so row labels stay global.
    for (const part of parts.slice(1)) expect(part.start).toBeGreaterThan(0);
  });

  test("consecutive parts OVERLAP, so a group split across the cut is still recognisable", () => {
    const parts = chunkPlanRows(rows(PLAN_CHUNK_ROWS * 2));
    expect(parts[1].start).toBeLessThan(parts[0].rows.length);
  });

  test("nothing to read is one empty part, not none", () => {
    expect(chunkPlanRows([])).toHaveLength(1);
  });
});

describe("mergePlanParts — the parts' answers become ONE proposal", () => {
  const part = (tasks) => ({
    journeys: [{ name: "Market Readiness", milestones: [{ name: "GTM", tasks }] }],
  });

  test("the same journey and milestone from two parts are ONE journey and ONE milestone", () => {
    const merged = mergePlanParts([part([{ ref: "r1", title: "A" }]), part([{ ref: "r9", title: "B" }])]);
    expect(merged.journeys).toHaveLength(1);
    expect(merged.journeys[0].milestones).toHaveLength(1);
    expect(merged.journeys[0].milestones[0].tasks).toHaveLength(2);
  });

  test("the OVERLAP is dropped: a row seen twice is kept once", () => {
    const shared = { ref: "r7", title: "Arrange meetings" };
    const merged = mergePlanParts([part([shared]), part([shared, { ref: "r9", title: "B" }])]);
    expect(merged.journeys[0].milestones[0].tasks.map((task) => task.ref)).toEqual(["r7", "r9"]);
  });

  test("with no ref, a task is identified by its title and owner", () => {
    const merged = mergePlanParts([
      part([{ title: "Legal filing", owner_name: "Alice" }]),
      part([{ title: "Legal filing", owner_name: "Alice" }, { title: "Legal filing", owner_name: "David" }]),
    ]);
    expect(merged.journeys[0].milestones[0].tasks).toHaveLength(2);
  });

  test("the FIRST value wins; a later part may only fill a gap", () => {
    const merged = mergePlanParts([
      { journeys: [{ name: "J", objective: "first", milestones: [] }] },
      { journeys: [{ name: "J", objective: "second", target_date: "2026-12-01", milestones: [] }] },
    ]);
    expect(merged.journeys[0].objective).toBe("first");
    expect(merged.journeys[0].target_date).toBe("2026-12-01");
  });

  test("refs_derived survives if ANY part reported it", () => {
    expect(mergePlanParts([{ journeys: [] }, { refs_derived: true, journeys: [] }]).refs_derived).toBe(true);
  });
});

describe("a tracker too long for one answer is read in PARTS", () => {
  const longSheet = (count) => ({
    name: "Tracker",
    rows: [
      ["ID", "Activity"],
      ...Array.from({ length: count }, (_, index) => [`MS01-${index + 1}`, `Task ${index + 1}`]),
    ],
  });

  test("a sheet that fits is ONE call, exactly as it always was", async () => {
    const out = await interpretPlanSheet({
      sheets: [{ name: "Tracker", rows: [["ID", "Activity"], ["T1", "Do the thing"]] }],
      sheetName: "Tracker",
    });
    expect(out.ok).toBe(true);
    expect(mockChat).toHaveBeenCalledTimes(1);
  });

  test("a long sheet is read part by part, and the parts become ONE proposal", async () => {
    const out = await interpretPlanSheet({ sheets: [longSheet(PLAN_CHUNK_ROWS * 3)], sheetName: "Tracker" });
    expect(out.ok).toBe(true);
    expect(mockChat.mock.calls.length).toBeGreaterThan(1);
    // The mock answers every part identically — the merge must collapse the
    // repeats into one journey, one milestone and one copy of each task.
    expect(out.proposal.journeys).toHaveLength(1);
    expect(out.proposal.journeys[0].milestones).toHaveLength(1);
    expect(out.proposal.journeys[0].milestones[0].tasks).toHaveLength(2);
  });

  test("every part is told it is a part, so it does not invent the rest", async () => {
    await interpretPlanSheet({ sheets: [longSheet(PLAN_CHUNK_ROWS * 3)], sheetName: "Tracker" });
    const userMessages = mockChat.mock.calls.map(
      (call) => call[0].find((message) => message.role === "user").content,
    );
    expect(userMessages.length).toBeGreaterThan(1);
    for (const content of userMessages) {
      expect(content).toMatch(/PART \d+ OF \d+/);
      expect(content).toMatch(/Do NOT invent rows/);
    }
  });

  test("a sheet with NO named plan sheet is still one call — the old path is untouched", async () => {
    await interpretPlanSheet({ sheets: [longSheet(PLAN_CHUNK_ROWS * 3)] });
    expect(mockChat).toHaveBeenCalledTimes(1);
  });

  test("row labels keep their place in the whole sheet across parts", () => {
    const parts = chunkPlanRows(longSheet(PLAN_CHUNK_ROWS * 3).rows);
    const second = renderPlanSheets([{ name: "Tracker", rows: parts[1].rows }], "Tracker", parts[1].start);
    const firstLabel = Number(/r(\d+):/.exec(second)[1]);
    // The second part's first row is NOT numbered from 1 — it continues after
    // the rows already shown, so a dependency can name it from anywhere.
    expect(firstLabel).toBeGreaterThan(1);
  });
});

describe("a bad answer says WHICH KIND of bad it is", () => {
  const sheets = [{ name: "Tracker", rows: [["ID", "Activity"]] }];

  test("an answer CUT OFF at the length ceiling reports truncation, not bad JSON", async () => {
    // This is the distinction that was thrown away. A truncated reply is
    // unfinished, not malformed — and it needs a different answer from the
    // person waiting: split the file, rather than try again.
    mockFinishReason = "length";
    // A real cut-off answer: some objects closed, the ones wrapping them not.
    mockChat.mockResolvedValue(
      '{"refs_derived":false,"journeys":[{"name":"J","milestones":[{"ref":"MS01","name":"M","tasks":[{"ref":"T1","title":"Conduct market research","deliverables":[]},{"ref":"T2","title":"Identify target partners',
    );
    const out = await interpretPlanSheet({ sheets });
    expect(out.ok).toBe(false);
    expect(out.error_key).toBe("venture.planImport.answerTruncated");
    expect(out.error_params).toEqual({ limit: PLAN_ANSWER_TOKENS });
    expect(out.error).toMatch(/ceiling/);
  });

  test("an answer that is simply unreadable reports invalid JSON", async () => {
    mockFinishReason = "stop";
    mockChat.mockResolvedValue('{"journeys": [{"name": "J",}]}'); // a trailing comma
    const out = await interpretPlanSheet({ sheets });
    expect(out.ok).toBe(false);
    expect(out.error_key).toBe("venture.planImport.answerInvalid");
  });

  test("an answer with no JSON object at all says so", async () => {
    mockFinishReason = "stop";
    mockChat.mockResolvedValue("I could not do that.");
    const out = await interpretPlanSheet({ sheets });
    expect(out.ok).toBe(false);
    expect(out.error_key).toBe("venture.planImport.answerUnusable");
  });

  test("a good answer carries no error key at all", async () => {
    const out = await interpretPlanSheet({ sheets });
    expect(out.ok).toBe(true);
    expect(out.error_key).toBeUndefined();
  });
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

  test("the chosen sheet is named in the prompt and the rule is in the system message", () => {
    const { messages } = buildPlanPrompt({ sheetText: "sheet text", sheetName: "Tracker" });
    expect(messages[1].content).toContain("ACTIVITY PLAN SHEET:");
    expect(messages[1].content).toContain('"Tracker"');
    expect(messages[1].content).toMatch(/never map work from it/i);
    expect(messages[0].content).toMatch(/AUTHORITATIVE ACTIVITY PLAN/);
    expect(messages[0].content).toMatch(/never merge two sheets/i);
  });

  test("without a chosen sheet the prompt says so instead of implying one", () => {
    const { messages } = buildPlanPrompt({ sheetText: "sheet text" });
    expect(messages[1].content).toMatch(/not stated/i);
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

  test("one sheet is authoritative and the others say they are reference only", () => {
    const text = renderPlanSheets(
      [
        { name: "Dashboard", rows: [["Total", "12"]] },
        { name: "Tracker", rows: [["ID", "Activity"]] },
        { name: "Reference", rows: [["Note", "x"]] },
      ],
      "Tracker",
    );
    // Segment by header so the assertion names the sheet it is talking about.
    const segment = (name) =>
      text.split("=== Sheet: ").find((part) => part.startsWith(`${name} `)) || "";
    expect(text).not.toBe("");
    expect(segment("Dashboard")).toMatch(/reference only/i);
    expect(segment("Tracker")).toMatch(/AUTHORITATIVE ACTIVITY PLAN/);
    expect(segment("Reference")).toMatch(/reference only/i);
    // Exactly one sheet is marked as the plan.
    expect(text.match(/AUTHORITATIVE ACTIVITY PLAN/g)).toHaveLength(1);
    // The reference tabs are still readable — they are how the plan is understood.
    expect(segment("Reference")).toContain("Note");
  });

  test("matching the authoritative name ignores case", () => {
    const text = renderPlanSheets([{ name: "TRACKER", rows: [["A"]] }], "tracker");
    expect(text).toMatch(/AUTHORITATIVE ACTIVITY PLAN/);
  });

  test("with no name given, nothing is marked — the sheet arrives as it is", () => {
    const text = renderPlanSheets([{ name: "Tracker", rows: [["ID"]] }]);
    expect(text).not.toMatch(/AUTHORITATIVE/);
    expect(text).not.toMatch(/reference only/i);
  });
});

describe("interpretPlanSheet — the sheet the route chose reaches the model", () => {
  const sheets = [
    { name: "Dashboard", rows: [["Activity count", "99"]] },
    { name: "Tracker", rows: [["ID", "Activity"], ["MS01-01", "Do the thing"]] },
  ];

  test("the plan sheet is marked and named in the call, the other is reference", async () => {
    await interpretPlanSheet({ sheets, sheetName: "Tracker" });
    const [messages] = mockChat.mock.calls[0];
    const userMessage = messages.find((message) => message.role === "user").content;
    expect(userMessage).toContain("ACTIVITY PLAN SHEET:");
    expect(userMessage).toContain('"Tracker"');
    expect(userMessage).toMatch(/Sheet: Dashboard\s+\(reference only/);
    expect(userMessage).toMatch(/Sheet: Tracker\s+<<< AUTHORITATIVE ACTIVITY PLAN/);
  });
});
