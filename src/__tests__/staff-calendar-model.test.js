/**
 * Staff calendar model — the pure rules behind the staff calendar:
 * how the dashboard feed becomes items, how a week/month is laid out, and what
 * the create forms send to the API.
 */
const {
  normalizeEvents,
  itemsOnDay,
  matches,
  countByStatus,
  layoutTimed,
  hourRange,
  daysOfView,
  weekStart,
  isoWeek,
  validateForm,
  buildTaskPayload,
  buildMeetingPayload,
  dateKey,
  monthsNeeded,
} = require("@/components/staff/calendarModel");

const task = (id, date, extra = {}) => ({
  id: `task-${id}-${date}`,
  title: extra.title || `Task ${id}`,
  date,
  source: "task",
  status: "pending",
  related_id: id,
  ...extra,
});

describe("normalizeEvents", () => {
  test("a task spanning three days is start / mid / end", () => {
    const items = normalizeEvents([task(1, "2026-10-05"), task(1, "2026-10-06"), task(1, "2026-10-07")]);
    expect(items.map((item) => item.position)).toEqual(["start", "mid", "end"]);
    expect(items.every((item) => item.kind === "task" && item.allDay)).toBe(true);
  });

  test("a one-day task is single", () => {
    expect(normalizeEvents([task(2, "2026-10-05")])[0].position).toBe("single");
  });

  test("the same task title twice on a day is shown once, with the most pressing status", () => {
    const items = normalizeEvents([
      task(1, "2026-10-05", { title: "Report", status: "completed" }),
      task(2, "2026-10-05", { title: "report", status: "blocked" }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe("blocked");
  });

  test("a session with a start is timed and placed on its LOCAL day and time", () => {
    const startsAt = new Date(2026, 9, 6, 14, 30).toISOString();
    const endsAt = new Date(2026, 9, 6, 16, 0).toISOString();
    const [item] = normalizeEvents([
      { id: "session-1", title: "Workshop", date: "2026-10-06", source: "session", starts_at: startsAt, ends_at: endsAt },
    ]);
    expect(item).toMatchObject({ kind: "meeting", allDay: false, key: "2026-10-06", start: [14, 30], end: [16, 0] });
  });

  test("a meeting without an end lasts an hour; one that ends before it starts also falls back", () => {
    const startsAt = new Date(2026, 9, 6, 9, 0).toISOString();
    const earlier = new Date(2026, 9, 6, 8, 0).toISOString();
    const items = normalizeEvents([
      { id: "e1", title: "A", date: "2026-10-06", source: "event", starts_at: startsAt },
      { id: "e2", title: "B", date: "2026-10-06", source: "event", starts_at: startsAt, ends_at: earlier },
    ]);
    expect(items.map((item) => item.end)).toEqual([[10, 0], [10, 0]]);
  });

  test("a meeting with no time in the feed is all-day; programme/deliverable dates are milestones", () => {
    const items = normalizeEvents([
      { id: "s", title: "Legacy", date: "2026-10-06", source: "session" },
      { id: "p", title: "Programme starts", date: "2026-10-07", source: "program" },
      { id: "d", title: "Deck due", date: "2026-10-08", source: "deliverable" },
    ]);
    expect(items.map((item) => [item.kind, item.allDay])).toEqual([
      ["meeting", true],
      ["milestone", true],
      ["milestone", true],
    ]);
  });

  test("unknown sources and events without a date are ignored", () => {
    expect(normalizeEvents([{ id: "x", title: "?", date: "2026-10-06", source: "mystery" }, { id: "y", source: "task" }])).toEqual([]);
    expect(normalizeEvents(null)).toEqual([]);
  });
});

describe("itemsOnDay / matches / counts", () => {
  const start = new Date(2026, 9, 6, 10, 0).toISOString();
  const items = normalizeEvents([
    task(1, "2026-10-06", { status: "completed" }),
    task(2, "2026-10-06", { status: "blocked", title: "Blocked thing" }),
    { id: "s", title: "Sync", date: "2026-10-06", source: "session", starts_at: start },
    { id: "p", title: "Deck due", date: "2026-10-06", source: "deliverable" },
  ]);

  test("all-day items come first (tasks, then milestones), timed items by start", () => {
    expect(itemsOnDay(items, "2026-10-06").map((item) => item.kind)).toEqual(["task", "task", "milestone", "meeting"]);
    // within tasks, the most pressing status first
    expect(itemsOnDay(items, "2026-10-06")[0].status).toBe("blocked");
  });

  test("filters: type toggles, status (tasks only) and text", () => {
    const on = { task: true, meeting: true, milestone: true };
    expect(items.filter((item) => matches(item, { on, status: "blocked", query: "" })).map((item) => item.kind).sort()).toEqual([
      "meeting",
      "milestone",
      "task",
    ]);
    expect(items.filter((item) => matches(item, { on: { ...on, meeting: false }, status: "all", query: "" }))).toHaveLength(3);
    expect(items.filter((item) => matches(item, { on, status: "all", query: "SYNC" }))).toHaveLength(1);
  });

  test("counts per status only cover the days in view", () => {
    const days = [new Date(2026, 9, 6)];
    expect(countByStatus(items, days, "")).toMatchObject({ all: 2, blocked: 1, completed: 1, meetings: 1, milestones: 1, tasks: 2 });
    expect(countByStatus(items, [new Date(2026, 9, 7)], "").all).toBe(0);
  });
});

describe("layout", () => {
  test("overlapping timed items take side-by-side lanes, a later one starts over", () => {
    const make = (from, to) => ({ start: from, end: to, title: `${from}-${to}` });
    const laid = layoutTimed([make([9, 0], [10, 0]), make([9, 30], [10, 30]), make([11, 0], [12, 0])]);
    expect(laid.map((entry) => [entry.lane, entry.lanes])).toEqual([[0, 2], [1, 2], [0, 1]]);
  });

  test("the hour range never gets narrower than 8–17 and grows to fit", () => {
    expect(hourRange([])).toEqual({ first: 8, last: 17 });
    expect(hourRange([{ start: [6, 30], end: [7, 15] }, { start: [18, 0], end: [20, 30] }])).toEqual({ first: 6, last: 21 });
  });
});

describe("dates", () => {
  test("a week starts on Monday and has seven days", () => {
    expect(dateKey(weekStart(new Date(2026, 9, 11)))).toBe("2026-10-05"); // a Sunday
    expect(daysOfView("week", new Date(2026, 9, 8)).map(dateKey)).toEqual([
      "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11",
    ]);
  });

  test("a month has every day, a day is one", () => {
    expect(daysOfView("month", new Date(2026, 1, 10))).toHaveLength(28);
    expect(daysOfView("day", new Date(2026, 9, 8))).toHaveLength(1);
  });

  test("a week across two months needs both months", () => {
    const days = daysOfView("week", new Date(2026, 9, 29)); // 26 Oct → 1 Nov
    expect(monthsNeeded(days)).toEqual([{ year: 2026, month: 9 }, { year: 2026, month: 10 }]);
  });

  test("ISO week numbers cross the year boundary like the server's", () => {
    expect(isoWeek(new Date(2026, 9, 5))).toEqual({ week: 41, year: 2026 });
    expect(isoWeek(new Date(2027, 0, 1))).toEqual({ week: 53, year: 2026 });
  });
});

describe("create forms", () => {
  test("validation", () => {
    expect(validateForm({ type: "task", title: " ", date: "2026-10-06" })).toBe("titleTask");
    expect(validateForm({ type: "meeting", title: " ", date: "2026-10-06" })).toBe("titleMeeting");
    expect(validateForm({ type: "task", title: "x", date: "" })).toBe("date");
    expect(validateForm({ type: "meeting", title: "x", date: "2026-10-06", start: "", end: "10:00" })).toBe("times");
    expect(validateForm({ type: "meeting", title: "x", date: "2026-10-06", start: "10:00", end: "10:00" })).toBe("order");
    expect(validateForm({ type: "task", title: "x", date: "2026-10-06" })).toBeNull();
  });

  test("a task is sent as a one-day task for the signed-in person, in the current ISO week", () => {
    expect(buildTaskPayload({ title: " Write ", date: "2026-10-06", status: "in_progress" }, { cid: "C1", name: "Lea" }, new Date(2026, 9, 5))).toEqual({
      title: "Write",
      user_id: "C1",
      user_name: "Lea",
      status: "in_progress",
      created_week: 41,
      created_year: 2026,
      start_date: "2026-10-06",
      end_date: "2026-10-06",
    });
  });

  test("a meeting is sent as UTC instants of the local start and end", () => {
    const payload = buildMeetingPayload({ title: "Sync", date: "2026-10-06", start: "09:30", end: "10:15", place: " Visio " }, { cid: "C1" });
    expect(new Date(payload.start_time).getTime()).toBe(new Date(2026, 9, 6, 9, 30).getTime());
    expect(new Date(payload.end_time).getTime()).toBe(new Date(2026, 9, 6, 10, 15).getTime());
    expect(payload).toMatchObject({ title: "Sync", event_type: "meeting", location: "Visio", created_by: "C1", program_id: null });
  });
});
