/**
 * VENTURE MONTHLY REPORTING — use cases.
 *
 * The lifecycle in one place (spec §13.3):
 *
 *     draft ──submit──▶ submitted ──validate──▶ validated
 *                                 └──reject────▶ rejected
 *
 * Who may do what is NOT decided here: the routes gate writes on `ventures.edit`
 * (scoped to the founder's Venture) and decisions on `ventures.validate`. This
 * module only refuses transitions that would corrupt the history.
 *
 * Rules it enforces:
 *   • a submitted report is frozen — the founder cannot edit under review;
 *   • a correction after validation creates version N+1, never an overwrite;
 *   • validating supersedes the previous validated row in the same transaction;
 *   • only validated data is ever written to `venture_metrics_monthly`.
 */

import {
  runInTransaction,
  selectBands,
  selectCurrentProfile,
  selectMonthlyReports,
  selectMonthlyReportVersions,
  selectOpenReport,
  selectValidatedReports,
  selectNextReportVersion,
  insertMonthlyReport,
  updateOpenReport,
  markReportSubmitted,
  supersedeValidatedReports,
  markReportValidated,
  markReportRejected,
  selectMetrics,
  upsertMetrics,
} from "@/models/ventureReportingStore";
import { ensureReportingSchema, getReportingSettings } from "./settings";
import { dueStateFor } from "./schedule";
import { groupBands, normalizePeriod, shiftPeriod, currentPeriod } from "./rules";
import {
  validateMonthlyReport,
  monthlyRowValues,
  rowToMonthlyInput,
  signedNumberOrNull,
  shapeMetric,
} from "./monthlyRules";
import { computeMonthlyMetrics } from "./metrics";

// ── Shaping ────────────────────────────────────────────────────────────────

/**
 * The currency a NEW report is filed in: the Venture's reporting currency at
 * the moment of filing. It is written ON the row, so a later change to the
 * Venture's setting never re-labels a month that was already reported.
 */
export async function currentReportingCurrency(ventureUuid) {
  try {
    const result = await selectCurrentProfile(ventureUuid);
    const code = (result.rows || [])[0]?.reporting_currency;
    return code ? String(code).trim().toUpperCase() : "XOF";
  } catch {
    return "XOF";
  }
}

function shapeReport(row) {
  if (!row) return null;
  const input = rowToMonthlyInput(row);
  return {
    id: row.id,
    period: input.period,
    version: row.version,
    status: row.status,
    // The eleven inputs, in the exact-or-band shape the UI renders.
    mrr: input.mrr,
    otherRevenue: input.otherRevenue,
    expenses: input.expenses,
    cash: input.cash,
    financingReceived: input.financingReceived,
    activeUsers: input.activeUsers,
    payingCustomers: input.payingCustomers,
    newPayingCustomers: input.newPayingCustomers,
    fullTime: input.fullTime,
    partTime: input.partTime,
    partTimeDays: input.partTimeDays,
    fullTimeFounders: input.fullTimeFounders,
    northStarValue: input.northStarValue,
    narrative: input.narrative,
    // The currency this month was filed in. Older rows have none; the caller
    // then falls back to the Venture's current reporting currency.
    currency: input.currency || null,
    channels: input.channels || [],
    // Two dates on every record (spec §13.6): the period, and when it was sent.
    submittedAt: row.submitted_at ?? null,
    validatedAt: row.validated_at ?? null,
    rejectedAt: row.rejected_at ?? null,
    rejectionReason: row.rejection_reason ?? null,
    supersededAt: row.superseded_at ?? null,
    createdAt: row.created_at ?? null,
  };
}

export { shapeMetric };

/** period → normalised input, for every live validated month. */
function buildHistory(rows = []) {
  const history = new Map();
  for (const row of rows) {
    const input = rowToMonthlyInput(row);
    if (input?.period) history.set(input.period, input);
  }
  return history;
}

// ── Reads ──────────────────────────────────────────────────────────────────

/** The whole submission history of a Venture (newest month, newest version first). */
export async function listMonthlyReports({ ventureUuid }) {
  await ensureReportingSchema();
  const result = await selectMonthlyReports(ventureUuid);
  return { reports: (result.rows || []).map(shapeReport) };
}

/**
 * One month: the open report (if any), the live validated report, the full
 * version history, the stored metrics, and a live PREVIEW of the draft.
 *
 * The preview is computed, never stored — nothing that has not been validated
 * may reach `venture_metrics_monthly`.
 */
export async function getMonthlyReport({ ventureUuid, period }) {
  await ensureReportingSchema();

  const normalised = normalizePeriod(period);
  if (!normalised) return { errors: ["venture.reporting.monthly.validation.period"] };

  const [versionsResult, metricsResult, bandsResult, validatedResult, reporting] = await Promise.all([
    selectMonthlyReportVersions(ventureUuid, normalised),
    selectMetrics(ventureUuid, normalised),
    selectBands(),
    selectValidatedReports(ventureUuid),
    getReportingSettings({}),
  ]);

  const versions = versionsResult.rows || [];
  const open = versions.find((row) => row.status === "draft" || row.status === "submitted") || null;
  const validated = versions.find((row) => row.status === "validated" && !row.superseded_at) || null;
  const latest = open || validated || versions[0] || null;

  // The currency the FORM is labelled in: the report's own when one exists,
  // otherwise the Venture's current setting (a month not yet filed in).
  const currency = latest?.currency
    ? String(latest.currency).toUpperCase()
    : await currentReportingCurrency(ventureUuid);

  // The band ladders the founder chooses from, so the form never hardcodes the
  // studio's thresholds and a changed band shows up without a deploy. Only the
  // ladder of the currency this report is denominated in is offered.
  const groupedBands = groupBands(bandsResult.rows || [], currency);

  // A draft (and a submitted report awaiting review) gets a live preview. It is
  // computed, never stored — nothing unvalidated may reach the metrics table.
  let preview = null;
  if (open) {
    preview = computeMonthlyMetrics({
      report: rowToMonthlyInput(open),
      history: buildHistory(validatedResult.rows),
      bands: groupedBands,
    });
  }

  return {
    period: normalised,
    currency,
    report: shapeReport(latest),
    open: shapeReport(open),
    validated: shapeReport(validated),
    history: versions.map(shapeReport),
    metrics: (metricsResult.rows || []).map(shapeMetric),
    bands: groupedBands,
    // When this month is due, from the studio's own schedule.
    schedule: dueStateFor({
      period: normalised,
      kind: "monthly",
      settings: reporting.settings,
      validated: Boolean(validated) && !open,
    }),
    preview,
  };
}

// ── Writes ─────────────────────────────────────────────────────────────────

/**
 * Save the founder's month. `input.submit` moves it to `submitted` in the same
 * transaction, so a report can never be left half-sent.
 *
 * Returns `{ report }` or `{ errors: [i18nKey] }`.
 */
export async function saveMonthlyReport({ ventureUuid, ventureCode, actorCid, input = {} }) {
  await ensureReportingSchema();

  const period = normalizePeriod(input.period);
  if (!period) return { errors: ["venture.reporting.monthly.validation.period"] };
  if (period > currentPeriod()) return { errors: ["venture.reporting.monthly.validation.futurePeriod"] };

  // ONE read of the Venture's currency, used for both the band ladder and the
  // stamp on the row: two reads could disagree if the setting changed between
  // them, and the report must carry the unit it was validated against.
  const currency = await currentReportingCurrency(ventureUuid);
  const bandsResult = await selectBands();
  // Validate band codes against the ladder of the currency the month will be
  // filed in — a CFA code on a USD report is not a valid answer.
  const bands = groupBands(bandsResult.rows || [], currency);

  const errors = validateMonthlyReport(input, { bands });
  if (errors.length) return { errors };

  const submit = input.submit === true || input.submit === "yes";
  // Stamped from the Venture's setting, never from the browser: the report is
  // the record of what was filed, and a client cannot rewrite the unit.
  const values = monthlyRowValues({ input: { ...input, currency }, actorCid });

  const saved = await runInTransaction(async (query) => {
    const openResult = await selectOpenReport(ventureUuid, period);
    const open = (openResult.rows || [])[0] || null;

    // Frozen under review: the studio is looking at exactly this version.
    if (open && open.status === "submitted") {
      return { blocked: "venture.reporting.monthly.validation.alreadySubmitted" };
    }

    // A draft is edited in place — it is not yet part of the record.
    if (open) {
      const updated = await updateOpenReport(query, open.id, values);
      const row = (updated.rows || [])[0];
      if (!submit) return { row };
      const moved = await markReportSubmitted(query, row.id, actorCid);
      return { row: (moved.rows || [])[0] || row };
    }

    // No open report: this is either the first submission for the month, or a
    // correction of a month that is already validated / was rejected.
    const nextResult = await selectNextReportVersion(query, ventureUuid, period);
    const version = Number(nextResult.rows?.[0]?.next_version || 1);
    const inserted = await insertMonthlyReport(query, {
      ventureUuid,
      ventureCode,
      period,
      version,
      status: "draft",
      ...values,
    });
    const row = (inserted.rows || [])[0];
    if (!submit) return { row };
    const moved = await markReportSubmitted(query, row.id, actorCid);
    return { row: (moved.rows || [])[0] || row };
  });

  if (saved.blocked) return { errors: [saved.blocked] };
  return { report: shapeReport(saved.row) };
}

/**
 * The studio's decision. Only a `submitted` report can be decided on.
 *
 * Validation is the ONLY path that writes metrics, which is what makes
 * "only validated data feeds the dashboard" true by construction.
 */
export async function decideMonthlyReport({ ventureUuid, ventureCode, actorCid, input = {} }) {
  await ensureReportingSchema();

  const period = normalizePeriod(input.period);
  if (!period) return { errors: ["venture.reporting.monthly.validation.period"] };

  const action = String(input.action || "").trim();
  if (!["validate", "reject"].includes(action)) {
    return { errors: ["venture.reporting.monthly.validation.action"] };
  }

  const reason = String(input.reason || "").trim();
  if (action === "reject" && !reason) {
    return { errors: ["venture.reporting.monthly.validation.reason"] };
  }

  const decided = await runInTransaction(async (query) => {
    const openResult = await selectOpenReport(ventureUuid, period);
    const open = (openResult.rows || [])[0] || null;
    if (!open || open.status !== "submitted") {
      return { blocked: "venture.reporting.monthly.validation.notSubmitted" };
    }

    if (action === "reject") {
      const rejected = await markReportRejected(query, open.id, { actorCid, reason });
      return { row: (rejected.rows || [])[0], recompute: false };
    }

    // Retire the month's previous truth BEFORE promoting its replacement, so
    // `idx_vmr_one_validated` never sees two live validated rows.
    await supersedeValidatedReports(query, {
      ventureUuid,
      period,
      actorCid,
      reason: `Replaced by version ${open.version}`,
    });
    const validated = await markReportValidated(query, open.id, actorCid);
    return { row: (validated.rows || [])[0], recompute: true };
  });

  if (decided.blocked) return { errors: [decided.blocked] };

  let metrics = null;
  if (decided.recompute) {
    metrics = await recomputeMonthlyMetrics({ ventureUuid, ventureCode, period });
  }

  // AUTOMATIC STAGE RE-EVALUATION (spec §4.3 step 3-5). The moment a month is
  // validated the numbers change, so the stage rules are re-tested and a
  // proposal is queued when every criterion is met. The studio still confirms
  // it — nothing is promoted here.
  //
  // Wrapped on purpose: a stage-engine fault must NEVER undo a validation.
  let stage = null;
  if (decided.recompute) {
    try {
      const { refreshStageProposal } = await import("./stage");
      stage = await refreshStageProposal({ ventureUuid, ventureCode, actorCid });
    } catch (error) {
      console.warn("[venture-stage] automatic proposal failed:", error?.message);
    }
  }

  return { report: shapeReport(decided.row), metrics, stage };
}

/**
 * Rewrite the metrics for the month that changed AND the three that follow it.
 *
 * Churn reads last month; three-month growth reads three back. Changing
 * October therefore makes October, November, December and January stale, and
 * a dashboard that silently kept the old November would be worse than none.
 *
 * Months with no validated report are skipped — never zero-filled.
 */
export async function recomputeMonthlyMetrics({ ventureUuid, ventureCode, period }) {
  await ensureReportingSchema();

  const [bandsResult, validatedResult] = await Promise.all([
    selectBands(),
    selectValidatedReports(ventureUuid),
  ]);
  // Bands are read in the currency of the month being recomputed: the ladder is
  // absolute amounts and cannot grade another currency.
  const rows = validatedResult.rows || [];
  const history = buildHistory(rows);
  const currency = history.get(period)?.currency || (await currentReportingCurrency(ventureUuid));
  const bands = groupBands(bandsResult.rows || [], currency);
  const reportIdByPeriod = new Map(rows.map((row) => [rowToMonthlyInput(row)?.period, row.id]));

  const written = [];
  await runInTransaction(async (query) => {
    for (let offset = 0; offset <= 3; offset += 1) {
      const target = shiftPeriod(period, offset);
      const report = history.get(target);
      if (!report) continue;

      const metrics = computeMonthlyMetrics({ report, history, bands });
      await upsertMetrics(query, {
        ventureUuid,
        ventureCode,
        period: target,
        reportId: reportIdByPeriod.get(target) || null,
        metrics,
      });
      written.push({ period: target, metrics });
    }
  });

  return written;
}
