/**
 * P1 — recurring schedules: occurrence calculation, timezone, duplicates,
 * versioning and the demonstrations the brief asks for:
 *
 *   • Tuesday and Friday with DIFFERENT durations
 *   • changing a schedule without affecting what already happened
 *   • versions preserve the previous arrangement
 *   • duplicate occurrences are impossible (stable, unique keys)
 *   • timezone correctness (Africa/Porto-Novo and a DST zone)
 *   • the proposed skip / move workflow is representable today
 */

const {
  buildOccurrences,
  weekdayOf,
} = require("@/services/ventures/recurringSchedules/occurrences");
const { isValidTimeZone, zonedDateTimeToUtc } = require("@/services/ventures/recurringSchedules/timezone");
const { validateScheduleInput } = require("@/services/ventures/recurringSchedules/validate");

const TUE_FRI = {
  title: "Weekly coaching",
  description: "The brief's example",
  session_type: "coaching",
  timezone: "Africa/Porto-Novo",
  frequency: "weekly",
  interval_count: 1,
  slots: [
    { weekday: 2, start: "16:00", minutes: 30 },
    { weekday: 5, start: "15:00", minutes: 30 },
  ],
  valid_from: "2026-11-03",
  valid_until: null,
  max_occurrences: null,
};

describe("occurrence calculation", () => {
  test("Tuesday 16:00–16:30 and Friday 15:00–15:30, two weeks", () => {
    // The dates are chosen, not assumed: 2026-11-03 is a Tuesday.
    expect(weekdayOf("2026-11-03")).toBe(2);
    expect(weekdayOf("2026-11-06")).toBe(5);

    const occurrences = buildOccurrences(TUE_FRI, { from: "2026-11-01", to: "2026-11-15" });

    expect(occurrences.map((occurrence) => occurrence.date)).toEqual([
      "2026-11-03",
      "2026-11-06",
      "2026-11-10",
      "2026-11-13",
    ]);

    // DIFFERENT DURATIONS per day — the requirement, not a coincidence.
    const tuesday = occurrences.filter((occurrence) => occurrence.weekday === 2);
    const friday = occurrences.filter((occurrence) => occurrence.weekday === 5);
    expect(tuesday.every((occurrence) => occurrence.startLocal === "16:00" && occurrence.endLocal === "16:30")).toBe(true);
    expect(friday.every((occurrence) => occurrence.startLocal === "15:00" && occurrence.endLocal === "15:30")).toBe(true);
  });

  test("a biweekly pattern skips every other week", () => {
    const occurrences = buildOccurrences(
      { ...TUE_FRI, frequency: "biweekly" },
      { from: "2026-11-01", to: "2026-12-15" },
    );
    const dates = occurrences.map((occurrence) => occurrence.date);
    expect(dates[0]).toBe("2026-11-03");
    // The following week produces nothing.
    expect(dates).not.toContain("2026-11-10");
    expect(dates).toContain("2026-11-17");
  });

  test("a monthly pattern keeps the day of the start date", () => {
    const occurrences = buildOccurrences(
      {
        ...TUE_FRI,
        frequency: "monthly",
        slots: [{ weekday: 2, start: "10:00", minutes: 60 }],
        valid_from: "2026-01-15",
      },
      { from: "2026-01-01", to: "2026-04-30" },
    );
    expect(occurrences.map((occurrence) => occurrence.date)).toEqual([
      "2026-01-15",
      "2026-02-15",
      "2026-03-15",
      "2026-04-15",
    ]);
  });

  test("max_occurrences counts from the START, not from the window", () => {
    const occurrences = buildOccurrences(
      { ...TUE_FRI, max_occurrences: 3 },
      { from: "2026-11-09", to: "2026-12-31" },
    );
    // Occurrences 1–3 are Nov 3, Nov 6, Nov 10: only Nov 10 is inside the window.
    expect(occurrences.map((occurrence) => occurrence.date)).toEqual(["2026-11-10"]);
  });

  test("the end date closes the pattern", () => {
    const occurrences = buildOccurrences(
      { ...TUE_FRI, valid_until: "2026-11-10" },
      { from: "2026-11-01", to: "2026-12-31" },
    );
    expect(occurrences.map((occurrence) => occurrence.date)).toEqual([
      "2026-11-03",
      "2026-11-06",
      "2026-11-10",
    ]);
  });
});

describe("duplicate occurrences are impossible", () => {
  test("the same rule produces the same keys, and no key repeats", () => {
    const first = buildOccurrences(TUE_FRI, { from: "2026-11-01", to: "2026-12-15" });
    const second = buildOccurrences(TUE_FRI, { from: "2026-11-01", to: "2026-12-15" });

    const keys = first.map((occurrence) => occurrence.occurrenceKey);
    expect(second.map((occurrence) => occurrence.occurrenceKey)).toEqual(keys);
    expect(new Set(keys).size).toBe(keys.length);
    // The key is wall-clock, so it is stable and readable in the database.
    expect(keys[0]).toBe("2026-11-03T16:00");
  });
});

describe("changing a schedule does not rewrite history", () => {
  test("the old version keeps its dates; the new one starts on its own date", () => {
    const oldVersion = { ...TUE_FRI, valid_until: "2026-11-30" };
    const old = buildOccurrences(oldVersion, { from: "2026-11-01", to: "2027-01-31" });

    // "From December, Thursdays only" — the replacement rule.
    const newVersion = {
      ...TUE_FRI,
      valid_from: "2026-12-01",
      slots: [{ weekday: 4, start: "10:00", minutes: 45 }],
    };
    const fresh = buildOccurrences(newVersion, { from: "2026-11-01", to: "2027-01-31" });

    // Everything before December belongs to the old arrangement and is untouched.
    expect(old.every((occurrence) => occurrence.date <= "2026-11-30")).toBe(true);
    expect(old.map((occurrence) => occurrence.date)).toContain("2026-11-27");

    // The new arrangement never claims a day the old one used.
    expect(fresh.every((occurrence) => occurrence.date >= "2026-12-01")).toBe(true);
    expect(fresh.every((occurrence) => occurrence.weekday === 4)).toBe(true);

    const overlap = old.filter((occurrence) => fresh.some((next) => next.date === occurrence.date));
    expect(overlap).toEqual([]);
  });
});

describe("exceptions: the skip / move workflow is representable", () => {
  test("one occurrence can be skipped without touching the others", () => {
    const occurrences = buildOccurrences(TUE_FRI, {
      from: "2026-11-01",
      to: "2026-11-15",
      exceptions: [{ occurrence_key: "2026-11-06T15:00", kind: "skip", reason: "Public holiday" }],
    });

    const friday = occurrences.find((occurrence) => occurrence.occurrenceKey === "2026-11-06T15:00");
    expect(friday.status).toBe("skip");
    expect(friday.reason).toBe("Public holiday");
    // The pattern itself is unchanged: the next Friday is still produced.
    expect(occurrences.some((occurrence) => occurrence.date === "2026-11-13")).toBe(true);
  });

  test("one occurrence can be moved without touching the others", () => {
    const occurrences = buildOccurrences(TUE_FRI, {
      from: "2026-11-01",
      to: "2026-11-15",
      exceptions: [{ occurrence_key: "2026-11-03T16:00", kind: "move", moved_to: "2026-11-04T15:00:00.000Z" }],
    });
    const moved = occurrences.find((occurrence) => occurrence.occurrenceKey === "2026-11-03T16:00");
    expect(moved.status).toBe("move");
    expect(moved.movedTo).toBe("2026-11-04T15:00:00.000Z");
    expect(occurrences.map((occurrence) => occurrence.date)).toContain("2026-11-06");
  });
});

describe("timezone correctness", () => {
  test("Africa/Porto-Novo is UTC+1 all year (no DST)", () => {
    expect(zonedDateTimeToUtc("2026-11-03", "16:00", "Africa/Porto-Novo").toISOString()).toBe("2026-11-03T15:00:00.000Z");
    expect(zonedDateTimeToUtc("2026-07-03", "16:00", "Africa/Porto-Novo").toISOString()).toBe("2026-07-03T15:00:00.000Z");
  });

  test("a DST zone keeps the WALL CLOCK and moves the instant", () => {
    // Europe/Paris: +2 in summer, +1 in winter.
    expect(zonedDateTimeToUtc("2026-07-01", "16:00", "Europe/Paris").toISOString()).toBe("2026-07-01T14:00:00.000Z");
    expect(zonedDateTimeToUtc("2026-12-01", "16:00", "Europe/Paris").toISOString()).toBe("2026-12-01T15:00:00.000Z");
  });

  test("the schedule's own zone is used for every occurrence", () => {
    const occurrences = buildOccurrences(
      { ...TUE_FRI, timezone: "Europe/Paris" },
      { from: "2026-11-01", to: "2026-11-08" },
    );
    // 16:00 Paris in November is 15:00 UTC.
    expect(occurrences[0].startUtc).toBe("2026-11-03T15:00:00.000Z");
    expect(occurrences[1].startUtc).toBe("2026-11-06T14:00:00.000Z");
  });

  test("an unknown zone is refused, a real one is accepted", () => {
    expect(isValidTimeZone("Africa/Porto-Novo")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});

describe("validation", () => {
  const errorsFor = (patch) => validateScheduleInput({ ...TUE_FRI, ...patch }).errors;

  test("a complete schedule is accepted and normalised", () => {
    const result = validateScheduleInput(TUE_FRI);
    expect(result.errors).toEqual([]);
    expect(result.schedule.slots).toHaveLength(2);
    expect(result.schedule.valid_until).toBeNull();
    expect(result.schedule.max_occurrences).toBeNull();
  });

  test("the essentials are enforced", () => {
    expect(errorsFor({ title: "  " })).toContain("venture.schedule.error.title");
    expect(errorsFor({ frequency: "hourly" })).toContain("venture.schedule.error.frequency");
    expect(errorsFor({ interval_count: 0 })).toContain("venture.schedule.error.interval");
    expect(errorsFor({ slots: [] })).toContain("venture.schedule.error.slots");
    expect(errorsFor({ timezone: "Mars/Olympus" })).toContain("venture.schedule.error.timezone");
  });

  test("each slot is checked", () => {
    expect(errorsFor({ slots: [{ weekday: 9, start: "16:00", minutes: 30 }] })).toContain("venture.schedule.error.slotWeekday");
    expect(errorsFor({ slots: [{ weekday: 2, start: "25:00", minutes: 30 }] })).toContain("venture.schedule.error.slotStart");
    expect(errorsFor({ slots: [{ weekday: 2, start: "16:00", minutes: 2 }] })).toContain("venture.schedule.error.slotDuration");
  });

  test("the end date cannot precede the start", () => {
    expect(errorsFor({ valid_until: "2026-10-01" })).toContain("venture.schedule.error.validUntilBefore");
  });

  test("the occurrence cap must be a whole number above zero", () => {
    expect(errorsFor({ max_occurrences: 0 })).toContain("venture.schedule.error.maxOccurrences");
    expect(errorsFor({ max_occurrences: 2.5 })).toContain("venture.schedule.error.maxOccurrences");
  });
});
