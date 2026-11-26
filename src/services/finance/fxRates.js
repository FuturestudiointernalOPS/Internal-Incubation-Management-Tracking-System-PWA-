import {
  ensureFxSchema,
  selectEuroRates,
  selectEuroRatesBetween,
  selectLatestEuroRateDate,
  insertEuroRates,
} from "@/models/fxRateStore";

/**
 * EXCHANGE RATES — read-through cache, display only.
 *
 * Design rules (see docs/VENTURE_FINANCIAL_REPORTING.md):
 *   • The provider is called AT MOST TWICE A MONTH — once for the 1st–15th
 *     window and once for the 16th–end window. The answer is stored per date, so
 *     a page view never calls it and neither does a second request in the same
 *     window. A rate is a stated fact, not a live tick: twice a month is enough
 *     for reporting, and it keeps the provider bill and the failure surface tiny.
 *   • Rates are historical facts keyed by date: a figure converted today keeps
 *     the same value tomorrow.
 *   • Nothing here is imported by the metric engine. Conversion is a view
 *     concern; stored amounts and their filing currency are never rewritten.
 *   • Any failure returns `null`. Callers then show the ORIGINAL amount with a
 *     note — never a stale conversion, never zero.
 *
 * Provider: Frankfurter (ECB reference rates), no API key, EUR-based.
 * The CFA francs are NOT quoted by it because they are pegged to the euro:
 * 1 EUR = 655.957 XOF = 655.957 XAF by treaty, so they are constants.
 */

const PROVIDER_URL = process.env.FX_PROVIDER_URL || "https://api.frankfurter.app/latest?from=EUR";
const PROVIDER_NAME = "frankfurter/ecb";

/** Treaty pegs: units of currency per 1 EUR. */
export const EURO_PEGS = Object.freeze({ EUR: 1, XOF: 655.957, XAF: 655.957 });

const today = () => new Date().toISOString().slice(0, 10);

export function normalizeCurrency(code) {
  const value = String(code || "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(value) ? value : null;
}

/**
 * The half-month window a date falls in: 1st–15th, or 16th–last day.
 * Two fetches per month means every request is answered from one of these.
 */
export function ratePeriodFor(dateString) {
  const value = /^\d{4}-\d{2}-\d{2}$/.test(String(dateString || ""))
    ? String(dateString)
    : today();
  const [year, month, day] = value.split("-").map(Number);
  const start = `${value.slice(0, 7)}-01`;
  if (day <= 15) return { start, end: `${value.slice(0, 7)}-15` };

  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { start: `${value.slice(0, 7)}-16`, end: `${value.slice(0, 7)}-${String(lastDay).padStart(2, "0")}` };
}

/** One in-flight provider call per process, so N concurrent views fetch once. */
let inflight = null;
/** The window already attempted in this process (success OR failure). */
let lastAttemptedWindow = null;

async function fetchProviderRates() {
  const response = await fetch(PROVIDER_URL, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`fx provider HTTP ${response.status}`);
  const payload = await response.json();
  const rates = { ...(payload?.rates || {}) };
  // The provider never lists the pegged francs: add them at the anchor.
  for (const [code, perEuro] of Object.entries(EURO_PEGS)) {
    if (code !== "EUR" && !rates[code]) rates[code] = perEuro;
  }
  return { date: payload?.date || today(), rates };
}

async function ensureProviderRates(window) {
  if (lastAttemptedWindow === window.start) return;
  if (!inflight) {
    inflight = (async () => {
      const fetched = await fetchProviderRates();
      await insertEuroRates({ date: fetched.date, rates: fetched.rates, source: PROVIDER_NAME });
      lastAttemptedWindow = window.start;
      return fetched;
    })().finally(() => {
      inflight = null;
    });
  }
  await inflight;
}

/**
 * The most recent rate per currency inside one half-month window, pegs included.
 * `rateDate` is the DAY the rate was published — not the window label, so the
 * provenance stays exact.
 */
async function euroRatesForWindow(window) {
  const rows = (await selectEuroRatesBetween(window.start, window.end)).rows || [];
  const map = { ...EURO_PEGS, EUR: 1 };
  let rateDate = null;

  for (const row of rows) {
    const rate = Number(row.rate);
    if (!Number.isFinite(rate) || rate <= 0) continue;
    map[String(row.quote_currency).toUpperCase()] = rate;
    const rowDate = String(row.rate_date || "").slice(0, 10);
    if (rowDate && (!rateDate || rowDate > rateDate)) rateDate = rowDate;
  }

  return { map, rateDate };
}

/** Fallback for a window with no rows at all: the newest rate ever stored. */
async function euroRatesForLatest(end) {
  const map = { ...EURO_PEGS, EUR: 1 };
  try {
    const latest = (await selectLatestEuroRateDate(end)).rows?.[0]?.rate_date;
    if (!latest) return { map, rateDate: null };
    const rateDate = String(latest).slice(0, 10);
    const result = await selectEuroRates(rateDate);
    for (const row of result.rows || []) {
      const rate = Number(row.rate);
      if (!Number.isFinite(rate) || rate <= 0) continue;
      map[String(row.quote_currency).toUpperCase()] = rate;
    }
    return { map, rateDate };
  } catch {
    return { map, rateDate: null };
  }
}

/**
 * The rate that converts 1 `base` into `quote`, with the date it came from.
 *
 * @returns {Promise<{base,quote,rate,rateDate,source}|null>}
 */
export async function getFxRate({ base, quote, date = null }) {
  const from = normalizeCurrency(base);
  const to = normalizeCurrency(quote);
  if (!from || !to) return null;

  const requestedDate = /^\d{4}-\d{2}-\d{2}$/.test(String(date || "")) ? String(date) : today();

  if (from === to) {
    return { base: from, quote: to, rate: 1, rateDate: requestedDate, source: "identity" };
  }

  try {
    await ensureFxSchema();

    const window = ratePeriodFor(requestedDate);
    let { map, rateDate } = await euroRatesForWindow(window);

    const missing = [from, to].some((code) => !Number.isFinite(map[code]));

    if (missing) {
      // Nothing stored for this half-month: fetch ONCE for the window.
      await ensureProviderRates(window);
      ({ map, rateDate } = await euroRatesForWindow(window));
    }

    if ([from, to].some((code) => !Number.isFinite(map[code]))) {
      // Still nothing (provider down, or the currency is not quoted): fall back
      // to the newest rate ever stored rather than publishing nothing.
      const latest = await euroRatesForLatest(window.end);
      map = latest.map;
      rateDate = latest.rateDate || rateDate;
    }

    const basePerEuro = map[from];
    const quotePerEuro = map[to];
    if (!Number.isFinite(basePerEuro) || !Number.isFinite(quotePerEuro) || basePerEuro <= 0) {
      return null;
    }

    return {
      base: from,
      quote: to,
      rate: quotePerEuro / basePerEuro,
      rateDate: rateDate || requestedDate,
      source: PROVIDER_NAME,
    };
  } catch (error) {
    // A provider outage must never break a dashboard: the caller shows the
    // original amount instead.
    console.warn("[fx] rate unavailable:", error?.message || error);
    return null;
  }
}

/** Convert an amount for DISPLAY. Returns null when no rate is available. */
export async function convertAmount({ amount, base, quote, date = null }) {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return null;
  const fx = await getFxRate({ base, quote, date });
  if (!fx) return null;
  return { ...fx, amount: numeric * fx.rate };
}
