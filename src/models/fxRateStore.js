import db from "@/lib/db";

/**
 * FX RATES — the stored, dated rates the display layer converts with.
 *
 * A rate is a HISTORICAL FACT, never a setting: it is keyed by the day it was
 * published, so a figure shown today and the same figure shown next month
 * convert identically. Rows are append-only; a corrected rate is a new row.
 *
 * Everything is stored against EUR as the base (the provider's convention and
 * the anchor of the CFA peg), so any pair is derived by division instead of
 * being fetched and stored n times.
 */

let schemaReady = null;

export function ensureFxSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await db.execute({
        sql: `CREATE TABLE IF NOT EXISTS fx_rates (
          id SERIAL PRIMARY KEY,
          base_currency TEXT NOT NULL,
          quote_currency TEXT NOT NULL,
          rate_date DATE NOT NULL,
          rate NUMERIC NOT NULL,
          source TEXT NOT NULL,
          fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (base_currency, quote_currency, rate_date)
        )`,
        args: [],
      });
      await db.execute({
        sql: "CREATE INDEX IF NOT EXISTS idx_fx_rates_lookup ON fx_rates (base_currency, rate_date)",
        args: [],
      });
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

/** A DATE argument, never a timestamp — the column is `date`. */
function date(value) {
  return String(value || "").slice(0, 10);
}

/** Every EUR-based rate stored for one date, as `{ CODE: unitsPerEuro }`. */
export async function selectEuroRates(date) {
  return db.execute({
    sql: `SELECT quote_currency, rate
            FROM fx_rates
           WHERE base_currency = 'EUR' AND rate_date = ?`,
    args: [date],
  });
}

/** The most recent EUR-based rate PER QUOTE inside a date window. */
export async function selectEuroRatesBetween(start, end) {
  return db.execute({
    sql: `SELECT DISTINCT ON (quote_currency) quote_currency, rate, rate_date
            FROM fx_rates
           WHERE base_currency = 'EUR' AND rate_date >= ? AND rate_date <= ?
           ORDER BY quote_currency, rate_date DESC`,
    args: [date(start), date(end)],
  });
}

/** The most recent stored date at or before `date` that has any EUR rate. */
export async function selectLatestEuroRateDate(date) {
  return db.execute({
    sql: `SELECT MAX(rate_date) AS rate_date
            FROM fx_rates
           WHERE base_currency = 'EUR' AND rate_date <= ?`,
    args: [date],
  });
}

/** Insert one day's EUR-based rates. Idempotent. */
export async function insertEuroRates({ date: rateDate, rates, source }) {
  for (const [quote, rate] of Object.entries(rates || {})) {
    if (!Number.isFinite(Number(rate))) continue;
    await db.execute({
      sql: `INSERT INTO fx_rates (base_currency, quote_currency, rate_date, rate, source)
            VALUES ('EUR', ?, ?, ?, ?)
            ON CONFLICT (base_currency, quote_currency, rate_date) DO NOTHING`,
      args: [String(quote).toUpperCase(), date(rateDate), Number(rate), source],
    });
  }
}
