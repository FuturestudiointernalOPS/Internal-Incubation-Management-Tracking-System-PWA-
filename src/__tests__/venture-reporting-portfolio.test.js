/**
 * PHASE 6b — portfolio roll-ups (spec §14) and reporting discipline (§13.9).
 *
 * The store is mocked: these tests protect the FOLD, not the SQL. The three
 * properties worth protecting are the same ones the rest of the engine keeps:
 *
 *   • a Venture too young to judge is not a failure (`null`, not `false`);
 *   • a band-derived amount stays flagged approximate in the total;
 *   • a period is only due once its deadline has passed.
 */

jest.mock("@/services/ventures/reporting/settings", () => ({
  ensureReportingSchema: jest.fn(async () => undefined),
  getReportingSettings: jest.fn(async () => ({
    settings: {
      traffic_runway_green_months: 9,
      traffic_runway_amber_months: 4,
      traffic_growth_green_pct: 5,
      traffic_growth_amber_pct: 0,
      traffic_milestones_green_pct: 80,
      traffic_milestones_amber_pct: 50,
    },
    bands: { flow: [{ code: "F2", low: 50001, high: 100000 }], cash: [] },
  })),
}));

jest.mock("@/models/ventureReportingStore", () => ({
  selectPortfolioVentures: jest.fn(),
  selectPortfolioFirstPayingMonth: jest.fn(),
  selectPortfolioLatestMonths: jest.fn(),
  selectPortfolioLatestMetrics: jest.fn(),
  selectPortfolioLatestTeams: jest.fn(),
  selectPortfolioBaselines: jest.fn(),
  selectPortfolioFinancingEvents: jest.fn(),
  selectPortfolioStageHistory: jest.fn(),
  selectPortfolioStatusEvents: jest.fn(),
  selectPortfolioMilestoneStats: jest.fn(),
  selectPortfolioMonthlyRows: jest.fn(),
  selectPortfolioQuarterlyRows: jest.fn(),
}));

const store = require("@/models/ventureReportingStore");
const { getPortfolioRollup } = require("@/services/ventures/reporting/portfolio");
const {
  evaluateReportingDiscipline,
  monthlyPeriods,
  quarterlyPeriods,
} = require("@/services/ventures/reporting/discipline");

const NOW = new Date("2026-11-03T12:00:00Z");

const empty = { rows: [] };

/** Every store function answers `{rows: []}` unless the test says otherwise. */
function primeStore(overrides = {}) {
  for (const name of Object.keys(store)) {
    if (typeof store[name]?.mockReset === "function") {
      store[name].mockReset();
      store[name].mockResolvedValue(empty);
    }
  }
  for (const [name, rows] of Object.entries(overrides)) {
    store[name].mockResolvedValue({ rows });
  }
}

beforeEach(() => primeStore());

// ── Portfolio ──────────────────────────────────────────────────────────────

describe("getPortfolioRollup", () => {
  const ventures = [
    {
      id: "v1",
      venture_id: "VNT-1",
      business_stage: "growth",
      created_at: "2024-01-01T00:00:00Z",
    },
    {
      id: "v2",
      venture_id: "VNT-2",
      business_stage: "not-a-stage",
      created_at: "2025-06-01T00:00:00Z",
    },
  ];

  const seed = () =>
    primeStore({
      selectPortfolioVentures: ventures,
      selectPortfolioFirstPayingMonth: [{ venture_uuid: "v1", first_period: "2024-03-01" }],
      selectPortfolioLatestMonths: [
        { venture_uuid: "v1", reporting_period: "2026-10-01", paying_customers: 20 },
        { venture_uuid: "v2", reporting_period: "2026-10-01", paying_customers: 0 },
      ],
      selectPortfolioLatestMetrics: [
        { venture_uuid: "v1", metric_key: "fte", value: "5", status: "computed" },
        { venture_uuid: "v1", metric_key: "runway_months", value: "12", status: "computed" },
        { venture_uuid: "v1", metric_key: "customer_growth_3m", value: "0.1", status: "computed" },
      ],
      selectPortfolioLatestTeams: [
        { venture_uuid: "v1", women_employees: 3, men_employees: 5, under35_women: 2, under35_men: 2 },
      ],
      selectPortfolioBaselines: [{ venture_uuid: "v1", fte: "2" }],
      selectPortfolioFinancingEvents: [
        { venture_uuid: "v1", financing_type: "equity", amount_mode: "exact", amount_value: "100000", amount_band: null },
        { venture_uuid: "v2", financing_type: "grant", amount_mode: "band", amount_value: null, amount_band: "F2" },
      ],
      selectPortfolioStageHistory: [
        { venture_uuid: "v1", from_stage: "idea", to_stage: "idea", decided_at: "2024-02-01T00:00:00Z" },
        { venture_uuid: "v1", from_stage: "idea", to_stage: "validation", decided_at: "2024-06-01T00:00:00Z" },
      ],
    });

  test("counts every stage, and an unrecognised stage is 'unset' not Idea", async () => {
    seed();
    const rollup = await getPortfolioRollup({ now: NOW });

    const byStage = Object.fromEntries(rollup.stages.map((row) => [row.stage, row.total]));
    expect(byStage.growth).toBe(1);
    expect(byStage.unset).toBe(1);
    expect(byStage.idea).toBe(0);
    expect(rollup.totalVentures).toBe(2);
  });

  test("the health mix counts a Venture with no validated data as unknown", async () => {
    seed();
    const rollup = await getPortfolioRollup({ now: NOW });

    expect(rollup.trafficLight.green).toBe(1);
    expect(rollup.trafficLight.unknown).toBe(1);
    expect(rollup.trafficLight.red).toBe(0);
  });

  test("time to first paying customer runs from the start to the first paying month", async () => {
    seed();
    const rollup = await getPortfolioRollup({ now: NOW });

    // 2024-01-01 → 2024-03-01 in a leap year: 31 + 29 days.
    expect(rollup.timeToFirstPaying.ventures).toBe(1);
    expect(rollup.timeToFirstPaying.averageDays).toBe(60);
    expect(rollup.timeToFirstPaying.medianDays).toBe(60);
  });

  test("survival only judges Ventures that are old enough", async () => {
    seed();
    const rollup = await getPortfolioRollup({ now: NOW });

    expect(rollup.survival.m12).toEqual({ eligible: 2, survived: 2, rate: 1 });
    expect(rollup.survival.m24).toEqual({ eligible: 1, survived: 1, rate: 1 });
    // Nobody is 36 months old yet — not applicable, not a failure.
    expect(rollup.survival.m36).toEqual({ eligible: 0, survived: 0, rate: null });
  });

  test("a band amount makes the financing total approximate", async () => {
    seed();
    const rollup = await getPortfolioRollup({ now: NOW });

    // exact 100000 + band F2 midpoint (50001 + 100000) / 2
    expect(rollup.financing.total).toBe(175000.5);
    expect(rollup.financing.approximate).toBe(true);
    expect(rollup.financing.ventures).toBe(2);
  });

  test("jobs created needs both the current FTE and a locked baseline", async () => {
    seed();
    const rollup = await getPortfolioRollup({ now: NOW });

    expect(rollup.jobs.fte).toBe(5);
    expect(rollup.jobs.created).toBe(3);
    expect(rollup.jobs.venturesReportingFte).toBe(1);
  });

  test("the team share is portfolio-wide, from raw head counts", async () => {
    seed();
    const rollup = await getPortfolioRollup({ now: NOW });

    expect(rollup.team.members).toBe(8);
    expect(rollup.team.womenShare).toBe(38); // 3 of 8, rounded
    expect(rollup.team.youthShare).toBe(50); // 4 of 8
  });

  test("the funnel counts Ventures with a paying customer, and never guesses participants", async () => {
    seed();
    const rollup = await getPortfolioRollup({ now: NOW });

    expect(rollup.funnel).toEqual({ ventures: 2, withPayingCustomer: 1, participants: null });
  });

  test("time in stage comes from the approved history", async () => {
    seed();
    const rollup = await getPortfolioRollup({ now: NOW });

    const idea = rollup.timeInStage.find((row) => row.stage === "idea");
    const validation = rollup.timeInStage.find((row) => row.stage === "validation");

    // 2024-02-01 → 2024-06-01: 29 + 31 + 30 + 31
    expect(idea).toEqual({ stage: "idea", ventures: 1, averageDays: 121, medianDays: 121 });
    expect(validation.ventures).toBe(1);
    expect(validation.averageDays).toBeGreaterThan(800);
  });

  test("an empty portfolio produces no figures rather than zeros", async () => {
    const rollup = await getPortfolioRollup({ now: NOW });

    expect(rollup.totalVentures).toBe(0);
    expect(rollup.financing.total).toBeNull();
    expect(rollup.jobs.fte).toBeNull();
    expect(rollup.team.womenShare).toBeNull();
    expect(rollup.timeToFirstPaying.averageDays).toBeNull();
    expect(rollup.survival.m12.rate).toBeNull();
  });
});

// ── Reporting discipline ───────────────────────────────────────────────────

describe("reporting periods", () => {
  test("only closed months and quarters are listed", () => {
    expect(monthlyPeriods(NOW, 3)).toEqual(["2026-08-01", "2026-09-01", "2026-10-01"]);
    expect(quarterlyPeriods(NOW, 2)).toEqual(["2026-04-01", "2026-07-01"]);
  });
});

describe("evaluateReportingDiscipline", () => {
  const venture = { id: "v1", venture_id: "VNT-1", created_at: "2026-09-10T00:00:00Z" };

  const run = ({ monthlyRows = [], quarterlyRows = [], settings = {}, ventures = [venture] } = {}) =>
    evaluateReportingDiscipline({
      ventures,
      monthlyRows,
      quarterlyRows,
      settings,
      now: NOW,
      monthsBack: 12,
      quartersBack: 4,
    });

  test("a Venture is only due from the month it was created", () => {
    // Created 10 September: September is due (deadline 5 October), October is
    // not due until 5 November — which has not arrived on 3 November.
    const result = run();
    expect(result.monthly.due).toBe(1);
    expect(result.monthly.received).toBe(0);
    expect(result.monthly.rate).toBe(0);
  });

  test("a submission before the deadline is received and on time", () => {
    const result = run({
      monthlyRows: [
        {
          venture_uuid: "v1",
          reporting_period: "2026-09-01",
          version: 1,
          status: "validated",
          submitted_at: "2026-10-03T10:00:00Z",
          validated_at: "2026-10-04T10:00:00Z",
          rejected_at: null,
          superseded_at: null,
        },
      ],
    });

    expect(result.monthly).toMatchObject({ due: 1, received: 1, onTime: 1, validated: 1, rejected: 0 });
    expect(result.monthly.rate).toBe(1);
    expect(result.monthly.onTimeRate).toBe(1);
  });

  test("a late submission is received but not on time", () => {
    const result = run({
      monthlyRows: [
        {
          venture_uuid: "v1",
          reporting_period: "2026-09-01",
          version: 1,
          status: "validated",
          submitted_at: "2026-10-08T10:00:00Z",
          validated_at: null,
          rejected_at: null,
          superseded_at: null,
        },
      ],
    });

    expect(result.monthly).toMatchObject({ due: 1, received: 1, onTime: 0 });
    expect(result.monthly.onTimeRate).toBe(0);
  });

  test("a draft is not a submission", () => {
    const result = run({
      monthlyRows: [
        {
          venture_uuid: "v1",
          reporting_period: "2026-09-01",
          version: 1,
          status: "draft",
          submitted_at: null,
          validated_at: null,
          rejected_at: null,
          superseded_at: null,
        },
      ],
    });

    expect(result.monthly.received).toBe(0);
  });

  test("a corrected month counts once, and the FIRST submission decides lateness", () => {
    const result = run({
      monthlyRows: [
        // Version 1 was rejected, version 2 fixed it — both submitted late.
        {
          venture_uuid: "v1",
          reporting_period: "2026-09-01",
          version: 1,
          status: "rejected",
          submitted_at: "2026-10-09T10:00:00Z",
          validated_at: null,
          rejected_at: "2026-10-10T10:00:00Z",
          superseded_at: null,
        },
        {
          venture_uuid: "v1",
          reporting_period: "2026-09-01",
          version: 2,
          status: "validated",
          submitted_at: "2026-10-11T10:00:00Z",
          validated_at: "2026-10-12T10:00:00Z",
          rejected_at: null,
          superseded_at: null,
        },
      ],
    });

    expect(result.monthly.due).toBe(1);
    expect(result.monthly.received).toBe(1);
    expect(result.monthly.rejected).toBe(1);
    expect(result.monthly.validated).toBe(1);
    expect(result.monthly.onTime).toBe(0);
  });

  test("quarters use the quarterly deadline", () => {
    const result = run({
      quarterlyRows: [
        {
          venture_uuid: "v1",
          reporting_period: "2026-07-01",
          version: 1,
          status: "validated",
          submitted_at: "2026-10-08T10:00:00Z",
          validated_at: null,
          rejected_at: null,
          superseded_at: null,
        },
      ],
    });

    // Q3 2026 is due on 10 October by default, so a report filed on the 8th is on time.
    expect(result.quarterly.due).toBe(1);
    expect(result.quarterly.received).toBe(1);
    expect(result.quarterly.onTime).toBe(1);
  });

  test("the studio's own deadline moves the definition of late", () => {
    const rows = [
      {
        venture_uuid: "v1",
        reporting_period: "2026-09-01",
        version: 1,
        status: "validated",
        submitted_at: "2026-10-08T10:00:00Z",
        validated_at: null,
        rejected_at: null,
        superseded_at: null,
      },
    ];

    expect(run({ monthlyRows: rows }).monthly.onTime).toBe(0);
    // A deadline of the 15th makes the same submission on time.
    expect(run({ monthlyRows: rows, settings: { reporting_monthly_due_day: 15 } }).monthly.onTime).toBe(1);
  });

  test("a Venture with nothing due yet is left out of the per-venture table", () => {
    const result = run({ ventures: [{ ...venture, created_at: "2026-10-20T00:00:00Z" }] });
    expect(result.monthly.due).toBe(0);
    expect(result.ventures).toEqual([]);
  });
});
