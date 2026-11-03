/**
 * PHASE 6a — the traffic light (spec §11). Pure.
 *
 * The properties worth protecting:
 *   • the overall light is the WORST of the three dimensions;
 *   • a dimension with no data is `unknown`, never red;
 *   • every threshold comes from the studio's settings.
 */

const { evaluateTrafficLight, GREEN, AMBER, RED, UNKNOWN } = require("@/services/ventures/reporting/trafficLight");

const settings = (overrides = {}) => ({
  traffic_runway_green_months: 9,
  traffic_runway_amber_months: 4,
  traffic_growth_green_pct: 5,
  traffic_growth_amber_pct: 0,
  traffic_milestones_green_pct: 80,
  traffic_milestones_amber_pct: 50,
  ...overrides,
});

const byKey = (result) => Object.fromEntries(result.dimensions.map((d) => [d.key, d]));

describe("traffic light dimensions", () => {
  test("runway: green at 9 months, amber at 4, red below", () => {
    expect(byKey(evaluateTrafficLight({ runwayMonths: 12, settings: settings() })).runway.status).toBe(GREEN);
    expect(byKey(evaluateTrafficLight({ runwayMonths: 9, settings: settings() })).runway.status).toBe(GREEN);
    expect(byKey(evaluateTrafficLight({ runwayMonths: 6, settings: settings() })).runway.status).toBe(AMBER);
    expect(byKey(evaluateTrafficLight({ runwayMonths: 3, settings: settings() })).runway.status).toBe(RED);
  });

  test("growth: green at 5%, amber at 0%, red when negative", () => {
    expect(byKey(evaluateTrafficLight({ customerGrowth: 6, settings: settings() })).growth.status).toBe(GREEN);
    expect(byKey(evaluateTrafficLight({ customerGrowth: 2, settings: settings() })).growth.status).toBe(AMBER);
    expect(byKey(evaluateTrafficLight({ customerGrowth: -1, settings: settings() })).growth.status).toBe(RED);
  });

  test("milestones: the rate is on-time ÷ due", () => {
    const result = byKey(
      evaluateTrafficLight({ milestones: { dueTotal: 10, onTime: 8 }, settings: settings() }),
    );
    expect(result.milestones.status).toBe(GREEN);
    expect(result.milestones.value).toBeCloseTo(80);
  });

  test("no milestones due yet is not a failure", () => {
    const result = byKey(
      evaluateTrafficLight({ milestones: { dueTotal: 0, onTime: 0 }, settings: settings() }),
    );
    expect(result.milestones.status).toBe(UNKNOWN);
  });
});

describe("the overall light", () => {
  test("is the WORST of the three", () => {
    const result = evaluateTrafficLight({
      runwayMonths: 12, // green
      customerGrowth: 6, // green
      milestones: { dueTotal: 10, onTime: 3 }, // 30% → red
      settings: settings(),
    });
    expect(result.overall).toBe(RED);
  });

  test("amber dominates green", () => {
    const result = evaluateTrafficLight({
      runwayMonths: 12,
      customerGrowth: 2, // amber
      milestones: { dueTotal: 10, onTime: 9 },
      settings: settings(),
    });
    expect(result.overall).toBe(AMBER);
  });

  test("no data at all is unknown, not green", () => {
    const result = evaluateTrafficLight({ settings: settings() });
    expect(result.overall).toBe(UNKNOWN);
    expect(result.dimensions.every((d) => d.status === UNKNOWN)).toBe(true);
  });

  test("one known dimension decides even when the others are unknown", () => {
    const result = evaluateTrafficLight({ runwayMonths: 2, settings: settings() });
    expect(result.overall).toBe(RED);
  });
});

describe("the studio's thresholds are used", () => {
  test("raising the runway bar turns a green into amber", () => {
    const strict = settings({ traffic_runway_green_months: 18, traffic_runway_amber_months: 12 });
    expect(byKey(evaluateTrafficLight({ runwayMonths: 12, settings: strict })).runway.status).toBe(AMBER);
  });

  test("a lower milestone bar accepts a lower rate", () => {
    const relaxed = settings({ traffic_milestones_green_pct: 60, traffic_milestones_amber_pct: 40 });
    expect(
      byKey(evaluateTrafficLight({ milestones: { dueTotal: 10, onTime: 6 }, settings: relaxed }))
        .milestones.status,
    ).toBe(GREEN);
  });
});
