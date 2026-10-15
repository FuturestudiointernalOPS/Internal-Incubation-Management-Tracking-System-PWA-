/**
 * PLAN IMPORT — the journey layer, once the parts are one.
 *
 * THE DEFECT THIS LOCKS SHUT (found on a real PSPlytics import)
 *
 * A sheet read in parts is interpreted one part at a time, and the parts disagreed
 * about where the plan lives. The parts carrying rows described the workbook by its
 * TITLE — "PSPlytics — Master Tracker", row 1 of the document — so all 48 activities
 * arrived under that invented heading. The parts carrying the workbook's own
 * milestone list described the six journeys it names. Merging kept both, and the
 * review screen showed 7 journeys and 53 milestones: one journey holding every
 * activity, six holding the same nineteen milestones, empty.
 *
 * The list states the home. It is now DATA (`journey_name`) and applied to the merged
 * plan — the same treatment the stated task membership already gets. A milestone's
 * home is matched by the STATED JOURNEY'S NAME, never by milestone name alone,
 * because "Regulatory & Corridor Intelligence" legitimately stands under two
 * different journeys.
 */
const {
  normalizeJourneys,
  placeMilestonesByStatedJourneys,
} = require("@/services/ventures/planImport/proposal");
const { buildPlanPrompt } = require("@/services/ventures/planImport");

/** The shape the merger produced on the real import, reduced: a journey named after
 *  the workbook's title holding the milestone AND its activities, and the real
 *  journey the list names holding a copy of the same milestone, empty. */
const drafted = () => [
  {
    name: "PSPlytics — Master Tracker",
    objective: "Source of truth for all 90-day activities, ownership, support, dates.",
    start_date: "2026-09-30",
    target_date: "2027-01-13",
    dates_derived: true,
    milestones: [
      {
        name: "Market & Customer Intelligence",
        journey_name: "Market Study & Market Access",
        task_refs: ["MS-01", "MS-02", "MS-04", "MS-13"],
        tasks: [
          { ref: "MS-01", title: "Run 12–15 structured interviews", start_date: "2026-09-30", due_date: "2026-10-20" },
          { ref: "MS-02", title: "Size the addressable base", start_date: "2026-09-30", due_date: "2026-10-20" },
        ],
      },
    ],
  },
  {
    name: "Market Study & Market Access",
    start_date: null,
    target_date: null,
    milestones: [
      {
        name: "Market & Customer Intelligence",
        journey_name: "Market Study & Market Access",
        task_refs: ["MS-01", "MS-02", "MS-04", "MS-13"],
        tasks: [],
      },
    ],
  },
];

/** The merged proposal as the import builds it: normalised, then placed. */
const run = (raw) => {
  const warnings = [];
  const journeys = normalizeJourneys(raw, warnings);
  placeMilestonesByStatedJourneys(journeys, warnings);
  return { journeys, warnings };
};

describe("a stated milestone is placed in the journey its own list names", () => {
  test("the activities arrive under the real journey, and the invented heading is gone", () => {
    const { journeys } = run(drafted());
    expect(journeys.map((journey) => journey.name)).toEqual(["Market Study & Market Access"]);
    expect(journeys[0].milestones).toHaveLength(1);
    expect(journeys[0].milestones[0].tasks.map((task) => task.ref)).toEqual(["MS-01", "MS-02"]);
  });

  test("the activities keep their dates and everything else they carried", () => {
    const { journeys } = run(drafted());
    const [first] = journeys[0].milestones[0].tasks;
    expect(first.start_date).toBe("2026-09-30");
    expect(first.due_date).toBe("2026-10-20");
    expect(first.title).toBe("Run 12–15 structured interviews");
  });

  test("the heading left holding nothing is reported, not removed in silence", () => {
    const { journeys, warnings } = run(drafted());
    expect(journeys.some((journey) => journey.name === "PSPlytics — Master Tracker")).toBe(false);
    expect(warnings.join("\n")).toMatch(
      /1 milestone\(s\) were placed in the journey that states them.*were removed \(PSPlytics — Master Tracker\)/,
    );
  });

  test("two copies of the same stated milestone merge, and a row read twice is kept once", () => {
    const raw = drafted();
    raw[0].milestones[0].tasks = [{ ref: "MS-01", title: "Run 12–15 structured interviews" }];
    raw[1].milestones[0].tasks = [{ ref: "MS-01", title: "Run 12–15 structured interviews" }];
    const { journeys } = run(raw);
    expect(journeys).toHaveLength(1);
    expect(journeys[0].milestones).toHaveLength(1);
    expect(journeys[0].milestones[0].tasks).toHaveLength(1);
  });

  test("the stated membership survives the merge, from either copy", () => {
    const raw = drafted();
    raw[0].milestones[0].task_refs = ["MS-01"];
    raw[1].milestones[0].task_refs = ["MS-02", "MS-04", "MS-13"];
    const { journeys } = run(raw);
    expect([...journeys[0].milestones[0].task_refs].sort()).toEqual(["MS-01", "MS-02", "MS-04", "MS-13"]);
  });

  test("a journey the list names but no part emitted is created — the list is the authority", () => {
    const raw = drafted();
    raw[1].milestones.push({
      name: "Programme Governance & Review",
      journey_name: "Programme Governance",
      task_refs: ["GV-01"],
      tasks: [],
    });
    const { journeys } = run(raw);
    expect(journeys.map((journey) => journey.name).sort()).toEqual([
      "Market Study & Market Access",
      "Programme Governance",
    ]);
  });

  test("the journey is matched as a NAME: &, 'and', case and punctuation are not meaning", () => {
    const raw = drafted();
    raw[0].milestones[0].journey_name = "market study and market access";
    const { journeys } = run(raw);
    expect(journeys.map((journey) => journey.name)).toEqual(["Market Study & Market Access"]);
  });

  test("a milestone the list does not place stays exactly where the analyst put it", () => {
    const raw = drafted();
    raw[0].milestones[0].journey_name = null;
    const { journeys, warnings } = run(raw);
    expect(journeys).toHaveLength(2);
    expect(journeys[0].milestones).toHaveLength(1);
    expect(warnings).toHaveLength(0);
  });

  test("without a stated journey anywhere, the analyst's own structure is left alone", () => {
    const warnings = [];
    const journeys = normalizeJourneys(
      [
        { name: "A programme", milestones: [{ name: "A milestone", tasks: [{ ref: "T-1", title: "work" }] }] },
        { name: "An empty one", milestones: [] },
      ],
      warnings,
    );
    const before = JSON.stringify(journeys);
    placeMilestonesByStatedJourneys(journeys, warnings);
    expect(JSON.stringify(journeys)).toBe(before);
    expect(warnings).toHaveLength(0);
  });

  test("a journey that holds nothing and the list does not name goes with the invented ones", () => {
    const raw = drafted();
    raw.push({ name: "Stray heading", milestones: [] });
    const { journeys } = run(raw);
    expect(journeys.map((journey) => journey.name)).toEqual(["Market Study & Market Access"]);
  });
});

describe("the analyst is told the list is the authority for the journey layer", () => {
  test("the prompt states the rule, and asks for journey_name on every milestone", () => {
    const prompt = buildPlanPrompt({ sheetText: "ID\tStart\nMS-01\t46331" }).messages[0].content;
    expect(prompt).toMatch(/JOURNEY COLUMN IS THE AUTHORITY FOR THE JOURNEY LAYER/);
    expect(prompt).toMatch(/journey_name/);
    expect(prompt).toMatch(/is NEVER a journey/);
  });
});
