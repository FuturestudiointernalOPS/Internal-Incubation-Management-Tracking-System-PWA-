/**
 * Milestone derivation — a Tracker row is an ACTIVITY, never a milestone.
 *
 * These tests pin the RULES the analyst is given, because that is where the
 * defect lived: the prompt used to say that a column of "MS01"-style ids
 * "groups tasks into milestones", so a ten-row tracker became ten milestones,
 * each named after its pillar. The id column is the ACTIVITY's reference, and a
 * milestone is a group of activities that share one objective.
 *
 * The behaviour itself is verified against the real trackers; what is locked
 * here is the instruction, the explicit-milestone precedence, and the fact that
 * a split pass still carries the workbook's own milestone list.
 */
const mockChat = jest.fn();
jest.mock("@/lib/deepseek", () => ({
  deepseekIntelligence: {
    chat: (...args) => mockChat(...args),
    chatDetailed: async (...args) => ({
      content: await mockChat(...args),
      finishReason: "stop",
      truncated: false,
    }),
  },
  default: { chat: (...args) => mockChat(...args) },
}));

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [] })) },
  initDb: jest.fn().mockResolvedValue(true),
}));

const {
  buildPlanPrompt,
  isMilestoneSheet,
  renderPlanSheets,
  interpretPlanSheet,
  mergePlanParts,
  dedupeTasksByRef,
} = require("@/services/ventures/planImport");
const { normalizeJourneys } = require("@/services/ventures/planImport/proposal");

const systemPrompt = () => buildPlanPrompt({}).messages[0].content;

/** The old, wrong rule — its presence is the bug. */
const OLD_RULE = "A column of milestone-level identifiers";

describe("the analyst is told a row is an activity", () => {
  test("the instruction that turned an id column into milestones is gone", () => {
    expect(systemPrompt()).not.toContain(OLD_RULE);
  });

  test("the id column is named as the activity's own reference", () => {
    const prompt = systemPrompt();
    expect(prompt).toContain("THE ID COLUMN IS THE ACTIVITY'S OWN REFERENCE");
    expect(prompt).toMatch(/"MS" does not stand for milestone/);
  });

  test("one row per milestone is forbidden in as many words", () => {
    expect(systemPrompt()).toContain("ONE ROW NEVER MAKES ONE MILESTONE");
  });

  test("a milestone is defined as a group sharing one objective, not a row count", () => {
    const prompt = systemPrompt();
    expect(prompt).toContain("HOW MILESTONES ARE FORMED");
    expect(prompt).toMatch(/never by a row count/);
    expect(prompt).toMatch(/There is no fixed size/);
  });

  test("the grouping signals are given in order, service line first", () => {
    const prompt = systemPrompt();
    const serviceLine = prompt.indexOf("Offer service line");
    const pillar = prompt.indexOf("2. Pillar");
    expect(serviceLine).toBeGreaterThan(-1);
    expect(pillar).toBeGreaterThan(serviceLine);
  });

  test("it is told to move on when the service line groups nothing", () => {
    // KoraHome's service lines are all distinct — following that signal blindly
    // would produce one milestone per row again, which is the same defect.
    expect(systemPrompt()).toMatch(/every row carries a DIFFERENT service line, it groups nothing/);
  });

  test("names must describe the outcome, never the reference", () => {
    const prompt = systemPrompt();
    expect(prompt).toContain("NAME the milestone for the outcome");
    expect(prompt).toMatch(/Never: "MS-01"/);
  });

  test("an honest failure is preferred to an invented milestone", () => {
    const prompt = systemPrompt();
    expect(prompt).toMatch(/do NOT invent one/);
    expect(prompt).toContain('"requires_review": true');
  });
});

describe("explicit milestones win", () => {
  test("the rule is stated, with the activity sheet kept as the only source of tasks", () => {
    const prompt = systemPrompt();
    expect(prompt).toContain("EXPLICIT MILESTONES TAKE PRECEDENCE");
    expect(prompt).toMatch(/ONLY source of tasks/);
  });

  test("a stated membership is followed, an unstated one is not guessed", () => {
    const prompt = systemPrompt();
    expect(prompt).toMatch(/place exactly those activities there/);
    expect(prompt).toMatch(/DO NOT GUESS and never spread the work evenly/);
  });

  test("a milestone list is recognised by its name", () => {
    expect(isMilestoneSheet("Milestones")).toBe(true);
    expect(isMilestoneSheet("Milestones and day-90 targets")).toBe(true);
    expect(isMilestoneSheet("Checkpoints")).toBe(true);
    expect(isMilestoneSheet("Tracker")).toBe(false);
    expect(isMilestoneSheet("Owner load")).toBe(false);
    expect(isMilestoneSheet("Reference")).toBe(false);
    expect(isMilestoneSheet("Dashboard")).toBe(false);
    expect(isMilestoneSheet(null)).toBe(false);
  });

  test("the rendered sheet says what it is, instead of 'reference only'", () => {
    const text = renderPlanSheets(
      [
        { name: "Tracker", rows: [["ID", "Activity"], ["MS-01", "Do the work"]] },
        { name: "Milestones", rows: [["Checkpoint", "Milestone"], ["Day 14", "Foundation gates cleared"]] },
      ],
      "Tracker",
    );

    expect(text).toContain("AUTHORITATIVE ACTIVITY PLAN");
    expect(text).toContain("EXPLICIT MILESTONE LIST");
    // The milestone sheet must NOT be dismissed as an ordinary reference tab.
    const milestoneLine = text.split("\n").find((line) => line.includes("Sheet: Milestones"));
    expect(milestoneLine).not.toContain("reference only");
  });

  test("a workbook with no milestone list says so, and asks for derived ones", () => {
    const withList = buildPlanPrompt({ sheetName: "Tracker", milestoneSheetNames: ["Milestones"] });
    const withoutList = buildPlanPrompt({ sheetName: "Tracker" });

    expect(withList.messages[1].content).toContain("EXPLICIT MILESTONE LIST");
    expect(withList.messages[1].content).toContain('"Milestones"');
    expect(withList.messages[1].content).toMatch(/THESE ARE THE MILESTONES/);
    expect(withoutList.messages[1].content).toMatch(/none in this workbook — derive the milestones/);
  });
});

describe("a split pass still carries the workbook's own milestones", () => {
  const MILESTONE_ROWS = [
    ["Checkpoint", "Date", "Milestone", "What must be true"],
    ["Day 0", "2026-09-23", "Programme start", "Plan live"],
    ["Day 14", "2026-10-07", "Foundation gates cleared", "LG-01 legal status audit closed"],
    ["Day 45", "2026-11-07", "Market activation", "Corporate-access conversations underway"],
  ];
  // 48 activity rows — PSPlytics' shape, which is what forces the split.
  const TRACKER_ROWS = [["ID", "Pillar", "Offer service line", "Activity", "Output / deliverable"]];
  for (let index = 1; index <= 48; index += 1) {
    const id = `MS-${String(index).padStart(2, "0")}`;
    TRACKER_ROWS.push([id, "Market Study", "Market Research", `Activity ${index}`, `Output ${index}`]);
  }

  const PART_REPLY = JSON.stringify({
    journeys: [
      {
        name: "PSPlytics 90-day",
        milestones: [{ name: "Foundation gates cleared", tasks: [{ ref: "MS-01", title: "Activity 1" }] }],
      },
    ],
  });

  test("every part is shown the milestone sheet, and no other reference sheet", async () => {
    mockChat.mockReset();
    mockChat.mockResolvedValue(PART_REPLY);

    await interpretPlanSheet({
      sheets: [
        { name: "Tracker", rows: TRACKER_ROWS },
        { name: "Milestones", rows: MILESTONE_ROWS },
        { name: "Owner load", rows: [["Owner", "Activities"], ["Godwin", "8"]] },
      ],
      sheetName: "Tracker",
    });

    const calls = mockChat.mock.calls.map((call) => JSON.stringify(call[0]));
    expect(calls.length).toBeGreaterThan(1);
    for (const content of calls) {
      // The milestones travel with EVERY part…
      expect(content).toContain("EXPLICIT MILESTONE LIST");
      expect(content).toContain("Foundation gates cleared");
      // …while a plain reference tab still does not.
      expect(content).not.toContain("Owner load");
    }
  });
});

describe("an invented empty milestone does not reach the roadmap", () => {
  const REPLY = JSON.stringify({
    journeys: [
      {
        name: "Programme",
        milestones: [
          { name: "Market Validation", tasks: [{ ref: "MS-01", title: "One" }] },
          { name: "Go-to-Market", tasks: [] },
        ],
      },
    ],
  });

  test("a derived milestone holding nothing is removed and reported", async () => {
    mockChat.mockReset();
    mockChat.mockResolvedValue(REPLY);

    const result = await interpretPlanSheet({
      sheets: [{ name: "Tracker", rows: [["ID", "Activity"], ["MS-01", "One"]] }],
      sheetName: "Tracker",
    });

    const names = result.proposal.journeys[0].milestones.map((milestone) => milestone.name);
    expect(names).toEqual(["Market Validation"]);
    expect(result.warnings.join(" ")).toMatch(/milestone\(s\) the analyst named but left empty/);
  });

  test("an EXPLICIT milestone may legitimately be empty and is kept", async () => {
    mockChat.mockReset();
    mockChat.mockResolvedValue(REPLY);

    const result = await interpretPlanSheet({
      sheets: [
        { name: "Tracker", rows: [["ID", "Activity"], ["MS-01", "One"]] },
        { name: "Milestones", rows: [["Checkpoint", "Milestone"], ["Day 0", "Programme start"]] },
      ],
      sheetName: "Tracker",
    });

    // The workbook stated this checkpoint; an empty one is a finding about the
    // programme, not a heading the analyst invented.
    const names = result.proposal.journeys[0].milestones.map((milestone) => milestone.name);
    expect(names).toContain("Go-to-Market");
    expect(result.warnings.join(" ")).not.toMatch(/left empty/);
  });
});

describe("a sheet read in parts is one programme, not one per spelling", () => {
  const parts = [
    { journeys: [{ name: "PSPlytics 90-Day Programme", milestones: [{ name: "Market activation", tasks: [{ ref: "MS-01", title: "One" }] }] }] },
    { journeys: [{ name: "PSPlytics 90-Day Plan", milestones: [{ name: "Market activation", tasks: [{ ref: "MS-02", title: "Two" }] }] }] },
    { journeys: [{ name: "PSPlytics Master Tracker", milestones: [{ name: "Recovery evidence", tasks: [{ ref: "MS-03", title: "Three" }] }] }] },
  ];

  test("folding keeps one journey and merges its milestones by name", () => {
    const warnings = [];
    const merged = mergePlanParts(parts, { foldJourneys: true });

    expect(merged.journeys).toHaveLength(1);
    expect(merged.journeys[0].name).toBe("PSPlytics 90-Day Programme");
    expect(merged.journeys[0].milestones.map((milestone) => milestone.name)).toEqual([
      "Market activation",
      "Recovery evidence",
    ]);
    // The same checkpoint described twice is ONE milestone holding both tasks.
    expect(merged.journeys[0].milestones[0].tasks.map((task) => task.ref)).toEqual(["MS-01", "MS-02"]);
    void warnings;
  });

  test("without folding, the spellings stay separate — the caller decides", () => {
    const merged = mergePlanParts(parts);
    // One journey PER SPELLING — exactly the duplication folding exists to
    // prevent, and why the caller folds only when every part read one programme.
    expect(merged.journeys).toHaveLength(3);
  });

  test("a single journey is left exactly as it was", () => {
    const merged = mergePlanParts([parts[0]], { foldJourneys: true });
    expect(merged.journeys).toHaveLength(1);
    expect(merged.journeys[0].name).toBe("PSPlytics 90-Day Programme");
  });

  test("the fold is reported, not silent", () => {
    const merged = mergePlanParts(parts, { foldJourneys: true });
    expect(merged.warnings.join(" ")).toMatch(/named the programme 3 different ways/);
  });
});

describe("a split pass does not lose rows", () => {
  test("the part instruction forbids skipping a row it expects to meet again", () => {
    const built = buildPlanPrompt({
      sheetName: "Tracker",
      part: { index: 1, total: 4 },
    });
    const user = built.messages[1].content;

    expect(user).toContain("PART 1 OF 4");
    expect(user).toContain("Map EVERY activity row shown below");
    expect(user).toMatch(/SKIPPING a row because you expect to meet it again LOSES that activity/);
    // The old wording is what let a part drop rows in the gap between parts.
    expect(user).not.toContain("do NOT restate work you expect to see elsewhere");
  });

  test("work the analyst could not place is reported as NOT created", async () => {
    mockChat.mockResolvedValue(
      JSON.stringify({
        journeys: [{ name: "P", milestones: [{ name: "M", tasks: [{ ref: "MS-01", title: "One" }] }] }],
        unplaced: [{ location: "Tracker rows MS-04 to MS-12", reason: "not in this part" }],
      }),
    );

    const result = await interpretPlanSheet({
      sheets: [{ name: "Tracker", rows: [ ["ID", "Activity"], ["MS-01", "One"] ] }],
      sheetName: "Tracker",
    });

    expect(result.ok).toBe(true);
    expect(result.warnings.join(" ")).toMatch(/were NOT turned into work/);
    expect(result.warnings.join(" ")).toContain("MS-04 to MS-12");
  });
});

describe("one tracker row stays one task across a split", () => {
  test("a row read under two different milestones is kept once, under the first", () => {
    const journeys = [
      {
        milestones: [
          { name: "Market activation", tasks: [{ ref: "MS-11", title: "One" }, { ref: "MS-12", title: "Two" }] },
          { name: "Review bucket", tasks: [{ ref: "MS-11", title: "One" }, { ref: "MS-13", title: "Three" }] },
        ],
      },
    ];
    const warnings = [];

    dedupeTasksByRef(journeys, warnings, false);

    expect(journeys[0].milestones[0].tasks.map((task) => task.ref)).toEqual(["MS-11", "MS-12"]);
    expect(journeys[0].milestones[1].tasks.map((task) => task.ref)).toEqual(["MS-13"]);
    // The drop is REPORTED, never silent.
    expect(warnings[0]).toContain("MS-11");
  });

  test("a row repeated under the SAME milestone is not reported as a move", () => {
    const journeys = [
      { milestones: [{ name: "Only", tasks: [{ ref: "MS-01", title: "One" }] }] },
    ];
    const warnings = [];

    dedupeTasksByRef(journeys, warnings, false);

    expect(warnings).toHaveLength(0);
  });

  test("derived references are left alone — there the same ref can name different rows", () => {
    const journeys = [
      {
        milestones: [
          { name: "A", tasks: [{ ref: "1-01", title: "One" }] },
          { name: "B", tasks: [{ ref: "1-01", title: "Two" }] },
        ],
      },
    ];

    dedupeTasksByRef(journeys, [], true);

    // Dropping either would LOSE work, which is the worse failure.
    expect(journeys[0].milestones[1].tasks).toHaveLength(1);
  });

  test("a task with no reference is never treated as a duplicate", () => {
    const journeys = [
      {
        milestones: [
          { name: "A", tasks: [{ title: "One" }] },
          { name: "B", tasks: [{ title: "Two" }] },
        ],
      },
    ];

    dedupeTasksByRef(journeys, [], false);

    expect(journeys[0].milestones[0].tasks).toHaveLength(1);
    expect(journeys[0].milestones[1].tasks).toHaveLength(1);
  });
});

describe("an uncertain grouping is carried, not smoothed over", () => {
  test("normalizeJourneys keeps requires_review and its reason", () => {
    const [journey] = normalizeJourneys([
      {
        name: "Programme",
        milestones: [
          {
            name: "Activities awaiting milestone assignment",
            requires_review: true,
            reason: "The milestone list does not say which activities belong to it.",
            tasks: [{ title: "Do the work" }],
          },
        ],
      },
    ]);

    const milestone = journey.milestones[0];
    expect(milestone.requires_review).toBe(true);
    expect(milestone.reason).toBe("The milestone list does not say which activities belong to it.");
  });

  test("a milestone with nothing to flag stays unflagged", () => {
    const [journey] = normalizeJourneys([{ name: "Programme", milestones: [{ name: "Real milestone" }] }]);
    expect(journey.milestones[0].requires_review).toBeNull();
    expect(journey.milestones[0].reason).toBeNull();
  });

  test("the flag survives a split: one part raising it is enough", () => {
    const merged = mergePlanParts([
      { journeys: [{ name: "P", milestones: [{ name: "M", requires_review: true, reason: "not stated" }] }] },
      { journeys: [{ name: "P", milestones: [{ name: "M", tasks: [{ ref: "MS-01", title: "Work" }] }] }] },
    ]);

    const milestone = merged.journeys[0].milestones[0];
    expect(milestone.requires_review).toBe(true);
    expect(milestone.reason).toBe("not stated");
    expect(milestone.tasks).toHaveLength(1);
  });
});
