/**
 * Staff dashboard model — the rules behind the dashboard's numbers: which weeks
 * count, what "regular" means, what the today card lists.
 */
const {
  recentWeeks,
  weekRecord,
  regularity,
  operationTotals,
  todayTasks,
  uniquePrograms,
} = require("@/components/staff/dashboardModel");

const monday = new Date(2026, 9, 5); // Mon 5 Oct 2026 — ISO week 41
const friday = new Date(2026, 9, 9);

const report = (type, week, extra = {}) => ({ report_type: type, week_number: week, year: 2026, status: "submitted", ...extra });

describe("recentWeeks", () => {
  test("four ISO weeks, oldest first, ending with the current one", () => {
    expect(recentWeeks(monday).map((week) => week.week)).toEqual([38, 39, 40, 41]);
    expect(recentWeeks(new Date(2026, 9, 11)).map((week) => week.week)).toEqual([38, 39, 40, 41]); // Sunday
  });

  test("it crosses the year boundary", () => {
    expect(recentWeeks(new Date(2027, 0, 4)).map((week) => [week.week, week.year])).toEqual([
      [51, 2026],
      [52, 2026],
      [53, 2026],
      [1, 2027],
    ]);
  });
});

describe("weekRecord", () => {
  const reports = [
    report("standup", 40, { has_blockers: 1 }),
    report("retro", 40),
    report("standup", 41, { status: "draft" }),
    report("standup", 39),
  ];

  test("only submitted reports count", () => {
    expect(weekRecord(reports, { week: 41, year: 2026 })).toMatchObject({ standup: false, retro: false, blockers: 0 });
    expect(weekRecord(reports, { week: 40, year: 2026 })).toMatchObject({ standup: true, retro: true, blockers: 1 });
    expect(weekRecord(reports, { week: 39, year: 2026 })).toMatchObject({ standup: true, retro: false });
  });

  test("the year matters", () => {
    expect(weekRecord(reports, { week: 40, year: 2025 }).standup).toBe(false);
  });
});

describe("regularity", () => {
  const weeks = recentWeeks(monday);
  const full = weeks.map((week) => ({ ...week, standup: true, retro: true, blockers: 0 }));

  test("everything due handed in is regular — on a Monday the current retro is not yet due", () => {
    const record = full.map((week, index) => (index === 3 ? { ...week, retro: false } : week));
    expect(regularity(record, monday)).toBe("regular");
  });

  test("on a Friday the current retro is due too: 7 of 8 is still regular, 6 of 8 is not", () => {
    const record = full.map((week, index) => (index === 3 ? { ...week, retro: false } : week));
    expect(regularity(record, friday)).toBe("regular");
    const worse = record.map((week, index) => (index === 0 ? { ...week, standup: false } : week));
    expect(regularity(worse, friday)).toBe("at_risk");
  });

  test("thresholds on a Monday (7 due): 5 handed in is at risk, 3 is inactive", () => {
    const miss = (count) => full.map((week, index) => (index < count ? { ...week, standup: false, retro: false } : week));
    expect(regularity(miss(1), monday)).toBe("at_risk");
    expect(regularity(miss(2), monday)).toBe("inactive");
  });

  test("nothing handed in is inactive; no data is inactive", () => {
    expect(regularity(weeks.map((week) => ({ ...week, standup: false, retro: false })), monday)).toBe("inactive");
    expect(regularity([], monday)).toBe("inactive");
  });
});

describe("operationTotals", () => {
  test("counts submitted stand-ups and retros and the share of stand-ups that flagged a blocker", () => {
    const totals = operationTotals([
      report("standup", 40, { has_blockers: 1 }),
      report("standup", 41),
      report("retro", 40),
      report("standup", 39, { status: "draft", has_blockers: 1 }),
    ]);
    expect(totals).toEqual({ standups: 2, retros: 1, blockers: 1, blockerRate: 50 });
  });

  test("no reports, no division by zero", () => {
    expect(operationTotals([])).toEqual({ standups: 0, retros: 0, blockers: 0, blockerRate: 0 });
    expect(operationTotals(null).standups).toBe(0);
  });
});

describe("todayTasks", () => {
  const item = (id, key, status, extra = {}) => ({ kind: "task", relatedId: id, key, status, title: `T${id}`, priority: null, ...extra });

  test("lists today's tasks once each, then the open overdue ones, late first", () => {
    const rows = todayTasks(
      [item(1, "2026-10-05", "pending"), item(1, "2026-10-05", "pending"), item(2, "2026-10-05", "blocked"), item(3, "2026-10-06", "pending"), { kind: "meeting", key: "2026-10-05", relatedId: 9 }],
      "2026-10-05",
      [{ id: 7, title: "Old one" }, { id: 1, title: "Already today" }],
    );
    expect(rows.map((row) => [row.id, row.late])).toEqual([[7, true], [2, false], [1, false]]);
  });
});

describe("uniquePrograms", () => {
  test("one entry per id, first list wins", () => {
    expect(uniquePrograms([{ id: 1, name: "A" }, { id: 2 }], [{ id: "1", name: "B" }, { id: 3 }, null, {}]).map((program) => program.id)).toEqual([1, 2, 3]);
  });
});
