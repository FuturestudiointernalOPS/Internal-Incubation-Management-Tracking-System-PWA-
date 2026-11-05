/**
 * PHASE 1 — the FX cache, tested without a network.
 *
 * What matters:
 *   • same currency is 1, with no provider call;
 *   • CFA is resolved from the euro peg (the provider does not quote it);
 *   • any pair is derived through EUR, so N currencies cost one fetch;
 *   • a provider failure returns null — never a stale or invented rate.
 */

const rows = new Map(); // `${base}:${quote}:${date}` -> rate

const mockStore = {
  ensureFxSchema: jest.fn(async () => {}),
  selectEuroRates: jest.fn(async (date) => {
    const out = [];
    for (const [key, rate] of rows.entries()) {
      const [base, quote, rowDate] = key.split(":");
      if (base === "EUR" && rowDate === date) out.push({ quote_currency: quote, rate, rate_date: rowDate });
    }
    return { rows: out };
  }),
  // Latest row PER QUOTE inside the half-month window.
  selectEuroRatesBetween: jest.fn(async (start, end) => {
    const latest = new Map();
    for (const [key, rate] of rows.entries()) {
      const [base, quote, rowDate] = key.split(":");
      if (base !== "EUR" || rowDate < start || rowDate > end) continue;
      const current = latest.get(quote);
      if (!current || rowDate > current.rate_date) {
        latest.set(quote, { quote_currency: quote, rate, rate_date: rowDate });
      }
    }
    return { rows: [...latest.values()] };
  }),
  selectLatestEuroRateDate: jest.fn(async (date) => {
    const dates = [...rows.keys()]
      .map((key) => key.split(":")[2])
      .filter((rowDate) => rowDate <= date)
      .sort();
    return { rows: [{ rate_date: dates.length ? dates[dates.length - 1] : null }] };
  }),
  insertEuroRates: jest.fn(async ({ date, rates }) => {
    for (const [quote, rate] of Object.entries(rates)) {
      rows.set(`EUR:${quote}:${date}`, rate);
    }
  }),
};

jest.mock("@/models/fxRateStore", () => mockStore);

const PROVIDER_OK = {
  ok: true,
  json: async () => ({ base: "EUR", date: "2026-11-03", rates: { USD: 1.08, GBP: 0.86 } }),
};

let fx;

beforeEach(() => {
  jest.resetModules();
  rows.clear();
  mockStore.insertEuroRates.mockClear();
  global.fetch = jest.fn().mockResolvedValue(PROVIDER_OK);
  fx = require("@/services/finance/fxRates");
});

test("the same currency is 1 and never calls the provider", async () => {
  const rate = await fx.getFxRate({ base: "XOF", quote: "XOF" });
  expect(rate).toMatchObject({ rate: 1, source: "identity" });
  expect(global.fetch).not.toHaveBeenCalled();
});

test("CFA converts through the euro peg", async () => {
  const rate = await fx.getFxRate({ base: "XOF", quote: "USD", date: "2026-11-03" });
  // 1 EUR = 655.957 XOF and 1 EUR = 1.08 USD → 1 XOF = 1.08 / 655.957 USD
  expect(rate.rate).toBeCloseTo(1.08 / 655.957, 10);
  expect(rate.rateDate).toBe("2026-11-03");
});

test("one provider call serves many pairs, and the second read is a cache hit", async () => {
  await fx.getFxRate({ base: "XOF", quote: "USD", date: "2026-11-03" });
  await fx.getFxRate({ base: "GBP", quote: "USD", date: "2026-11-03" });
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test("rates are fetched at most TWICE a month", async () => {
  // Both dates are in the 1st–15th window: one fetch.
  await fx.getFxRate({ base: "XOF", quote: "USD", date: "2026-11-02" });
  await fx.getFxRate({ base: "XOF", quote: "USD", date: "2026-11-14" });
  expect(global.fetch).toHaveBeenCalledTimes(1);

  // The 16th–end window is a second, separate fetch.
  await fx.getFxRate({ base: "XOF", quote: "USD", date: "2026-11-20" });
  expect(global.fetch).toHaveBeenCalledTimes(2);

  // …and everything after that in the same window is a cache hit.
  await fx.getFxRate({ base: "XOF", quote: "USD", date: "2026-11-28" });
  expect(global.fetch).toHaveBeenCalledTimes(2);
});

test("the half-month window is the 1st–15th and 16th–last day", () => {
  expect(fx.ratePeriodFor("2026-02-10")).toEqual({ start: "2026-02-01", end: "2026-02-15" });
  expect(fx.ratePeriodFor("2026-02-20")).toEqual({ start: "2026-02-16", end: "2026-02-28" });
  expect(fx.ratePeriodFor("2024-02-20")).toEqual({ start: "2024-02-16", end: "2024-02-29" });
});

test("a provider outage answers null instead of a guessed rate", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });
  const rate = await fx.getFxRate({ base: "XOF", quote: "USD", date: "2026-11-03" });
  expect(rate).toBeNull();
});

test("an unknown currency code is refused, not converted", async () => {
  expect(await fx.getFxRate({ base: "XOF", quote: "ZZZ" })).toBeNull();
  expect(await fx.getFxRate({ base: "nope", quote: "USD" })).toBeNull();
});

test("a conversion multiplies the amount and keeps the rate provenance", async () => {
  const converted = await fx.convertAmount({
    amount: 1_000_000,
    base: "XOF",
    quote: "USD",
    date: "2026-11-03",
  });
  expect(converted.amount).toBeCloseTo(1_000_000 * (1.08 / 655.957), 6);
  expect(converted.source).toBe("frankfurter/ecb");
  expect(converted.rateDate).toBe("2026-11-03");
});
