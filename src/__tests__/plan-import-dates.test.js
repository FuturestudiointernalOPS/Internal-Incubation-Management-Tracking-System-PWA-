/**
 * PLAN IMPORT — the dates, and the membership the tracker already stated.
 *
 * THE DEFECTS THIS LOCKS SHUT (found on a real PSPlytics import)
 *
 * 1. DATES WERE THE MODEL'S ARITHMETIC. A spreadsheet carries a date as a serial
 *    (46331). The importer asked the model to convert it, and the model got it
 *    wrong: 46331 came back as 2026-11-01 (it is 2026-11-05), 46366 as
 *    2026-12-09 (it is 2026-12-10) — and one reading of the sheet gave up and
 *    returned EVERY date as null. Twelve rows lost their dates in silence.
 *
 * 2. A STATED MAPPING ARRIVED AS "NEEDS REVIEW". A sheet read in parts is
 *    interpreted one part at a time, so a milestone whose list states
 *    "MS-01, MS-02, MS-04" was described in a part that did not contain those
 *    rows. Milestones arrived empty with "assign the activities" — for a mapping
 *    the workbook had already written down.
 *
 * 3. A WORKBOOK TITLE BECAME A JOURNEY. "PSPlytics — Master Tracker" (row 1 of
 *    the document) was mapped as a programme, and the activities of real
 *    milestones landed under it.
 */
const {
  excelSerialToIso,
  normalizeJourneys,
  placeTasksByStatedRefs,
  deriveProposalDates,
} = require("@/services/ventures/planImport/proposal");
const { buildPlanPrompt } = require("@/services/ventures/planImport");

describe("a spreadsheet serial is converted by CODE, never by the model", () => {
  // The serials read from the real PSPlytics tracker, against the dates the
  // document itself states.
  test.each([
    [46295, "2026-09-30"],
    [46315, "2026-10-20"],
    [46331, "2026-11-05"],
    [46358, "2026-12-02"],
    [46366, "2026-12-10"],
  ])("serial %i is %s", (serial, iso) => {
    expect(excelSerialToIso(serial)).toBe(iso);
  });

  test("an ISO date passes through untouched, and junk is refused", () => {
    expect(excelSerialToIso("2026-11-05")).toBeNull(); // already a date, not a serial
    expect(excelSerialToIso("")).toBeNull();
    expect(excelSerialToIso("MS-01")).toBeNull();
    expect(excelSerialToIso(1234)).toBeNull(); // not a plausible plan date
    expect(excelSerialToIso(999999)).toBeNull();
  });

  test("the conversion reaches the proposal: a serial date is not lost", () => {
    const [journey] = normalizeJourneys([
      {
        name: "Market Study & Market Access",
        start_date: "46331",
        target_date: 46358,
        milestones: [
          {
            name: "Market & Customer Intelligence",
            start_date: "46295",
            reference: null,
            tasks: [{ ref: "MS-01", title: "Run interviews", start_date: 46295, due_date: "46315" }],
          },
        ],
      },
    ]);

    expect(journey.start_date).toBe("2026-11-05");
    expect(journey.target_date).toBe("2026-12-02");
    expect(journey.milestones[0].start_date).toBe("2026-09-30");
    expect(journey.milestones[0].tasks[0].start_date).toBe("2026-09-30");
    expect(journey.milestones[0].tasks[0].due_date).toBe("2026-10-20");
  });

  test("the model is told NOT to convert, even though it is asked for ISO", () => {
    const prompt = buildPlanPrompt({ sheetText: "ID\tStart\nMS-01\t46331" }).messages[0].content;
    expect(prompt).toMatch(/NEVER CONVERT A DATE YOURSELF/);
    expect(prompt).toMatch(/copy that number EXACTLY/);
    expect(prompt).toMatch(/task_refs/);
    expect(prompt).toMatch(/is NEVER a journey/);
  });
});

describe("a date the sheet stated but that cannot be read is reported BY ROW", () => {
  test("the warning names the task, so it can be found and fixed", () => {
    const warnings = [];
    normalizeJourneys(
      [
        {
          name: "Governance",
          milestones: [
            {
              name: "Progress Monitoring",
              tasks: [{ ref: "GV-02", title: "Fortnightly report", start_date: "not a date", due_date: null }],
            },
          ],
        },
      ],
      warnings,
    );

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("GV-02");
    expect(warnings[0]).toContain("not a date");
    // One unreadable date used to pass unnoticed among twenty other warnings.
    expect(warnings[0]).toMatch(/could not be read/);
  });

  test("a date the sheet simply did not give is not a warning", () => {
    const warnings = [];
    normalizeJourneys(
      [{ name: "Governance", milestones: [{ name: "M", tasks: [{ ref: "GV-01", title: "Check-in" }] }] }],
      warnings,
    );
    expect(warnings).toEqual([]);
  });
});

describe("the tracker's stated membership is applied to the merged plan", () => {
  const journey = (milestones) => [{ name: "Market Study & Market Access", milestones }];

  test("an activity is placed in the milestone whose list NAMES it", () => {
    const journeys = journey([
      {
        name: "Market & Customer Intelligence",
        task_refs: ["MS-01", "MS-02", "MS-04"],
        tasks: [{ ref: "MS-01", title: "Interviews" }],
      },
      // Where the activity actually arrived: a part that grouped it by pillar.
      { name: "Institutional Access", tasks: [{ ref: "MS-02", title: "Size the base" }] },
    ]);
    const warnings = [];

    const result = placeTasksByStatedRefs(journeys, warnings);

    expect(result.moved).toBe(1);
    const named = journeys[0].milestones[0];
    expect(named.tasks.map((task) => task.ref)).toEqual(["MS-01", "MS-02"]);
    expect(journeys[0].milestones[1].tasks).toEqual([]);
  });

  test("it is applied by REFERENCE, so a same-named milestone in another journey is untouched", () => {
    // "Regulatory & Corridor Intelligence" is a real milestone under two pillars.
    const journeys = [
      {
        name: "Market Study & Market Access",
        milestones: [{ name: "Regulatory & Corridor Intelligence", task_refs: ["MS-03"], tasks: [] }],
      },
      {
        name: "Legal Incorporation & Admin Support",
        milestones: [{ name: "Regulatory & Corridor Intelligence", task_refs: ["LG-06"], tasks: [{ ref: "LG-06", title: "Data-handling statement" }] }],
      },
    ];

    placeTasksByStatedRefs(journeys, []);

    expect(journeys[1].milestones[0].tasks.map((task) => task.ref)).toEqual(["LG-06"]);
    expect(journeys[0].milestones[0].tasks).toEqual([]);
  });

  test("a milestone that now holds exactly what it names no longer needs review", () => {
    const journeys = journey([
      {
        name: "GTM & Merchant Targeting",
        task_refs: ["MS-05"],
        requires_review: true,
        reason: "The explicit milestone list states this milestone's task ID (MS-05) but that activity does not appear in the portion of the Tracker provided.",
        tasks: [{ ref: "MS-05", title: "Consolidate the research" }],
      },
    ]);

    const result = placeTasksByStatedRefs(journeys, []);

    expect(result.cleared).toBe(1);
    expect(journeys[0].milestones[0].requires_review).toBeNull();
    expect(journeys[0].milestones[0].reason).toBeNull();
  });

  test("a milestone still missing a stated activity KEEPS its review flag", () => {
    const journeys = journey([
      { name: "GTM & Merchant Targeting", task_refs: ["MS-05"], requires_review: true, tasks: [] },
    ]);

    placeTasksByStatedRefs(journeys, []);

    expect(journeys[0].milestones[0].requires_review).toBe(true);
  });

  test("an activity already in the right place is left alone, and never duplicated", () => {
    const journeys = journey([
      { name: "M", task_refs: ["MS-01"], tasks: [{ ref: "MS-01", title: "Interviews" }] },
      { name: "Other", tasks: [{ ref: "MS-01", title: "Interviews" }] },
    ]);

    placeTasksByStatedRefs(journeys, []);

    expect(journeys[0].milestones[0].tasks).toHaveLength(1);
    expect(journeys[0].milestones[1].tasks).toEqual([]);
  });

  test("the derived dates follow the CORRECTED membership", () => {
    const journeys = journey([
      { name: "M", task_refs: ["MS-01", "MS-02"], tasks: [{ ref: "MS-01", start_date: "2026-09-30", due_date: "2026-10-20" }] },
      { name: "Other", tasks: [{ ref: "MS-02", start_date: "2026-11-05", due_date: "2026-12-02" }] },
    ]);

    placeTasksByStatedRefs(journeys, []);
    deriveProposalDates(journeys, []);

    // The milestone spans BOTH of its activities, not just the one that happened
    // to arrive in the same part.
    expect(journeys[0].milestones[0].start_date).toBe("2026-09-30");
    expect(journeys[0].milestones[0].target_date).toBe("2026-12-02");
  });
});
