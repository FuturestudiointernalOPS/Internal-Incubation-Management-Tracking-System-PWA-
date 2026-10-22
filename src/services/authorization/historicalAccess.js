/**
 * HISTORICAL ACCESS POLICY (SERVICE layer — PURE, no db, no clock).
 *
 * Phase 7, decision D3 (docs/permissions/phase-1-decisions.md): the residual
 * read an ex-manager keeps ("historique") must be **bounded in time** — it
 * expires after a configurable retention, default **6 months**, expressible in
 * hours / days / months / years. The retention is a Super-Admin setting
 * (`system_settings.historical_access_retention`).
 *
 * WHY IT IS ANCHORED ON THE END OF RESPONSIBILITY, NOT ON `NOW`:
 *   expiry = (end of the ended assignment) + retention.
 * The anchor is a STORED timestamp, so the same input always produces the same
 * expiry — the reconcile stays IDEMPOTENT (a `now`-based expiry would re-date
 * the row on every pass). When a manager's last program ends, the clock starts.
 *
 * The residual itself is enforced AUTOMATICALLY: the resolver reads
 * `user_capabilities` with `(expires_at IS NULL OR expires_at > NOW())`
 * (`models/authorization/contextReads.js`), so writing an `expires_at` is what
 * ends the access — no extra decision code.
 *
 * Nothing here decides WHO may consult what (that is D1); this module only
 * answers "until when".
 */

/** The `system_settings` key that carries the retention. */
export const HISTORICAL_RETENTION_SETTING_KEY = "historical_access_retention";

/** Default retention when the setting is absent or unparseable. */
export const DEFAULT_HISTORICAL_RETENTION = { amount: 6, unit: "months" };

/** The units a retention may use. */
export const RETENTION_UNITS = ["hours", "days", "months", "years"];

/** A Date, or null for anything unparseable/absent. */
function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Parse a stored retention into `{ amount, unit }`. Accepts a JSON object
 * (`{"amount":6,"unit":"months"}`), a compact string (`"6:months"` /
 * `"6 months"`), or an already-parsed object. Anything invalid falls back to
 * the default — the retention is never left undefined.
 */
export function parseHistoricalRetention(raw) {
  const fallback = { ...DEFAULT_HISTORICAL_RETENTION };
  if (raw === null || raw === undefined || raw === "") return fallback;

  let amount = null;
  let unit = null;

  if (typeof raw === "object") {
    amount = raw.amount;
    unit = raw.unit;
  } else {
    const text = String(raw).trim();
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object") {
        amount = parsed.amount;
        unit = parsed.unit;
      }
    } catch {
      // not JSON — try the compact form below
    }
    if (amount === null || unit === null) {
      const match = text.match(/^(\d+(?:\.\d+)?)\s*[:/ ]?\s*([a-zA-Z]+)$/);
      if (match) {
        amount = match[1];
        unit = match[2];
      }
    }
  }

  const n = Number(amount);
  const u = String(unit || "").toLowerCase();
  if (!Number.isFinite(n) || n <= 0 || !RETENTION_UNITS.includes(u)) return fallback;
  return { amount: n, unit: u };
}

/**
 * The expiry an ended relationship earns: `anchor` + retention, as an ISO
 * string, or null when the anchor is missing (nothing to bound).
 */
export function computeHistoricalExpiry(anchor, retention) {
  const base = toDate(anchor);
  if (!base) return null;
  const { amount, unit } = parseHistoricalRetention(retention);
  const expiry = new Date(base.getTime());
  if (unit === "hours") expiry.setTime(expiry.getTime() + amount * 3600 * 1000);
  else if (unit === "days") expiry.setTime(expiry.getTime() + amount * 86400 * 1000);
  else if (unit === "months") expiry.setUTCMonth(expiry.getUTCMonth() + amount);
  else expiry.setUTCFullYear(expiry.getUTCFullYear() + amount);
  return expiry.toISOString();
}

/**
 * The latest "end of responsibility" among a person's ended assignment cards:
 * the greatest of `ends_at` (planned end) and `ended_at` (when it was closed).
 * Returns a Date or null. Taking the LATEST means the residual outlives the
 * last relationship the person closed.
 */
export function latestHistoryAnchor(rows = []) {
  let best = null;
  let bestMs = -Infinity;
  for (const row of rows) {
    for (const key of ["ends_at", "ended_at"]) {
      const date = toDate(row?.[key]);
      if (date && date.getTime() > bestMs) {
        bestMs = date.getTime();
        best = date;
      }
    }
  }
  return best;
}

/** The expiry for a set of ended cards under a retention (pure convenience). */
export function historicalExpiryFor(rows, retention) {
  const anchor = latestHistoryAnchor(rows);
  if (!anchor) return null;
  return computeHistoricalExpiry(anchor, retention);
}
