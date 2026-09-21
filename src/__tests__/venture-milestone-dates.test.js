/**
 * Milestone date rules — the roadmap only reads forwards.
 *
 * Locks in the three answers the journey panel depends on:
 *   1. the ordered timeline of a journey (stages, then milestones)
 *   2. the date a milestone can never overtake (a later milestone, or one of
 *      the deliverables it owes)
 *   3. when a milestone or deliverable date is refused, and why
 *
 * Pure functions — no db, no rendering.
 */
const {
  journeyTimeline,
  nextMilestoneDate,
  milestoneDateIssue,
  deliverableDateIssue,
  earliestStoredDate,
  dateOnly,
  todayDateInput,
} = require("@/lib/ventureMilestoneDates");

const STAGES = [
  {
    id: "s1",
    milestones: [
      { id: "m1", target_date: "2026-10-01" },
      { id: "m2", target_date: null },
    ],
  },
  {
    id: "s2",
    milestones: [
      { id: "m3", target_date: "2026-12-01" },
      { id: "m4", target_date: "2026-11-01" },
    ],
  },
];

describe("dateOnly", () => {
  test("keeps the date part of a timestamp and drops an empty value", () => {
    expect(dateOnly("2026-09-15T00:00:00.000Z")).toBe("2026-09-15");
    expect(dateOnly("2026-09-15")).toBe("2026-09-15");
    expect(dateOnly(null)).toBe("");
    expect(dateOnly(undefined)).toBe("");
  });

  test("formats a Date in local time, like the pickers do", () => {
    expect(dateOnly(new Date(2026, 8, 15, 23, 30))).toBe("2026-09-15");
  });
});

describe("journeyTimeline", () => {
  test("flattens stages then milestones, skipping archived journeys", () => {
    const timeline = journeyTimeline([...STAGES, { id: "s3", is_archived: true, milestones: [{ id: "m9" }] }]);
    expect(timeline.map((m) => m.id)).toEqual(["m1", "m2", "m3", "m4"]);
    expect(timeline[2].stageId).toBe("s2");
    expect(timeline[1].target_date).toBe(null);
  });

  test("tolerates an empty or missing journey list", () => {
    expect(journeyTimeline([])).toEqual([]);
    expect(journeyTimeline(undefined)).toEqual([]);
  });
});

describe("nextMilestoneDate — the date a milestone can never overtake", () => {
  test("a NEW milestone is appended to its journey, so later journeys bound it", () => {
    expect(nextMilestoneDate(STAGES, { stageId: "s1" })).toBe("2026-11-01");
  });

  test("a NEW milestone in the last journey is unbounded", () => {
    expect(nextMilestoneDate(STAGES, { stageId: "s2" })).toBe(null);
  });

  test("a NEW milestone is still bounded when its own journey is empty", () => {
    const stages = [
      { id: "s1", milestones: [] },
      { id: "s2", milestones: [{ id: "m1", target_date: "2026-12-01" }] },
    ];
    expect(nextMilestoneDate(stages, { stageId: "s1" })).toBe("2026-12-01");
  });

  test("the EARLIEST later date wins, even out of display order", () => {
    // m4 (2026-11-01) is displayed after m3 (2026-12-01) but comes first in time.
    expect(nextMilestoneDate(STAGES, { milestoneId: "m2" })).toBe("2026-11-01");
  });

  test("an undated milestone downstream does not bound anything", () => {
    const stages = [{ id: "s1", milestones: [{ id: "m1" }, { id: "m2", target_date: null }] }];
    expect(nextMilestoneDate(stages, { milestoneId: "m1" })).toBe(null);
  });

  test("the last milestone of the roadmap is unbounded", () => {
    expect(nextMilestoneDate(STAGES, { milestoneId: "m4" })).toBe(null);
  });

  test("an archived journey bounds nothing and is bounded by nothing", () => {
    const stages = [
      { id: "s1", milestones: [{ id: "m1" }] },
      { id: "s2", is_archived: true, milestones: [{ id: "m2", target_date: "2026-12-01" }] },
    ];
    expect(nextMilestoneDate(stages, { stageId: "s1" })).toBe(null);
    expect(nextMilestoneDate(stages, { stageId: "s2" })).toBe(null);
  });

  test("an unknown milestone or journey is unbounded", () => {
    expect(nextMilestoneDate(STAGES, { milestoneId: "nope" })).toBe(null);
    expect(nextMilestoneDate(STAGES, { stageId: "nope" })).toBe(null);
  });
});

describe("milestoneDateIssue", () => {
  const today = "2026-09-21";

  test("refuses a date in the past", () => {
    expect(milestoneDateIssue({ targetDate: "2026-09-20", today })).toBe("milestone_date_past");
    expect(milestoneDateIssue({ targetDate: today, today })).toBe(null);
  });

  test("refuses a date that overtakes a later milestone", () => {
    expect(
      milestoneDateIssue({ targetDate: "2026-11-02", nextDate: "2026-11-01", today }),
    ).toBe("milestone_date_after_next");
    expect(milestoneDateIssue({ targetDate: "2026-11-01", nextDate: "2026-11-01", today })).toBe(null);
  });

  test("refuses a date that overtakes a deliverable the milestone owes", () => {
    expect(
      milestoneDateIssue({ targetDate: "2026-10-01", deliverableDates: ["2026-09-30"], today }),
    ).toBe("milestone_date_after_deliverable");
    // The EARLIEST deliverable is the one that binds.
    expect(
      milestoneDateIssue({ targetDate: "2026-10-01", deliverableDates: ["2026-11-01", "2026-09-30"], today }),
    ).toBe("milestone_date_after_deliverable");
    expect(
      milestoneDateIssue({ targetDate: "2026-10-01", deliverableDates: ["2026-11-01", null], today }),
    ).toBe(null);
    // Undated deliverables bind nothing.
    expect(milestoneDateIssue({ targetDate: "2026-10-01", deliverableDates: [null, ""], today })).toBe(null);
  });

  test("an empty date is not judged", () => {
    expect(milestoneDateIssue({ targetDate: "", nextDate: "2026-11-01", today })).toBe(null);
  });

  test("an untouched stored date keeps its floor but not its order", () => {
    expect(milestoneDateIssue({ targetDate: "2026-01-05", today, enforceFloor: false })).toBe(null);
    expect(
      milestoneDateIssue({ targetDate: "2026-12-05", nextDate: "2026-11-01", today, enforceFloor: false }),
    ).toBe("milestone_date_after_next");
    expect(
      milestoneDateIssue({ targetDate: "2026-12-05", deliverableDates: ["2026-11-01"], today, enforceFloor: false }),
    ).toBe("milestone_date_after_deliverable");
  });
});

describe("deliverableDateIssue", () => {
  const today = "2026-09-21";

  test("refuses a deliverable due before its milestone", () => {
    expect(
      deliverableDateIssue({ dueDate: "2026-09-30", milestoneDate: "2026-10-01", today }),
    ).toBe("deliverable_date_before");
    expect(deliverableDateIssue({ dueDate: "2026-10-01", milestoneDate: "2026-10-01", today })).toBe(null);
  });

  test("with no milestone date, a deliverable still cannot be due in the past", () => {
    expect(deliverableDateIssue({ dueDate: "2026-09-20", today })).toBe("deliverable_date_past");
    expect(deliverableDateIssue({ dueDate: "2026-09-21", today })).toBe(null);
  });

  test("an empty date is not judged", () => {
    expect(deliverableDateIssue({ dueDate: "", milestoneDate: "2026-10-01", today })).toBe(null);
  });

  test("an untouched stored date keeps its floor but not its order", () => {
    expect(
      deliverableDateIssue({ dueDate: "2026-09-20", milestoneDate: "2026-10-01", today, enforceFloor: false }),
    ).toBe("deliverable_date_before");
    expect(deliverableDateIssue({ dueDate: "2026-09-20", today, enforceFloor: false })).toBe(null);
  });
});

describe("earliestStoredDate", () => {
  test("returns the earliest dated value, ignoring empty and undated ones", () => {
    expect(earliestStoredDate(["2026-11-01", "2026-09-30", null, ""])).toBe("2026-09-30");
    expect(earliestStoredDate([null, undefined, ""])).toBe(null);
    expect(earliestStoredDate([])).toBe(null);
  });
});

describe("todayDateInput", () => {
  test("renders today in the form a date input reads and writes", () => {
    expect(todayDateInput(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
