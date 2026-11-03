import {
  runInTransaction,
  selectActiveBaseline,
  insertBaseline,
  supersedeBaseline as supersedeBaselineRow,
} from "@/models/ventureReportingStore";
import { ensureReportingSchema } from "./settings";
import { canCaptureBaseline, validateSupersedeReason, toAmount, toCount } from "./rules";
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
  if (payload.cashMode === "exact" && payload.cashValue === null) {
    errors.push("venture.reporting.validation.cashValue");
  }
  if (payload.cashMode === "band" && !payload.cashBand) {
    errors.push("venture.reporting.validation.cashBand");
  }
  if (payload.outsideFinancingMode === "exact" && payload.outsideFinancingValue === null) {
    errors.push("venture.reporting.validation.financingValue");
  }
  if (payload.outsideFinancingMode === "band" && !payload.outsideFinancingBand) {
    errors.push("venture.reporting.validation.financingBand");
  }
  return errors;
}

export async function getBaseline({ ventureUuid }) {
  await ensureReportingSchema();
  const result = await selectActiveBaseline(ventureUuid);
  return shape((result.rows || [])[0]);
}

/** Capture once. A second capture is refused — supersede instead. */
export async function captureBaseline({ ventureUuid, ventureCode, actorCid, input = {} }) {
  await ensureReportingSchema();
  const active = await selectActiveBaseline(ventureUuid);
  if (!canCaptureBaseline((active.rows || [])[0])) {
    return { errors: ["venture.reporting.validation.baselineLocked"] };
  }
  const currency = await currentReportingCurrency(ventureUuid);
  const payload = toPayload({ ventureUuid, ventureCode, actorCid, input: { ...input, currency } });
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
      const result = await insertBaseline(
        toPayload({ ventureUuid, ventureCode, actorCid, input: { ...input, currency } }),
        query,
      );
      inserted = (result.rows || [])[0];
    }
  });

  return { baseline: inserted ? shape(inserted) : null };
}
