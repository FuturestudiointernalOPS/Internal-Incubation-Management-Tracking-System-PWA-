/**
 * PHASE 3b — the quarterly report.
 *
 * Pure tests for the quarter arithmetic (spec §9.1) and the derived metrics
 * (§9.3). The lifecycle is structurally identical to the monthly one, whose
 * suite already proves draft → submitted → validated → supersede.
 */

const {
  normalizeQuarter,
  quarterMonths,
  monthBeforeQuarter,
  validateQuarterlyReport,
  quarterlyRowValues,
  TOP3_SHARE_BANDS,
} = require("@/services/ventures/reporting/quarterlyRules");
const { computeQuarterlyMetrics, QUARTERLY_METRIC_KEYS } = require("@/services/ventures/reporting/quarterlyMetrics");

const BANDS = {
  flow: [
    { code: "F1", low: 1, high: 50000, midpoint: 25000.5 },
    { code: "F5", low: 500001, high: 1000000, midpoint: 750000.5 },
  ],
  cash: [],
};

// ── Quarters ───────────────────────────────────────────────────────────────

describe("quarter arithmetic", () => {
  test("Q notation snaps to the quarter's first day", () => {
    expect(normalizeQuarter("2026-Q4")).toBe("2026-10-01");
    expect(normalizeQuarter("2026-Q1")).toBe("2026-01-01");
  });

  test("a month is accepted and snapped to its quarter", () => {
    expect(normalizeQuarter("2026-02")).toBe("2026-01-01");
    expect(normalizeQuarter("2026-11")).toBe("2026-10-01");
  });

  test("nonsense is refused", () => {
    expect(normalizeQuarter("Q4")).toBeNull();
    expect(normalizeQuarter("2026-Q5")).toBeNull();
  });

  test("the three months and the opening month are explicit", () => {
    expect(quarterMonths("2026-10-01")).toEqual(["2026-10-01", "2026-11-01", "2026-12-01"]);
    expect(monthBeforeQuarter("2026-10-01")).toBe("2026-09-01");
    expect(monthBeforeQuarter("2026-01-01")).toBe("2025-12-01");
  });
});

// ── Validation ─────────────────────────────────────────────────────────────

describe("quarterly validation", () => {
  test("a blank quarter is valid — unanswered is not invalid", () => {
    expect(validateQuarterlyReport({}, { bands: BANDS })).toEqual([]);
  });

  test("more milestones hit than planned is impossible", () => {
    expect(
      validateQuarterlyReport({ mvpMilestonesPlanned: 4, mvpMilestonesHit: 6 }, { bands: BANDS }),
    ).toContain("venture.reporting.quarterly.validation.milestonesOverPlanned");
  });

  test("more pilots converted than signed is impossible", () => {
    expect(
      validateQuarterlyReport({ pilotsSigned: 2, pilotsConverted: 3 }, { bands: BANDS }),
    ).toContain("venture.reporting.quarterly.validation.pilotsOverSigned");
  });

  test("an unknown band is refused", () => {
    expect(
      validateQuarterlyReport(
        { salesMarketingMode: "band", salesMarketingBand: "F9" },
        { bands: BANDS },
      ),
    ).toContain("venture.reporting.quarterly.validation.salesMarketingBand");
  });

  test("a negative count is refused", () => {
    expect(validateQuarterlyReport({ openDeals: -1 }, { bands: BANDS })).toContain(
      "venture.reporting.quarterly.validation.openDeals",
    );
  });

  test("a bad share band is refused", () => {
    expect(validateQuarterlyReport({ top3ShareBand: "most" }, { bands: BANDS })).toContain(
      "venture.reporting.quarterly.validation.top3Share",
    );
    expect(TOP3_SHARE_BANDS).toContain("30_60");
  });

  test("a band answer keeps the band and drops the amount", () => {
    const values = quarterlyRowValues({
      input: {
        salesMarketingMode: "band",
        salesMarketingBand: "F5",
        salesMarketingValue: 999,
      },
    });
    expect(values.sales_marketing_mode).toBe("band");
    expect(values.sales_marketing_band).toBe("F5");
    expect(values.sales_marketing_value).toBeNull();
  });
});

// ── Metrics ────────────────────────────────────────────────────────────────

const metric = (value) => ({ status: "computed", value });

function monthlyInput(period, { paying, mrr, newPaying }) {
  return {
    period,
    mrr: { mode: "exact", value: mrr, band: null },
    otherRevenue: { mode: null, value: null, band: null },
    expenses: { mode: "exact", value: 100000, band: null },
    cash: { mode: "exact", value: 1000000, band: null },
    payingCustomers: paying,
    newPayingCustomers: newPaying,
  };
}

const REPORTS = new Map([
  ["2026-06-01", monthlyInput("2026-06-01", { paying: 60, mrr: 400000, newPaying: 5 })],
  ["2026-07-01", monthlyInput("2026-07-01", { paying: 70, mrr: 500000, newPaying: 10 })],
  ["2026-08-01", monthlyInput("2026-08-01", { paying: 80, mrr: 600000, newPaying: 10 })],
  ["2026-09-01", monthlyInput("2026-09-01", { paying: 90, mrr: 700000, newPaying: 10 })],
]);

const METRICS = new Map([
  ["2026-06-01", { arpu: metric(400000 / 60) }],
  ["2026-07-01", { retention: metric(0.9), net_burn: metric(100000) }],
  ["2026-08-01", { retention: metric(0.9), net_burn: metric(100000) }],
  [
    "2026-09-01",
    {
      retention: metric(0.9),
      net_burn: metric(100000),
      runway_months: metric(12),
      ltv: metric(50000),
      arpu: metric(700000 / 90),
    },
  ],
]);

const QUARTERLY = {
  period: "2026-07-01",
  salesMarketing: { mode: "exact", value: 300000, band: null },
  pilotsSigned: 4,
  pilotsConverted: 3,
  mvpMilestonesPlanned: 10,
  mvpMilestonesHit: 8,
  expansion: { mode: "exact", value: 100000, band: null },
  churned: { mode: "exact", value: 50000, band: null },
};

const compute = (overrides = {}) =>
  computeQuarterlyMetrics({
    report: { ...QUARTERLY, ...overrides },
    reportsByPeriod: REPORTS,
    metricsByPeriod: METRICS,
    bands: BANDS,
  });

describe("quarterly metrics", () => {
  test("every key is always present", () => {
    const out = compute();
    expect(Object.keys(out).sort()).toEqual([...QUARTERLY_METRIC_KEYS].sort());
  });

  test("net new customers and net new MRR span the quarter, not the months", () => {
    const out = compute();
    expect(out.net_new_customers.value).toBe(30);
    expect(out.net_new_mrr.value).toBe(300000);
  });

  test("average retention averages the months that computed one", () => {
    expect(compute().average_retention.value).toBeCloseTo(0.9);
  });

  test("burn multiple divides the quarter's burn by its new MRR", () => {
    // 3 × 100 000 burn ÷ 300 000 net new MRR
    expect(compute().burn_multiple.value).toBeCloseTo(1);
  });

  test("CAC divides spend by the customers acquired in the quarter", () => {
    // 300 000 ÷ (10 + 10 + 10)
    expect(compute().cac.value).toBe(10000);
  });

  test("CAC payback and LTV:CAC use the quarter-end ARPU and LTV", () => {
    const out = compute();
    expect(out.cac_payback_months.value).toBeCloseTo(10000 / (700000 / 90));
    expect(out.ltv_cac.value).toBeCloseTo(5);
  });

  test("pilot-to-paid and MVP on-time are simple ratios", () => {
    const out = compute();
    expect(out.pilot_to_paid.value).toBeCloseTo(0.75);
    expect(out.mvp_on_time.value).toBeCloseTo(0.8);
  });

  test("NRR adds expansion and removes churn from the opening MRR", () => {
    expect(compute().nrr.value).toBeCloseTo(1.125);
  });

  test("ARPU trend is the change across the quarter", () => {
    expect(compute().arpu_trend.value).toBeCloseTo(700000 / 90 - 400000 / 60);
  });

  test("a venture that added no MRR has no burn multiple", () => {
    const flat = new Map(REPORTS);
    flat.set("2026-09-01", monthlyInput("2026-09-01", { paying: 90, mrr: 400000, newPaying: 10 }));
    const out = computeQuarterlyMetrics({
      report: QUARTERLY,
      reportsByPeriod: flat,
      metricsByPeriod: METRICS,
      bands: BANDS,
    });
    expect(out.burn_multiple.status).toBe("not_applicable");
  });

  test("missing monthly months leave the figures not applicable, never zero", () => {
    const out = computeQuarterlyMetrics({
      report: QUARTERLY,
      reportsByPeriod: new Map(),
      metricsByPeriod: new Map(),
      bands: BANDS,
    });
    expect(out.net_new_customers.status).toBe("not_applicable");
    expect(out.average_retention.status).toBe("not_applicable");
    expect(out.cac.status).toBe("not_applicable");
    expect(out.nrr.status).toBe("not_applicable");
  });

  test("a band-derived figure is marked approximate", () => {
    const out = compute({
      salesMarketing: { mode: "band", value: null, band: "F5" },
    });
    expect(out.cac.approximate).toBe(true);
    // 750 000.5 midpoint ÷ 30 new customers
    expect(out.cac.value).toBeCloseTo(750000.5 / 30);
  });

  test("pilot-to-paid needs a signed count, not just a converted one", () => {
    const out = compute({ pilotsSigned: 0 });
    expect(out.pilot_to_paid.status).toBe("not_applicable");
  });
});
