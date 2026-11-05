/**
 * PHASE 2 — Venture monthly reporting.
 *
 * Two halves:
 *   1. the PURE engine (validation, money bounds, the fifteen formulas and the
 *      edge cases that decide between a number and `not_applicable`);
 *   2. the LIFECYCLE against an in-memory fake of the repository — draft →
 *      submitted → validated | rejected, versioning, and the recompute window.
 *
 * No database is touched: `@/lib/db` and the reporting store are mocked, so a
 * formula bug can never be committed as a "passing" test.
 */

const mockState = { rows: [], metrics: [], bands: [] };

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(), transaction: jest.fn() },
}));

jest.mock("@/services/ventures/schema", () => ({
  ensureVentureSchema: jest.fn(async () => {}),
}));

const toStr = (value) =>
  value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);

jest.mock("@/models/ventureReportingStore", () => ({
  runInTransaction: jest.fn(async (fn) => fn(jest.fn())),
  selectBands: jest.fn(async () => ({ rows: mockState.bands })),
  // Read when a report is saved: the currency it is filed in is stamped on the row.
  selectCurrentProfile: jest.fn(async () => ({ rows: [{ reporting_currency: "XOF" }] })),
  // Read by getReportingSettings, now that a month carries its due date.
  selectStageSettings: jest.fn(async () => ({ rows: [] })),
  selectGlossary: jest.fn(async () => ({ rows: [] })),
  selectMonthlyReports: jest.fn(async () => ({ rows: mockState.rows.slice() })),
  selectMonthlyReportVersions: jest.fn(async (ventureUuid, period) => ({
    rows: mockState.rows
      .filter((row) => row.venture_uuid === ventureUuid && toStr(row.reporting_period) === period)
      .sort((a, b) => b.version - a.version),
  })),
  selectOpenReport: jest.fn(async (ventureUuid, period) => ({
    rows: mockState.rows
      .filter(
        (row) =>
          row.venture_uuid === ventureUuid &&
          toStr(row.reporting_period) === period &&
          (row.status === "draft" || row.status === "submitted") &&
          !row.superseded_at,
      )
      .sort((a, b) => b.version - a.version)
      .slice(0, 1),
  })),
  selectValidatedReports: jest.fn(async (ventureUuid) => ({
    rows: mockState.rows.filter(
      (row) =>
        row.venture_uuid === ventureUuid && row.status === "validated" && !row.superseded_at,
    ),
  })),
  selectNextReportVersion: jest.fn(async (_query, ventureUuid, period) => {
    const versions = mockState.rows
      .filter((row) => row.venture_uuid === ventureUuid && toStr(row.reporting_period) === period)
      .map((row) => row.version);
    return { rows: [{ next_version: Math.max(0, ...versions) + 1 }] };
  }),
  insertMonthlyReport: jest.fn(async (_query, payload) => {
    const row = {
      id: `report-${mockState.rows.length + 1}`,
      ...payload,
      // The real statements map camelCase arguments onto snake_case columns; the
      // fake must do the same or every read filter would miss these rows.
      venture_uuid: payload.ventureUuid,
      venture_code: payload.ventureCode,
      reporting_period: payload.period,
      submitted_at: null,
      validated_at: null,
      rejected_at: null,
      rejection_reason: null,
      superseded_at: null,
      created_at: new Date(),
    };
    mockState.rows.push(row);
    return { rows: [row] };
  }),
  updateOpenReport: jest.fn(async (_query, id, values) => {
    const row = mockState.rows.find((item) => item.id === id);
    Object.assign(row, values);
    return { rows: [row] };
  }),
  markReportSubmitted: jest.fn(async (_query, id, actorCid) => {
    const row = mockState.rows.find((item) => item.id === id);
    row.status = "submitted";
    row.submitted_at = new Date();
    row.submitted_by = actorCid;
    return { rows: [row] };
  }),
  supersedeValidatedReports: jest.fn(async (_query, { ventureUuid, period }) => {
    for (const row of mockState.rows) {
      if (
        row.venture_uuid === ventureUuid &&
        toStr(row.reporting_period) === period &&
        row.status === "validated" &&
        !row.superseded_at
      ) {
        row.superseded_at = new Date();
      }
    }
    return { rows: [] };
  }),
  markReportValidated: jest.fn(async (_query, id) => {
    const row = mockState.rows.find((item) => item.id === id);
    row.status = "validated";
    row.validated_at = new Date();
    return { rows: [row] };
  }),
  markReportRejected: jest.fn(async (_query, id, { reason }) => {
    const row = mockState.rows.find((item) => item.id === id);
    row.status = "rejected";
    row.rejected_at = new Date();
    row.rejection_reason = reason;
    return { rows: [row] };
  }),
  selectMetrics: jest.fn(async () => ({ rows: mockState.metrics })),
  upsertMetrics: jest.fn(async (_query, payload) => {
    mockState.metrics.push(payload);
    return [];
  }),
}));

const {
  validateMonthlyReport,
  normaliseMoney,
  rowToMonthlyInput,
  monthlyRowValues,
} = require("@/services/ventures/reporting/monthlyRules");
const { computeMonthlyMetrics, moneyBounds, METRIC_KEYS } = require("@/services/ventures/reporting/metrics");
const { groupBands, normalizePeriod, shiftPeriod } = require("@/services/ventures/reporting/rules");
const {
  saveMonthlyReport,
  decideMonthlyReport,
  getMonthlyReport,
} = require("@/services/ventures/reporting/monthly");

// ── Fixtures ───────────────────────────────────────────────────────────────

const BAND_ROWS = [
  { band_kind: "flow", band_code: "F1", sort_order: 1, low: 1, high: 50000, midpoint: 25000.5 },
  { band_kind: "flow", band_code: "F5", sort_order: 5, low: 500001, high: 1000000, midpoint: 750000.5 },
  { band_kind: "cash", band_code: "C3", sort_order: 3, low: 1000001, high: 2500000, midpoint: 1750000.5 },
];

const BANDS = groupBands(BAND_ROWS);

/** A complete, valid monthly input (all money exact unless overridden). */
function monthlyInput(overrides = {}) {
  return {
    period: "2026-08",
    mrrMode: "exact",
    mrrValue: 1000000,
    expensesMode: "exact",
    expensesValue: 500000,
    cashMode: "exact",
    cashValue: 5000000,
    activeUsers: 100,
    payingCustomers: 10,
    newPayingCustomers: 2,
    fullTime: 3,
    fullTimeFounders: 2,
    ...overrides,
  };
}

/** A normalised report, as the metric engine receives it. */
function reportFor(period, overrides = {}) {
  return {
    // The engine speaks normalised periods (2026-08-01), exactly as a DATE
    // column comes back from the driver.
    period: normalizePeriod(period) || period,
    mrr: { mode: "exact", value: 1000000, band: null },
    otherRevenue: { mode: null, value: null, band: null },
    expenses: { mode: "exact", value: 500000, band: null },
    cash: { mode: "exact", value: 5000000, band: null },
    activeUsers: 100,
    payingCustomers: 10,
    newPayingCustomers: 2,
    fullTime: 3,
    partTime: 0,
    partTimeDays: 0,
    fullTimeFounders: 2,
    ...overrides,
  };
}

function historyOf(reports) {
  const map = new Map();
  for (const report of reports) map.set(report.period, report);
  return map;
}

beforeEach(() => {
  mockState.rows = [];
  mockState.metrics = [];
  mockState.bands = BAND_ROWS;
  jest.clearAllMocks();
});

// ── 1. Periods ─────────────────────────────────────────────────────────────

describe("reporting periods", () => {
  test("YYYY-MM and YYYY-MM-DD normalise to the first of the month", () => {
    expect(normalizePeriod("2026-09")).toBe("2026-09-01");
    expect(normalizePeriod("2026-09-17")).toBe("2026-09-01");
  });

  test("nonsense is refused, never guessed", () => {
    expect(normalizePeriod("09/2026")).toBeNull();
    expect(normalizePeriod("2026-13")).toBeNull();
  });

  test("shiftPeriod crosses the year boundary in both directions", () => {
    expect(shiftPeriod("2026-01-01", -1)).toBe("2025-12-01");
    expect(shiftPeriod("2026-12-01", 3)).toBe("2027-03-01");
  });
});

// ── 2. Validation ──────────────────────────────────────────────────────────

describe("monthly submission validation", () => {
  test("a complete submission is accepted", () => {
    expect(validateMonthlyReport(monthlyInput(), { bands: BANDS })).toEqual([]);
  });

  test("a missing required amount is refused", () => {
    const errors = validateMonthlyReport(monthlyInput({ mrrMode: "", mrrValue: "" }), { bands: BANDS });
    expect(errors).toContain("venture.reporting.monthly.validation.mrr");
  });

  test("a band code the studio removed is refused — and so is every band", () => {
    const removed = validateMonthlyReport(
      monthlyInput({ mrrMode: "band", mrrValue: "", mrrBand: "F9" }),
      { bands: BANDS },
    );
    expect(removed).toContain("venture.reporting.validation.bandRemoved");
  });

  test("a known band is refused too: ranges are no longer accepted", () => {
    const errors = validateMonthlyReport(
      monthlyInput({ mrrMode: "band", mrrValue: "", mrrBand: "F1" }),
      { bands: BANDS },
    );
    expect(errors).toContain("venture.reporting.validation.bandRemoved");
  });

  test("zero is an ANSWER; silence is not", () => {
    expect(validateMonthlyReport(monthlyInput({ payingCustomers: 0 }), { bands: BANDS })).toEqual([]);
    expect(validateMonthlyReport(monthlyInput({ payingCustomers: "" }), { bands: BANDS })).toContain(
      "venture.reporting.monthly.validation.payingCustomers",
    );
  });

  test("optional inputs may be omitted entirely", () => {
    const input = monthlyInput();
    delete input.partTime;
    delete input.partTimeDays;
    expect(validateMonthlyReport(input, { bands: BANDS })).toEqual([]);
  });

  test("a negative count is refused", () => {
    expect(validateMonthlyReport(monthlyInput({ activeUsers: -5 }), { bands: BANDS })).toContain(
      "venture.reporting.monthly.validation.activeUsers",
    );
  });
});

// ── 3. Money: exact or band ────────────────────────────────────────────────

describe("money bounds", () => {
  test("an exact amount is a single point, not a range", () => {
    const bounds = moneyBounds({ mode: "exact", value: 1000, band: null }, "flow", BANDS);
    expect(bounds).toEqual({ low: 1000, high: 1000, approximate: false });
  });

  test("a band resolves to its low and high and is approximate", () => {
    expect(moneyBounds({ mode: "band", value: null, band: "F5" }, "flow", BANDS)).toEqual({
      low: 500001,
      high: 1000000,
      approximate: true,
    });
  });

  test("an unanswered field has no bounds at all", () => {
    expect(moneyBounds({ mode: null, value: null, band: null }, "flow", BANDS)).toBeNull();
  });

  test("a cash band is read from the cash ladder, not the flow ladder", () => {
    expect(moneyBounds({ mode: "band", value: null, band: "C3" }, "cash", BANDS).low).toBe(1000001);
    expect(moneyBounds({ mode: "band", value: null, band: "C3" }, "flow", BANDS)).toBeNull();
  });

  test("normaliseMoney reads the flat Phase-1 style keys", () => {
    expect(normaliseMoney({ cashMode: "exact", cashValue: "2500" }, "cash")).toEqual({
      mode: "exact",
      value: 2500,
      band: null,
    });
  });
});

// ── 4. The engine ──────────────────────────────────────────────────────────

describe("monthly metrics", () => {
  test("every metric key is always present", () => {
    const metrics = computeMonthlyMetrics({ report: reportFor("2026-08"), history: new Map(), bands: BANDS });
    expect(Object.keys(metrics).sort()).toEqual([...METRIC_KEYS].sort());
  });

  test("the first month cannot produce churn — and says so instead of zero", () => {
    const metrics = computeMonthlyMetrics({ report: reportFor("2026-08"), history: new Map(), bands: BANDS });
    expect(metrics.lost_customers.status).toBe("not_applicable");
    expect(metrics.churn_rate.status).toBe("not_applicable");
    expect(metrics.retention.status).toBe("not_applicable");
    expect(metrics.customer_lifetime_months.status).toBe("not_applicable");
    expect(metrics.ltv.status).toBe("not_applicable");
    // Revenue never needed history.
    expect(metrics.total_revenue).toEqual({
      status: "computed",
      value: 1000000,
      valueLow: null,
      valueHigh: null,
      approximate: false,
    });
  });

  test("the second month produces the lost/churn/retention chain", () => {
    const first = reportFor("2026-08", { payingCustomers: 10, newPayingCustomers: 2 });
    const second = reportFor("2026-09", { payingCustomers: 9, newPayingCustomers: 1 });
    const metrics = computeMonthlyMetrics({
      report: second,
      history: historyOf([first]),
      bands: BANDS,
    });
    // 10 + 1 − 9 = 2 lost; 2 / 10 = 20% churn; 80% retention.
    expect(metrics.lost_customers.value).toBe(2);
    expect(metrics.churn_rate.value).toBeCloseTo(0.2);
    expect(metrics.retention.value).toBeCloseTo(0.8);
    expect(metrics.customer_lifetime_months.value).toBeCloseTo(5);
    expect(metrics.ltv.value).toBeCloseTo((1000000 / 9) * 5);
  });

  test("zero churn is not-applicable, never Infinity", () => {
    const first = reportFor("2026-08", { payingCustomers: 10 });
    const second = reportFor("2026-09", { payingCustomers: 10, newPayingCustomers: 0 });
    const metrics = computeMonthlyMetrics({ report: second, history: historyOf([first]), bands: BANDS });
    expect(metrics.churn_rate.value).toBe(0);
    expect(metrics.customer_lifetime_months.status).toBe("not_applicable");
    expect(metrics.ltv.status).toBe("not_applicable");
  });

  test("zero paying customers gives no ARPU", () => {
    const metrics = computeMonthlyMetrics({
      report: reportFor("2026-08", { payingCustomers: 0, newPayingCustomers: 0 }),
      history: new Map(),
      bands: BANDS,
    });
    expect(metrics.arpu.status).toBe("not_applicable");
  });

  test("zero active users gives no user-to-paid ratio", () => {
    const metrics = computeMonthlyMetrics({
      report: reportFor("2026-08", { activeUsers: 0 }),
      history: new Map(),
      bands: BANDS,
    });
    expect(metrics.user_to_paid.status).toBe("not_applicable");
  });

  test("three-month growth needs the count three months back", () => {
    const june = reportFor("2026-06", { payingCustomers: 8 });
    const july = reportFor("2026-07", { payingCustomers: 9 });
    const august = reportFor("2026-08", { payingCustomers: 10 });
    const september = reportFor("2026-09", { payingCustomers: 11 });

    // August looks back to MAY, which does not exist yet.
    const augustMetrics = computeMonthlyMetrics({
      report: august,
      history: historyOf([june, july]),
      bands: BANDS,
    });
    expect(augustMetrics.customer_growth_3m.status).toBe("not_applicable");

    // September looks back to JUNE, so it can finally be calculated.
    const septemberMetrics = computeMonthlyMetrics({
      report: september,
      history: historyOf([june, july, august]),
      bands: BANDS,
    });
    expect(septemberMetrics.customer_growth_3m.value).toBeCloseTo(Math.pow(11 / 8, 1 / 3) - 1);
  });

  test("net burn can be negative when revenue exceeds expenses", () => {
    const metrics = computeMonthlyMetrics({
      report: reportFor("2026-08", {
        mrr: { mode: "exact", value: 2000000, band: null },
        expenses: { mode: "exact", value: 500000, band: null },
      }),
      history: new Map(),
      bands: BANDS,
    });
    expect(metrics.net_burn.value).toBe(-1500000);
  });

  test("a venture that is not burning is self-sustaining on runway", () => {
    const months = ["2026-06", "2026-07", "2026-08"].map((period) =>
      reportFor(period, {
        mrr: { mode: "exact", value: 2000000, band: null },
        expenses: { mode: "exact", value: 500000, band: null },
      }),
    );
    const metrics = computeMonthlyMetrics({
      report: months[2],
      history: historyOf(months.slice(0, 2)),
      bands: BANDS,
    });
    expect(metrics.average_burn.status).toBe("computed");
    expect(metrics.runway_months.status).toBe("self_sustaining");
    expect(metrics.runway_months.value).toBeNull();
  });

  test("average burn needs three months", () => {
    const august = reportFor("2026-08");
    const september = reportFor("2026-09");
    const metrics = computeMonthlyMetrics({
      report: september,
      history: historyOf([august]),
      bands: BANDS,
    });
    expect(metrics.average_burn.status).toBe("not_applicable");
    expect(metrics.runway_months.status).toBe("not_applicable");
  });

  test("band money becomes a range, and runway uses the conservative end", () => {
    const make = (period) =>
      reportFor(period, {
        mrr: { mode: "band", value: null, band: "F1" },
        expenses: { mode: "band", value: null, band: "F5" },
        cash: { mode: "band", value: null, band: "C3" },
      });
    const months = ["2026-06", "2026-07", "2026-08"].map(make);
    const metrics = computeMonthlyMetrics({
      report: months[2],
      history: historyOf(months.slice(0, 2)),
      bands: BANDS,
    });
    expect(metrics.runway_months.status).toBe("computed");
    expect(metrics.runway_months.approximate).toBe(true);
    // conservative end = cash low ÷ burn high
    expect(metrics.runway_months.value).toBeCloseTo(1000001 / 999999);
    expect(metrics.runway_months.valueLow).toBeLessThan(metrics.runway_months.valueHigh);
  });

  test("FTE follows the 20-day standard", () => {
    const metrics = computeMonthlyMetrics({
      report: reportFor("2026-08", { fullTime: 3, partTimeDays: 40, fullTimeFounders: 2 }),
      history: new Map(),
      bands: BANDS,
    });
    expect(metrics.fte.value).toBe(7);
  });

  test("other revenue is added to MRR, and an absent optional is zero", () => {
    const withOther = computeMonthlyMetrics({
      report: reportFor("2026-08", {
        otherRevenue: { mode: "exact", value: 250000, band: null },
      }),
      history: new Map(),
      bands: BANDS,
    });
    expect(withOther.total_revenue.value).toBe(1250000);

    const without = computeMonthlyMetrics({
      report: reportFor("2026-08"),
      history: new Map(),
      bands: BANDS,
    });
    expect(without.total_revenue.value).toBe(1000000);
  });

  test("a metric derived from a band is flagged approximate", () => {
    const first = reportFor("2026-08", { payingCustomers: 10 });
    const second = reportFor("2026-09", {
      payingCustomers: 9,
      newPayingCustomers: 0,
      mrr: { mode: "band", value: null, band: "F1" },
    });
    const metrics = computeMonthlyMetrics({ report: second, history: historyOf([first]), bands: BANDS });
    expect(metrics.arpu.approximate).toBe(true);
    expect(metrics.arpu.valueLow).toBe(1 / 9);
    expect(metrics.arpu.valueHigh).toBe(50000 / 9);
  });
});

// ── 5. Lifecycle ───────────────────────────────────────────────────────────

describe("report lifecycle", () => {
  const VENTURE = { ventureUuid: "11111111-1111-1111-1111-111111111111", ventureCode: "VNT-TEST" };

  test("the first save is version 1 in draft", async () => {
    const result = await saveMonthlyReport({ ...VENTURE, actorCid: "C1", input: monthlyInput() });
    expect(result.errors).toBeUndefined();
    expect(result.report.version).toBe(1);
    expect(result.report.status).toBe("draft");
  });

  test("the currency in force when the month is filed is recorded on the row", async () => {
    const store = jest.requireMock("@/models/ventureReportingStore");
    store.selectCurrentProfile.mockResolvedValueOnce({ rows: [{ reporting_currency: "usd" }] });

    const result = await saveMonthlyReport({ ...VENTURE, actorCid: "C1", input: monthlyInput() });

    // Stamped from the Venture's setting, normalized — and carried back to the UI.
    expect(result.report.currency).toBe("USD");
  });

  test("submitting moves it to submitted and stamps the date", async () => {
    const result = await saveMonthlyReport({
      ...VENTURE,
      actorCid: "C1",
      input: { ...monthlyInput(), submit: true },
    });
    expect(result.report.status).toBe("submitted");
    expect(result.report.submittedAt).toBeTruthy();
  });

  test("a submitted report is frozen — no silent edit under review", async () => {
    await saveMonthlyReport({ ...VENTURE, actorCid: "C1", input: { ...monthlyInput(), submit: true } });
    const second = await saveMonthlyReport({ ...VENTURE, actorCid: "C1", input: monthlyInput() });
    expect(second.errors).toContain("venture.reporting.monthly.validation.alreadySubmitted");
  });

  test("a draft is edited in place, not versioned", async () => {
    await saveMonthlyReport({ ...VENTURE, actorCid: "C1", input: monthlyInput() });
    const second = await saveMonthlyReport({
      ...VENTURE,
      actorCid: "C1",
      input: monthlyInput({ payingCustomers: 12 }),
    });
    expect(second.report.version).toBe(1);
    expect(second.report.payingCustomers).toBe(12);
    expect(mockState.rows).toHaveLength(1);
  });

  test("a future month is refused", async () => {
    const future = new Date();
    future.setUTCMonth(future.getUTCMonth() + 2);
    const period = `${future.getUTCFullYear()}-${String(future.getUTCMonth() + 1).padStart(2, "0")}`;
    const result = await saveMonthlyReport({
      ...VENTURE,
      actorCid: "C1",
      input: monthlyInput({ period }),
    });
    expect(result.errors).toContain("venture.reporting.monthly.validation.futurePeriod");
  });

  test("validating writes metrics for the month", async () => {
    await saveMonthlyReport({ ...VENTURE, actorCid: "C1", input: { ...monthlyInput(), submit: true } });
    const decision = await decideMonthlyReport({
      ...VENTURE,
      actorCid: "C2",
      input: { period: "2026-08", action: "validate" },
    });
    expect(decision.errors).toBeUndefined();
    expect(decision.report.status).toBe("validated");
    expect(decision.metrics).toHaveLength(1);
    expect(decision.metrics[0].period).toBe("2026-08-01");
    expect(mockState.metrics[0].metrics.total_revenue.value).toBe(1000000);
  });

  test("a rejection requires a reason and closes the report", async () => {
    await saveMonthlyReport({ ...VENTURE, actorCid: "C1", input: { ...monthlyInput(), submit: true } });

    const noReason = await decideMonthlyReport({
      ...VENTURE,
      actorCid: "C2",
      input: { period: "2026-08", action: "reject" },
    });
    expect(noReason.errors).toContain("venture.reporting.monthly.validation.reason");

    const rejected = await decideMonthlyReport({
      ...VENTURE,
      actorCid: "C2",
      input: { period: "2026-08", action: "reject", reason: "Figures do not match the bank statement" },
    });
    expect(rejected.report.status).toBe("rejected");
    expect(rejected.report.rejectionReason).toContain("bank statement");
  });

  test("a rejected month is corrected as a NEW version, keeping the refusal", async () => {
    await saveMonthlyReport({ ...VENTURE, actorCid: "C1", input: { ...monthlyInput(), submit: true } });
    await decideMonthlyReport({
      ...VENTURE,
      actorCid: "C2",
      input: { period: "2026-08", action: "reject", reason: "Missing invoices" },
    });

    const corrected = await saveMonthlyReport({
      ...VENTURE,
      actorCid: "C1",
      input: monthlyInput({ payingCustomers: 14 }),
    });
    expect(corrected.report.version).toBe(2);
    expect(corrected.report.status).toBe("draft");
    expect(mockState.rows.find((row) => row.version === 1).status).toBe("rejected");
  });

  test("a correction after validation supersedes the old truth, never overwrites it", async () => {
    await saveMonthlyReport({ ...VENTURE, actorCid: "C1", input: { ...monthlyInput(), submit: true } });
    await decideMonthlyReport({
      ...VENTURE,
      actorCid: "C2",
      input: { period: "2026-08", action: "validate" },
    });

    const correction = await saveMonthlyReport({
      ...VENTURE,
      actorCid: "C1",
      input: { ...monthlyInput({ payingCustomers: 30 }), submit: true },
    });
    expect(correction.report.version).toBe(2);

    const second = await decideMonthlyReport({
      ...VENTURE,
      actorCid: "C2",
      input: { period: "2026-08", action: "validate" },
    });
    expect(second.errors).toBeUndefined();

    const live = mockState.rows.filter((row) => row.status === "validated" && !row.superseded_at);
    expect(live).toHaveLength(1);
    expect(live[0].version).toBe(2);
    expect(mockState.rows.find((row) => row.version === 1).superseded_at).toBeTruthy();
  });

  test("only a submitted report can be decided on", async () => {
    const result = await decideMonthlyReport({
      ...VENTURE,
      actorCid: "C2",
      input: { period: "2026-08", action: "validate" },
    });
    expect(result.errors).toContain("venture.reporting.monthly.validation.notSubmitted");
  });

  test("an invalid action is refused", async () => {
    const result = await decideMonthlyReport({
      ...VENTURE,
      actorCid: "C2",
      input: { period: "2026-08", action: "approve" },
    });
    expect(result.errors).toContain("venture.reporting.monthly.validation.action");
  });

  test("validating an earlier month recomputes the months that read it", async () => {
    // September is submitted AND validated first, then August arrives. Before
    // August exists September has no previous month, so its churn is
    // not-applicable. Validating August must rewrite September — otherwise the
    // dashboard would keep a stale "not applicable" forever.
    for (const period of ["2026-09", "2026-08"]) {
      await saveMonthlyReport({
        ...VENTURE,
        actorCid: "C1",
        input: { ...monthlyInput({ period }), submit: true },
      });
    }

    const septemberFirst = await decideMonthlyReport({
      ...VENTURE,
      actorCid: "C2",
      input: { period: "2026-09", action: "validate" },
    });
    expect(septemberFirst.metrics[0].metrics.churn_rate.status).toBe("not_applicable");

    const augustDecision = await decideMonthlyReport({
      ...VENTURE,
      actorCid: "C2",
      input: { period: "2026-08", action: "validate" },
    });

    const touched = augustDecision.metrics.map((entry) => entry.period);
    expect(touched).toContain("2026-08-01");
    expect(touched).toContain("2026-09-01");

    const september = augustDecision.metrics.find((entry) => entry.period === "2026-09-01");
    expect(september.metrics.churn_rate.status).toBe("computed");
  });

  test("the preview of a draft is computed but never stored", async () => {
    await saveMonthlyReport({ ...VENTURE, actorCid: "C1", input: monthlyInput() });
    const detail = await getMonthlyReport({ ventureUuid: VENTURE.ventureUuid, period: "2026-08" });
    expect(detail.preview).toBeTruthy();
    expect(detail.preview.total_revenue.value).toBe(1000000);
    expect(mockState.metrics).toHaveLength(0);
  });
});

// ── 6. Row shapes ──────────────────────────────────────────────────────────

describe("stored row normalisation", () => {
  test("an unanswered column stays null, never zero", () => {
    const input = rowToMonthlyInput({
      reporting_period: "2026-08-01",
      paying_customers: null,
      active_users: 0,
      mrr_mode: null,
      mrr_value: null,
      mrr_band: null,
    });
    expect(input.payingCustomers).toBeNull();
    expect(input.activeUsers).toBe(0);
    expect(input.mrr.mode).toBeNull();
  });

  test("monthlyRowValues maps the flat inputs onto columns", () => {
    const values = monthlyRowValues({
      input: monthlyInput({ mrrMode: "band", mrrValue: "", mrrBand: "F1" }),
      actorCid: "C1",
    });
    expect(values.mrr_mode).toBe("band");
    expect(values.mrr_band).toBe("F1");
    expect(values.mrr_value).toBeNull();
    expect(values.created_by).toBe("C1");
  });
});
