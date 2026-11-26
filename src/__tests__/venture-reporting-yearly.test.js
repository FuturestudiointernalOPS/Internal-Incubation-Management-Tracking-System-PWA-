/**
 * PHASE 6b — yearly roll-ups (spec §10). Pure.
 *
 * Nobody types these figures: they are rolled up from the validated months.
 * The properties worth protecting:
 *   • a missing base yields `null`, never 0 or Infinity;
 *   • the window is the trailing 12 months and the comparison is the 12 before it;
 *   • survival measures the AGE AT WHICH a venture ended, not the time since.
 */

const {
  growthBetween,
  computeYearlyFigures,
  monthsBetween,
  survivalAt,
  timeInStages,
} = require("@/services/ventures/reporting/yearly");

/** A UTC date `n` months ago, on day 1 so short months cannot roll over. */
const monthsAgo = (n) => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - n, 1));
};

describe("growthBetween", () => {
  test("is the relative change between two totals", () => {
    expect(growthBetween(200, 100)).toBe(1);
    expect(growthBetween(50, 100)).toBe(-0.5);
    expect(growthBetween(100, 100)).toBe(0);
  });

  test("a non-positive base is not applicable rather than infinite", () => {
    expect(growthBetween(100, 0)).toBeNull();
    expect(growthBetween(100, -5)).toBeNull();
  });

  test("a missing side is not applicable", () => {
    expect(growthBetween(null, 100)).toBeNull();
    expect(growthBetween(100, null)).toBeNull();
  });
});

describe("monthsBetween", () => {
  test("counts whole calendar months", () => {
    expect(monthsBetween("2024-01-15", "2025-01-20")).toBe(12);
    expect(monthsBetween("2025-01-01", "2025-04-01")).toBe(3);
  });

  test("never goes negative and rejects an invalid date", () => {
    expect(monthsBetween("2025-01-01", "2024-01-01")).toBe(0);
    expect(monthsBetween(null)).toBeNull();
    expect(monthsBetween("not-a-date")).toBeNull();
  });
});

describe("computeYearlyFigures", () => {
  const latestPeriod = "2026-12-01";

  const months = [
    { period: "2025-12-01", mrrValue: 100, payingCustomers: 10, netBurn: 40 },
    { period: "2026-12-01", mrrValue: 300, payingCustomers: 30, netBurn: 60 },
  ];

  test("compares the trailing 12 months against the 12 before", () => {
    const figures = computeYearlyFigures({
      months,
      latestPeriod,
      latestFte: 4,
      baselineFte: 1,
    });

    // window MRR = 300 (2026-12 only) vs prior = 100 (2025-12 only)
    expect(figures.yoyMrrGrowth).toBe(2);
    expect(figures.annualCustomerGrowth).toBe(2);
    // trailing 12 months only: 2026-12 (60). 2025-12 belongs to the prior window.
    expect(figures.annualBurn).toBe(60);
    expect(figures.jobsSupported).toBe(4);
    expect(figures.jobsCreated).toBe(3);
  });

  test("only known months contribute to a sum", () => {
    const figures = computeYearlyFigures({
      months: [{ period: "2026-12-01", mrrValue: 300, payingCustomers: 30, netBurn: 60 }],
      latestPeriod,
    });

    expect(figures.annualBurn).toBe(60);
    // no prior year at all → the base is missing, not zero
    expect(figures.yoyMrrGrowth).toBeNull();
    expect(figures.annualCustomerGrowth).toBeNull();
  });

  test("without a validated period everything is not applicable", () => {
    const figures = computeYearlyFigures({ months: [], latestPeriod: null, latestFte: null });

    expect(figures.monthsCovered).toBe(0);
    expect(figures.yoyMrrGrowth).toBeNull();
    expect(figures.annualCustomerGrowth).toBeNull();
    expect(figures.annualBurn).toBeNull();
    expect(figures.jobsSupported).toBeNull();
    expect(figures.jobsCreated).toBeNull();
  });

  test("jobs created needs both the current FTE and the locked baseline", () => {
    expect(
      computeYearlyFigures({ months, latestPeriod, latestFte: 4, baselineFte: null }).jobsCreated,
    ).toBeNull();
    expect(
      computeYearlyFigures({ months, latestPeriod, latestFte: null, baselineFte: 1 }).jobsCreated,
    ).toBeNull();
  });
});

describe("survivalAt", () => {
  test("is not applicable before the milestone and with no age", () => {
    expect(survivalAt(null, [])).toEqual({ m12: null, m24: null, m36: null });
    expect(survivalAt(6, [])).toEqual({ m12: null, m24: null, m36: null });
  });

  test("an active venture survives every milestone it has reached", () => {
    expect(survivalAt(30, [])).toEqual({ m12: true, m24: true, m36: null });
    expect(survivalAt(40, [])).toEqual({ m12: true, m24: true, m36: true });
  });

  test("a venture that ended young did not survive", () => {
    // 30 months old, terminated 25 months ago → it ended at age 5
    const result = survivalAt(30, [{ status: "terminated", date: monthsAgo(25) }]);
    expect(result).toEqual({ m12: false, m24: false, m36: null });
  });

  test("a venture that ended after the milestone did survive", () => {
    // 30 months old, terminated 2 months ago → it ended at age 28
    const result = survivalAt(30, [{ status: "sold", date: monthsAgo(2) }]);
    expect(result).toEqual({ m12: true, m24: true, m36: null });
  });
});

describe("timeInStages", () => {
  test("measures each stage up to the next change, and the last one up to now", () => {
    const rows = timeInStages(
      [
        { toStage: "idea", decidedAt: "2025-01-01" },
        { toStage: "validation", decidedAt: "2025-03-01" },
      ],
      new Date("2025-04-01T00:00:00Z"),
    );

    expect(rows).toEqual([
      { stage: "idea", days: 59 },
      { stage: "validation", days: 31 },
    ]);
  });

  test("history without a stage is ignored", () => {
    expect(timeInStages([], new Date())).toEqual([]);
    expect(timeInStages([{ decidedAt: "2025-01-01" }], new Date())).toEqual([]);
  });
});
