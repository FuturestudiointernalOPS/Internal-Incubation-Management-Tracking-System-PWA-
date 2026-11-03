/**
 * PHASE 4 — the reporting schedule and the editable thresholds.
 *
 * Pure arithmetic: when a period is due, how a day of 31 behaves in a short
 * month, and which setting values the studio may save.
 */

const {
  dueDateFor,
  dueInstantFor,
  dueStateFor,
} = require("@/services/ventures/reporting/schedule");
const {
  settingValue,
  validateSettingValue,
  isEditableKey,
  SCHEDULE_SETTINGS,
  TRAFFIC_LIGHT_SETTINGS,
  STAGE_SETTINGS,
  ALL_SETTINGS,
} = require("@/services/ventures/reporting/settingDefinitions");
const { buildSettingsMap } = require("@/services/ventures/reporting/rules");

const settings = (overrides = {}) => ({
  reporting_monthly_due_day: 5,
  reporting_monthly_due_minute: 540, // 09:00
  reporting_quarterly_due_day: 10,
  reporting_quarterly_due_minute: 540,
  reporting_utc_offset_minutes: 0,
  ...overrides,
});

describe("monthly due dates", () => {
  test("a month is due in the FOLLOWING month", () => {
    expect(dueDateFor("2026-10-01", "monthly", settings())).toBe("2026-11-05");
  });

  test("December is due in January of the next year", () => {
    expect(dueDateFor("2026-12-01", "monthly", settings())).toBe("2027-01-05");
  });

  test("a day of 31 is clamped, never rolled into the next month", () => {
    // November has 30 days.
    expect(dueDateFor("2026-10-01", "monthly", settings({ reporting_monthly_due_day: 31 }))).toBe(
      "2026-11-30",
    );
    // February 2026 has 28 (2026 is not a leap year).
    expect(dueDateFor("2026-01-01", "monthly", settings({ reporting_monthly_due_day: 31 }))).toBe(
      "2026-02-28",
    );
  });

  test("the studio's day is used, not a hardcoded one", () => {
    expect(dueDateFor("2026-10-01", "monthly", settings({ reporting_monthly_due_day: 20 }))).toBe(
      "2026-11-20",
    );
  });
});

describe("quarterly due dates", () => {
  test("Q4 is due in January, on the quarterly day", () => {
    expect(dueDateFor("2026-10-01", "quarterly", settings())).toBe("2027-01-10");
  });

  test("Q1 is due in April", () => {
    expect(dueDateFor("2026-01-01", "quarterly", settings())).toBe("2026-04-10");
  });
});

describe("due instants and state", () => {
  test("the due time is applied with the studio's UTC offset", () => {
    expect(dueInstantFor("2026-10-01", "monthly", settings())).toBe("2026-11-05T09:00:00.000Z");
    expect(
      dueInstantFor("2026-10-01", "monthly", settings({ reporting_utc_offset_minutes: 60 })),
    ).toBe("2026-11-05T08:00:00.000Z");
  });

  test("before the deadline is not overdue; after it is", () => {
    const before = dueStateFor({
      period: "2026-10-01",
      kind: "monthly",
      settings: settings(),
      now: new Date("2026-11-01T00:00:00Z"),
    });
    expect(before.overdue).toBe(false);
    expect(before.dueDate).toBe("2026-11-05");

    const after = dueStateFor({
      period: "2026-10-01",
      kind: "monthly",
      settings: settings(),
      now: new Date("2026-11-06T00:00:00Z"),
    });
    expect(after.overdue).toBe(true);
  });

  test("a validated period is never reported as overdue", () => {
    const state = dueStateFor({
      period: "2026-10-01",
      kind: "monthly",
      settings: settings(),
      now: new Date("2026-11-20T00:00:00Z"),
      validated: true,
    });
    expect(state.overdue).toBe(false);
  });

  test("an unknown period yields no schedule rather than a wrong date", () => {
    expect(dueStateFor({ period: "", kind: "monthly", settings: settings() })).toBeNull();
  });
});

describe("settings resolution", () => {
  test("a missing key falls back to the spec's value", () => {
    expect(settingValue({}, "reporting_monthly_due_day")).toBe(5);
    expect(settingValue({}, "traffic_runway_green_months")).toBe(9);
  });

  test("a stored value wins", () => {
    expect(settingValue({ reporting_monthly_due_day: 12 }, "reporting_monthly_due_day")).toBe(12);
  });

  test("every definition carries a range and a fallback", () => {
    for (const definition of ALL_SETTINGS) {
      expect(typeof definition.key).toBe("string");
      expect(Number.isFinite(definition.min)).toBe(true);
      expect(Number.isFinite(definition.max)).toBe(true);
      expect(Number.isFinite(definition.fallback)).toBe(true);
    }
  });

  test("the stage thresholds of §4.5 are editable too", () => {
    expect(STAGE_SETTINGS).toHaveLength(12);
    expect(ALL_SETTINGS).toHaveLength(
      STAGE_SETTINGS.length + TRAFFIC_LIGHT_SETTINGS.length + SCHEDULE_SETTINGS.length,
    );
    expect(isEditableKey("growth_min_paying_customers")).toBe(true);
  });
});

describe("business-model overrides", () => {
  const rows = [
    { setting_key: "growth_min_paying_customers", business_model: "default", setting_value: 15 },
    { setting_key: "growth_min_paying_customers", business_model: "marketplace", setting_value: 6 },
    { setting_key: "traffic_runway_green_months", business_model: "default", setting_value: 9 },
  ];

  test("a model that overrides a key reads its own value", () => {
    expect(buildSettingsMap(rows, "marketplace").growth_min_paying_customers).toBe(6);
  });

  test("a model that does not override a key still inherits the default", () => {
    expect(buildSettingsMap(rows, "marketplace").traffic_runway_green_months).toBe(9);
    expect(buildSettingsMap(rows, "subscription").growth_min_paying_customers).toBe(15);
  });

  test("the default model never reads an override", () => {
    expect(buildSettingsMap(rows, "default").growth_min_paying_customers).toBe(15);
  });

  test("only declared keys may be edited", () => {
    expect(isEditableKey("growth_min_paying_customers")).toBe(true);
    expect(isEditableKey("traffic_runway_green_months")).toBe(true);
    expect(isEditableKey("reporting_monthly_due_day")).toBe(true);
    expect(isEditableKey("something_invented")).toBe(false);
  });
});

describe("saving a setting", () => {
  test("a value in range is accepted", () => {
    expect(validateSettingValue("reporting_monthly_due_day", 15)).toBeNull();
    expect(validateSettingValue("traffic_runway_green_months", 12)).toBeNull();
  });

  test("an out-of-range value is refused", () => {
    expect(validateSettingValue("reporting_monthly_due_day", 0)).toBe(
      "venture.reporting.settings.validation.range",
    );
    expect(validateSettingValue("reporting_monthly_due_day", 40)).toBe(
      "venture.reporting.settings.validation.range",
    );
  });

  test("a non-number is refused", () => {
    expect(validateSettingValue("reporting_monthly_due_day", "soon")).toBe(
      "venture.reporting.settings.validation.number",
    );
  });

  test("a key that is not editable is refused", () => {
    expect(validateSettingValue("some_other_key", 1)).toBe(
      "venture.reporting.settings.validation.unknown",
    );
  });
});
