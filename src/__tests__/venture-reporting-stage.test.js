/**
 * PHASE 5 — the stage engine (spec §4).
 *
 * Pure tests: criteria evaluation, the three-valued verdict, the progress
 * score, the non-founder FTE arithmetic and the review flag.
 *
 * The rule that matters most here is the difference between NOT MET and
 * MISSING: a venture without a validated quarter has not failed LTV:CAC — it
 * has not answered the question yet.
 */

const {
  evaluateNextStage,
  evaluateReviewFlag,
  NEXT_STAGE,
  STAGES,
  MET,
  NOT_MET,
  MISSING,
} = require("@/services/ventures/reporting/stageCriteria");

// ── Fixtures ───────────────────────────────────────────────────────────────

const month = (period, payingCustomers, extra = {}) => ({
  period,
  payingCustomers,
  fullTime: 3,
  partTimeDays: 0,
  ...extra,
});

const metric = (value) => ({ status: "computed", value });

const metricsOf = (entries) => {
  const map = new Map();
  for (const [period, values] of Object.entries(entries)) {
    const bag = {};
    for (const [key, value] of Object.entries(values)) bag[key] = metric(value);
    map.set(period, bag);
  }
  return map;
};

const threeMonths = (paying, retention, channels = null) => ({
  months: [month("2026-07-01", paying), month("2026-08-01", paying), month("2026-09-01", paying)].map(
    (row) => (channels ? { ...row, channels } : row),
  ),
  metrics: metricsOf({
    "2026-07-01": { retention },
    "2026-08-01": { retention },
    "2026-09-01": { retention },
  }),
});

const base = (overrides = {}) => ({
  currentStage: "idea",
  profile: { idealCustomerProfile: "Smallholder farmers", problemStatement: "Price opacity" },
  events: [],
  interviews: { withEvidence: 0 },
  months: [],
  metrics: new Map(),
  quarter: null,
  settings: {},
  ...overrides,
});

const byKey = (criteria) => Object.fromEntries(criteria.map((c) => [c.key, c]));

// ── Stage vocabulary ───────────────────────────────────────────────────────

describe("stage vocabulary", () => {
  test("the five stages and their order", () => {
    expect(STAGES).toEqual(["idea", "validation", "early_traction", "growth", "scaling"]);
    expect(NEXT_STAGE.idea).toBe("validation");
    expect(NEXT_STAGE.scaling).toBeNull();
  });

  test("the last stage has nothing to propose", () => {
    const evaluation = evaluateNextStage(base({ currentStage: "scaling" }));
    expect(evaluation.nextStage).toBeNull();
    expect(evaluation.eligible).toBe(false);
    expect(evaluation.progress).toBe(1);
  });
});

// ── Idea → Validation ──────────────────────────────────────────────────────

describe("Idea → Validation", () => {
  test("an empty venture is not met, criterion by criterion", () => {
    const evaluation = evaluateNextStage(
      base({ profile: null, interviews: { withEvidence: 0 }, events: [] }),
    );
    const criteria = byKey(evaluation.criteria);

    expect(criteria.icp_defined.status).toBe(MISSING); // no profile at all
    expect(criteria.interviews.status).toBe(NOT_MET); // 0 of 10
    expect(criteria.pilot_or_mvp.status).toBe(NOT_MET);
    expect(evaluation.progress).toBe(0);
    expect(evaluation.eligible).toBe(false);
  });

  test("a problem without an ICP exists, and is not met — not missing", () => {
    const evaluation = evaluateNextStage(
      base({ profile: { idealCustomerProfile: "", problemStatement: "Something" } }),
    );
    expect(byKey(evaluation.criteria).icp_defined.status).toBe(NOT_MET);
  });

  test("10 evidenced interviews and a signed pilot make it eligible", () => {
    const evaluation = evaluateNextStage(
      base({
        interviews: { withEvidence: 10 },
        events: [{ type: "pilot_signed", date: "2026-09-01" }],
      }),
    );
    expect(evaluation.eligible).toBe(true);
    expect(evaluation.progress).toBe(1);
    expect(evaluation.missing).toBe(0);
  });

  test("nine interviews is progress, not eligibility", () => {
    const evaluation = evaluateNextStage(
      base({
        interviews: { withEvidence: 9 },
        events: [{ type: "mvp_launched", date: "2026-09-01" }],
      }),
    );
    expect(evaluation.met).toBe(2);
    expect(evaluation.total).toBe(3);
    expect(evaluation.progress).toBeCloseTo(2 / 3);
    expect(evaluation.eligible).toBe(false);
  });

  test("the threshold comes from the studio's settings, not the code", () => {
    const evaluation = evaluateNextStage(
      base({ interviews: { withEvidence: 5 }, settings: { validation_min_interviews: 5 } }),
    );
    expect(byKey(evaluation.criteria).interviews.status).toBe(MET);
  });
});

// ── Validation → Early Traction ────────────────────────────────────────────

describe("Validation → Early Traction", () => {
  test("fewer than three months of data leaves the monthly criteria MISSING", () => {
    const evaluation = evaluateNextStage(
      base({
        currentStage: "validation",
        months: [month("2026-08-01", 10)],
        metrics: metricsOf({ "2026-08-01": { retention: 0.8 } }),
      }),
    );
    const criteria = byKey(evaluation.criteria);
    expect(criteria.paying_customers_3m.status).toBe(MISSING);
    expect(criteria.retention_3m.status).toBe(MISSING);
    expect(criteria.channel.status).toBe(MISSING); // no validated quarter
    expect(evaluation.eligible).toBe(false);
  });

  test("five customers and 50% retention for three months, a channel, and a converted pilot", () => {
    const evaluation = evaluateNextStage(
      base({
        currentStage: "validation",
        ...threeMonths(5, 0.55),
        events: [{ type: "pilot_converted", date: "2026-09-10" }],
        quarter: { period: "2026-07-01", channels: ["referral"], metrics: {} },
      }),
    );
    expect(evaluation.eligible).toBe(true);
  });

  test("four customers a month is NOT MET (data exists, the bar is not cleared)", () => {
    const evaluation = evaluateNextStage(
      base({ currentStage: "validation", ...threeMonths(4, 0.55) }),
    );
    expect(byKey(evaluation.criteria).paying_customers_3m.status).toBe(NOT_MET);
  });

  test("retention below the bar is NOT MET", () => {
    const evaluation = evaluateNextStage(
      base({ currentStage: "validation", ...threeMonths(8, 0.4) }),
    );
    expect(byKey(evaluation.criteria).retention_3m.status).toBe(NOT_MET);
  });

  test("thirteen weeks of history is not required — the window is the studio's setting", () => {
    // The default window is 3 months; the studio may lower it to 2.
    const input = base({
      currentStage: "validation",
      months: [month("2026-08-01", 8), month("2026-09-01", 8)],
      metrics: metricsOf({
        "2026-08-01": { retention: 0.8 },
        "2026-09-01": { retention: 0.8 },
      }),
      settings: { consecutive_months_required: 2 },
    });
    const criteria = byKey(evaluateNextStage(input).criteria);
    expect(criteria.paying_customers_3m.status).toBe(MET);
    expect(criteria.retention_3m.status).toBe(MET);
    expect(criteria.paying_customers_3m.months).toBe(2);
  });

  test("one month without a computable retention makes the whole criterion MISSING", () => {
    const evaluation = evaluateNextStage(
      base({
        currentStage: "validation",
        months: [month("2026-07-01", 6), month("2026-08-01", 6), month("2026-09-01", 6)],
        metrics: metricsOf({
          "2026-07-01": { retention: 0.9 },
          // August never computed a retention (first month of history, say).
          "2026-09-01": { retention: 0.9 },
        }),
      }),
    );
    expect(byKey(evaluation.criteria).retention_3m.status).toBe(MISSING);
  });
});

// ── Early Traction → Growth ────────────────────────────────────────────────

describe("Early Traction → Growth", () => {
  const growthInput = (overrides = {}) => {
    const { months, metrics } = threeMonths(15, 0.6, ["referral"]);
    metrics.get("2026-09-01").customer_growth_3m = metric(0.06);
    return base({
      currentStage: "early_traction",
      months,
      metrics,
      quarter: {
        period: "2026-07-01",
        channels: ["referral", "content"],
        metrics: { ltv_cac: metric(4) },
      },
      ...overrides,
    });
  };

  test("every criterion met makes it eligible", () => {
    const evaluation = evaluateNextStage(growthInput());
    expect(evaluation.eligible).toBe(true);
    expect(evaluation.total).toBe(5);
  });

  test("LTV:CAC below the bar is NOT MET", () => {
    const input = growthInput();
    input.quarter.metrics.ltv_cac = metric(2);
    expect(byKey(evaluateNextStage(input).criteria).ltv_cac.status).toBe(NOT_MET);
  });

  test("no validated quarter makes LTV:CAC MISSING, blocking the proposal", () => {
    const input = growthInput({ quarter: null });
    const evaluation = evaluateNextStage(input);
    expect(byKey(evaluation.criteria).ltv_cac.status).toBe(MISSING);
    expect(evaluation.eligible).toBe(false);
    expect(evaluation.missing).toBe(1);
  });

  test("the SAME channel must appear in every month of the window", () => {
    const shared = byKey(evaluateNextStage(growthInput()).criteria).same_channel_3m;
    expect(shared.status).toBe(MET);

    const input = growthInput();
    input.months = input.months.map((row, index) => ({
      ...row,
      channels: index === 2 ? ["outbound"] : ["referral"],
    }));
    expect(byKey(evaluateNextStage(input).criteria).same_channel_3m.status).toBe(NOT_MET);
  });

  test("a month with no channels recorded makes the criterion MISSING, not failed", () => {
    const input = growthInput();
    input.months = input.months.map((row, index) => (index === 1 ? { ...row, channels: [] } : row));
    expect(byKey(evaluateNextStage(input).criteria).same_channel_3m.status).toBe(MISSING);
  });

  test("growth below the monthly bar is NOT MET", () => {
    const input = growthInput();
    input.metrics.get("2026-09-01").customer_growth_3m = metric(0.02);
    expect(byKey(evaluateNextStage(input).criteria).growth_3m.status).toBe(NOT_MET);
  });
});

// ── Growth → Scaling ───────────────────────────────────────────────────────

describe("Growth → Scaling", () => {
  const scalingInput = (overrides = {}) => {
    const periods = [
      "2026-04-01",
      "2026-05-01",
      "2026-06-01",
      "2026-07-01",
      "2026-08-01",
      "2026-09-01",
    ];
    const months = periods.map((period) => month(period, 20, { fullTime: 4, partTimeDays: 20 }));
    const entries = {};
    for (const period of periods) {
      entries[period] = { retention: 0.75, customer_growth_3m: 0.06 };
    }
    return base({
      currentStage: "growth",
      months,
      metrics: metricsOf(entries),
      events: [{ type: "new_market", date: "2026-08-01" }],
      quarter: {
        period: "2026-07-01",
        channels: ["referral"],
        metrics: { ltv_cac: metric(4) },
      },
      ...overrides,
    });
  };

  test("six sustained months, 75% retention, LTV:CAC 4 and 5 non-founder FTE", () => {
    const evaluation = evaluateNextStage(scalingInput());
    expect(evaluation.eligible).toBe(true);
  });

  test("non-founder FTE is full-time employees + part-time days ÷ 20 — founders are not counted", () => {
    // 4 full-time + 20 part-time days (1 FTE) = 5. The two founders do not add.
    expect(byKey(evaluateNextStage(scalingInput()).criteria).non_founder_fte.status).toBe(MET);

    const fewer = scalingInput();
    fewer.months = fewer.months.map((row) => ({ ...row, fullTime: 3, partTimeDays: 0 }));
    expect(byKey(evaluateNextStage(fewer).criteria).non_founder_fte.status).toBe(NOT_MET);
  });

  test("a short history cannot prove sustained growth", () => {
    const input = scalingInput();
    input.months = input.months.slice(-3);
    expect(byKey(evaluateNextStage(input).criteria).sustained_growth.status).toBe(MISSING);
  });

  test("a missing new-market event is NOT MET", () => {
    const input = scalingInput({ events: [] });
    expect(byKey(evaluateNextStage(input).criteria).new_market.status).toBe(NOT_MET);
  });
});

// ── Review flag ────────────────────────────────────────────────────────────

describe("review flag", () => {
  const flaggedInput = (retention, paying = 2) => {
    const months = [month("2026-07-01", paying), month("2026-08-01", paying), month("2026-09-01", paying)];
    return {
      currentStage: "early_traction",
      months,
      metrics: metricsOf({
        "2026-07-01": { retention },
        "2026-08-01": { retention },
        "2026-09-01": { retention },
      }),
      settings: {},
    };
  };

  test("three months below the current stage's bar raises the flag", () => {
    const review = evaluateReviewFlag(flaggedInput(0.2, 2));
    expect(review.flagged).toBe(true);
    expect(review.monthsBelow).toBe(3);
  });

  test("three months above the bar does not", () => {
    expect(evaluateReviewFlag(flaggedInput(0.8, 8)).flagged).toBe(false);
  });

  test("a short history cannot raise a flag", () => {
    const input = flaggedInput(0.2, 2);
    input.months = input.months.slice(-1);
    const review = evaluateReviewFlag(input);
    expect(review.flagged).toBe(false);
    expect(review.threshold).toBe(3);
  });

  test("Idea and Validation have no monthly bar to fail", () => {
    const review = evaluateReviewFlag({ ...flaggedInput(0.2, 2), currentStage: "validation" });
    expect(review.applicable).toBe(false);
    expect(review.flagged).toBe(false);
  });

  test("the studio's threshold is respected", () => {
    const input = flaggedInput(0.2, 2);
    input.settings = { review_flag_months: 2 };
    expect(evaluateReviewFlag(input).flagged).toBe(true);
  });
});
