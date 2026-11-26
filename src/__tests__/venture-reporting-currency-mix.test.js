/**
 * PHASE 0 — a metric may not span two currencies.
 *
 * The engine compares money from different months (growth, average burn running
 * into runway, yearly totals). It used to do that numerically only, so a venture
 * that switched reporting currency got a figure dividing CFA by dollars. These
 * tests pin the guard: the same unit computes, a different unit is
 * `not_applicable`, and an UNSTAMPED month (legacy) is treated as compatible.
 *
 * Periods are normalised (`YYYY-MM-01`) because the engine shifts them with
 * `shiftPeriod`, which always returns a full date.
 */

const { computeMonthlyMetrics } = require("@/services/ventures/reporting/metrics");
const { computeYearlyFigures } = require("@/services/ventures/reporting/yearly");

const reportFor = (period, overrides = {}) => ({
  period,
  currency: "XOF",
  mrr: { mode: "exact", value: 1_000_000, band: null },
  otherRevenue: { mode: "", value: null, band: null },
  // Expenses above revenue on purpose: a positive net burn is what gives runway
  // a value (a profitable month is `self_sustaining`, not a number of months).
  expenses: { mode: "exact", value: 1_600_000, band: null },
  cash: { mode: "exact", value: 9_000_000, band: null },
  payingCustomers: 10,
  newPayingCustomers: 2,
  activeUsers: 30,
  fullTime: 2,
  partTime: 0,
  partTimeDays: 0,
  fullTimeFounders: 1,
  ...overrides,
});

const metricsFor = (report, others) =>
  computeMonthlyMetrics({
    report,
    history: new Map(others.map((entry) => [entry.period, entry])),
    bands: {},
  });

describe("monthly metrics across a currency change", () => {
  test("one currency computes growth, average burn and runway", () => {
    const dec = reportFor("2025-12-01");
    const jan = reportFor("2026-01-01");
    const feb = reportFor("2026-02-01");
    const mar = reportFor("2026-03-01");

    const metrics = metricsFor(mar, [dec, jan, feb]);

    expect(metrics.mrr_growth_mom.status).toBe("computed");
    expect(metrics.mrr_growth_3m.status).toBe("computed");
    expect(metrics.average_burn.status).toBe("computed");
    expect(metrics.runway_months.status).toBe("computed");
  });

  test("a previous month in another currency withholds the window", () => {
    const jan = reportFor("2026-01-01", { currency: "USD" });
    const feb = reportFor("2026-02-01");
    const mar = reportFor("2026-03-01");

    const metrics = metricsFor(mar, [jan, feb]);

    // The 3-month burn window spans USD (Jan) → XOF (Mar).
    expect(metrics.average_burn.status).toBe("not_applicable");
    expect(metrics.runway_months.status).toBe("not_applicable");
    // Month-on-month is XOF vs XOF, so it stands.
    expect(metrics.mrr_growth_mom.status).toBe("computed");
    // Single-month figures never cross a boundary.
    expect(metrics.total_revenue.status).toBe("computed");
    expect(metrics.net_burn.status).toBe("computed");
  });

  test("a base three months back in another currency withholds only that growth", () => {
    const dec = reportFor("2025-12-01", { currency: "USD" });
    const jan = reportFor("2026-01-01");
    const feb = reportFor("2026-02-01");
    const mar = reportFor("2026-03-01");

    const metrics = metricsFor(mar, [dec, jan, feb]);

    expect(metrics.mrr_growth_3m.status).toBe("not_applicable");
    expect(metrics.mrr_growth_mom.status).toBe("computed");
    // The burn window (Jan–Mar) is one currency.
    expect(metrics.average_burn.status).toBe("computed");
  });

  test("an unstamped legacy month is unknown, not different", () => {
    const jan = reportFor("2026-01-01", { currency: null });
    const feb = reportFor("2026-02-01");
    const mar = reportFor("2026-03-01");

    const metrics = metricsFor(mar, [jan, feb]);

    expect(metrics.average_burn.status).toBe("computed");
    expect(metrics.mrr_growth_mom.status).toBe("computed");
  });

  test("currency comparison ignores case", () => {
    const feb = reportFor("2026-02-01", { currency: "xof" });
    const mar = reportFor("2026-03-01", { currency: "XOF" });
    expect(metricsFor(mar, [feb]).mrr_growth_mom.status).toBe("computed");
  });
});

describe("yearly roll-ups across a currency change", () => {
  const monthsAgo = (n) => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - n, 1))
      .toISOString()
      .slice(0, 10);
  };

  const month = (n, extra = {}) => ({
    period: monthsAgo(n),
    currency: "XOF",
    mrrValue: 1_000_000,
    payingCustomers: 10,
    netBurn: 500_000,
    ...extra,
  });

  test("a single currency rolls up", () => {
    const figures = computeYearlyFigures({
      months: [month(13), month(1)],
      latestPeriod: monthsAgo(1),
    });
    expect(figures.yoyMrrGrowth).not.toBeNull();
    expect(figures.annualBurn).not.toBeNull();
  });

  test("a currency change inside the window withholds the money totals only", () => {
    const figures = computeYearlyFigures({
      months: [month(13, { currency: "USD" }), month(1)],
      latestPeriod: monthsAgo(1),
    });
    expect(figures.yoyMrrGrowth).toBeNull();
    expect(figures.annualBurn).toBeNull();
    // Customer counts are currency-free and must survive.
    expect(figures.annualCustomerGrowth).not.toBeNull();
  });
});
