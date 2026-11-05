import {
  runInTransaction,
  selectActiveBaseline,
  insertBaseline,
  selectTeamSnapshot,
  supersedeBaseline as supersedeBaselineRow,
} from "@/models/ventureReportingStore";
import { ensureReportingSchema } from "./settings";
import {
  canCaptureBaseline,
  validateSupersedeReason,
  toAmount,
  toCount,
  snapshotFte,
  normalizePeriod,
} from "./rules";
import { currentReportingCurrency } from "./monthly";

const shape = (row) =>
  row
    ? {
        id: row.id,
        capturedAt: row.captured_at,
        fte: row.fte === null ? null : Number(row.fte),
        payingCustomers: row.paying_customers,
        cashMode: row.cash_mode,
        cashValue: row.cash_value === null ? null : Number(row.cash_value),
        cashBand: row.cash_band,
        outsideFinancingMode: row.outside_financing_mode,
        outsideFinancingValue:
          row.outside_financing_value === null ? null : Number(row.outside_financing_value),
        outsideFinancingBand: row.outside_financing_band,
        // The currency the baseline was captured in (older rows carry none).
        currency: row.currency ? String(row.currency).toUpperCase() : null,
        isLocked: row.is_locked,
      }
    : null;

const toPayload = ({ ventureUuid, ventureCode, actorCid, input = {} }) => ({
  ventureUuid,
  ventureCode,
  fte: toAmount(input.fte),
  payingCustomers: input.payingCustomers === "" || input.payingCustomers == null
    ? null
    : toCount(input.payingCustomers),
  cashMode: input.cashMode || null,
  cashValue: toAmount(input.cashValue),
  cashBand: input.cashBand || null,
  outsideFinancingMode: input.outsideFinancingMode || null,
  outsideFinancingValue: toAmount(input.outsideFinancingValue),
  outsideFinancingBand: input.outsideFinancingBand || null,
  // Stamped server-side, never taken from the browser.
  currency: input.currency ? String(input.currency).trim().toUpperCase() : null,
  actorCid,
});

/** Money is valid only if the chosen mode carries its value. */
function validateMoney(payload) {
  const errors = [];
  // Ranges withdrawn (Phase 4). A baseline captured BEFORE this change keeps its
  // band forever; a NEW or superseding capture states the amount.
  if (payload.cashMode === "band" || payload.outsideFinancingMode === "band") {
    errors.push("venture.reporting.validation.bandRemoved");
  }
  if (payload.cashMode === "exact" && payload.cashValue === null) {
    errors.push("venture.reporting.validation.cashValue");
  }
  if (payload.outsideFinancingMode === "exact" && payload.outsideFinancingValue === null) {
    errors.push("venture.reporting.validation.financingValue");
  }
  return errors;
}

export async function getBaseline({ ventureUuid }) {
  await ensureReportingSchema();
  const result = await selectActiveBaseline(ventureUuid);
  return shape((result.rows || [])[0]);
}

/**
 * FTE is a WORKFORCE figure. The founder enters the team once, in the workforce
 * card, and the baseline inherits the equivalent — it is never typed a second
 * time next to the very numbers it is made of. An explicit `fte` still wins for
 * callers that send one; a missing or incomplete snapshot yields `null`
 * ("not reported"), never a zero.
 */
async function fteFromWorkforce(ventureUuid) {
  const period = normalizePeriod(new Date().toISOString().slice(0, 7));
  if (!period) return null;
  const result = await selectTeamSnapshot(ventureUuid, period);
  const row = (result.rows || [])[0];
  if (!row) return null;
  return snapshotFte({
    fullTime: row.full_time_employees,
    partTimeDays: row.part_time_days,
    fullTimeFounders: row.full_time_founders,
  });
}

/** The FTE a capture should store: what the caller stated, else the workforce. */
async function resolveFte({ ventureUuid, input, fallback = null }) {
  const stated = toAmount(input.fte);
  if (stated !== null) return stated;
  const derived = await fteFromWorkforce(ventureUuid);
  return derived === null ? fallback : derived;
}

/** Capture once. A second capture is refused — supersede instead. */
export async function captureBaseline({ ventureUuid, ventureCode, actorCid, input = {} }) {
  await ensureReportingSchema();
  const active = await selectActiveBaseline(ventureUuid);
  if (!canCaptureBaseline((active.rows || [])[0])) {
    return { errors: ["venture.reporting.validation.baselineLocked"] };
  }
  const currency = await currentReportingCurrency(ventureUuid);
  const fte = await resolveFte({ ventureUuid, input });
  const payload = toPayload({ ventureUuid, ventureCode, actorCid, input: { ...input, fte, currency } });
  const errors = validateMoney(payload);
  if (errors.length) return { errors };
  const result = await insertBaseline(payload);
  return { baseline: shape((result.rows || [])[0]) };
}

/** Supersede the active baseline (reason required) and optionally capture a new one. */
export async function supersedeBaseline({ ventureUuid, ventureCode, actorCid, reason, input = null }) {
  await ensureReportingSchema();
  const errors = validateSupersedeReason(reason);
  if (errors.length) return { errors };

  const active = await selectActiveBaseline(ventureUuid);
  if (!(active.rows || []).length) return { errors: ["venture.reporting.validation.noBaseline"] };

  let inserted = null;
  await runInTransaction(async (query) => {
    await supersedeBaselineRow(query, { ventureUuid, actorCid, reason: String(reason).trim() });
    if (input) {
      const currency = await currentReportingCurrency(ventureUuid);
      // A replacement keeps the FTE it knew when no newer workforce snapshot
      // can produce one — otherwise superseding would silently erase it.
      const fte = await resolveFte({
        ventureUuid,
        input,
        fallback: active.rows[0].fte === null || active.rows[0].fte === undefined
          ? null
          : Number(active.rows[0].fte),
      });
      const result = await insertBaseline(
        toPayload({ ventureUuid, ventureCode, actorCid, input: { ...input, fte, currency } }),
        query,
      );
      inserted = (result.rows || [])[0];
    }
  });

  return { baseline: inserted ? shape(inserted) : null };
}
