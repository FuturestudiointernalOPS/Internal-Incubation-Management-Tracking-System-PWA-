/**
 * VENTURE STAGE ENGINE — use cases (spec §4.2, §4.3).
 *
 *   evaluate  → criteria are met / not met / missing, progress, review flag
 *   propose   → a proposal row, never a silent promotion
 *   decide    → the studio approves or rejects; approval is the ONLY writer of
 *               `ventures.business_stage`, and it records history + an event
 */

import {
  runInTransaction,
  selectCurrentProfile,
  selectEvents,
  countEvidenceBackedInterviews,
  selectValidatedReports,
  selectMetricsSeries,
  selectValidatedQuarters,
  selectQuarterMetrics,
  selectVentureStage,
  updateVentureStage,
  selectPendingStageProposal,
  selectStageProposals,
  selectStageHistory,
  supersedePendingProposals,
  insertStageProposal,
  markStageProposal,
  insertStageHistory,
  insertEvent,
  selectMilestoneOnTimeStats,
} from "@/models/ventureReportingStore";
import { ensureReportingSchema, getReportingSettings } from "./settings";
import { rowToMonthlyInput, dateStringOrNull, shapeMetric } from "./monthlyRules";
import { evaluateNextStage, evaluateReviewFlag, STAGES, NEXT_STAGE } from "./stageCriteria";
import { evaluateTrafficLight } from "./trafficLight";

// ── Loading ────────────────────────────────────────────────────────────────

/**
 * Everything a stage evaluation reads, assembled once.
 *
 * Only VALIDATED monthly and quarterly data is used: an unvalidated draft is
 * not evidence, exactly as in the dashboard.
 */
async function loadStageInputs({ ventureUuid }) {
  await ensureReportingSchema();

  // The Venture's business model decides WHICH threshold applies, so it must be
  // read BEFORE the settings — otherwise every per-model override is inert.
  const profileResult = await selectCurrentProfile(ventureUuid);
  const profileRow = (profileResult.rows || [])[0] || null;
  const businessModel = profileRow?.business_model || "default";

  const [
    eventsResult,
    interviewsResult,
    reportsResult,
    seriesResult,
    quartersResult,
    stageResult,
    pendingResult,
    settingsResult,
    milestoneResult,
  ] = await Promise.all([
    selectEvents(ventureUuid),
    countEvidenceBackedInterviews(ventureUuid),
    selectValidatedReports(ventureUuid),
    selectMetricsSeries(ventureUuid),
    selectValidatedQuarters(ventureUuid),
    selectVentureStage(ventureUuid),
    selectPendingStageProposal(ventureUuid),
    getReportingSettings({ businessModel }),
    selectMilestoneOnTimeStats(ventureUuid),
  ]);

  const profile = profileRow
    ? {
        idealCustomerProfile: profileRow.ideal_customer_profile || null,
        problemStatement: profileRow.problem_statement || null,
        businessModel: profileRow.business_model || null,
      }
    : null;

  const events = (eventsResult.rows || []).map((row) => ({
    type: row.event_type,
    date: dateStringOrNull(row.event_date),
  }));

  const months = (reportsResult.rows || [])
    .map(rowToMonthlyInput)
    .filter(Boolean)
    .sort((a, b) => (a.period < b.period ? -1 : 1))
    .map((month) => ({
      period: month.period,
      payingCustomers: month.payingCustomers,
      fullTime: month.fullTime,
      partTimeDays: month.partTimeDays,
      channels: month.channels || [],
    }))
    .slice(-12);

  const metrics = new Map();
  for (const row of seriesResult.rows || []) {
    const period = dateStringOrNull(row.reporting_period);
    if (!period) continue;
    if (!metrics.has(period)) metrics.set(period, {});
    metrics.get(period)[row.metric_key] = shapeMetric(row);
  }

  // The most recent VALIDATED quarter is the only one that counts.
  const quarterRow = (quartersResult.rows || []).slice(-1)[0] || null;
  let quarter = null;
  if (quarterRow) {
    const period = dateStringOrNull(quarterRow.reporting_period);
    const quarterMetrics = await selectQuarterMetrics(ventureUuid, period);
    const byKey = {};
    for (const row of quarterMetrics.rows || []) byKey[row.metric_key] = shapeMetric(row);
    quarter = { period, channels: quarterRow.channels || [], metrics: byKey };
  }

  const stageRow = (stageResult.rows || [])[0] || null;
  const currentStage = STAGES.includes(stageRow?.business_stage) ? stageRow.business_stage : "idea";

  return {
    currentStage,
    profile,
    events,
    interviews: { withEvidence: Number(interviewsResult.rows?.[0]?.total || 0) },
    months,
    metrics,
    quarter,
    settings: settingsResult.settings,
    milestones: {
      dueTotal: Number(milestoneResult?.rows?.[0]?.due_total || 0),
      onTime: Number(milestoneResult?.rows?.[0]?.on_time || 0),
    },
    pendingProposal: (pendingResult.rows || [])[0] || null,
  };
}

const shapeProposal = (row) =>
  row
    ? {
        id: row.id,
        fromStage: row.from_stage,
        toStage: row.to_stage,
        status: row.status,
        progress: row.progress === null ? null : Number(row.progress),
        snapshot: row.snapshot || null,
        createdAt: row.created_at || null,
        decidedAt: row.decided_at || null,
        rejectionReason: row.rejection_reason || null,
      }
    : null;

// ── Read ───────────────────────────────────────────────────────────────────

export async function getStageStatus({ ventureUuid }) {
  const inputs = await loadStageInputs({ ventureUuid });

  const evaluation = evaluateNextStage(inputs);
  const reviewFlag = evaluateReviewFlag(inputs);

  // The traffic light reads the SAME validated months as the stage rules.
  // A figure that was never computed is `unknown`, never red.
  const latest = inputs.months[inputs.months.length - 1] || null;
  const latestMetrics = latest ? inputs.metrics.get(latest.period) || {} : {};
  const runwayMetric = latestMetrics.runway_months;
  const growthMetric = latestMetrics.customer_growth_3m;
  const trafficLight = evaluateTrafficLight({
    runwayMonths:
      runwayMetric && runwayMetric.status === "computed" ? Number(runwayMetric.value) : null,
    customerGrowth:
      growthMetric && growthMetric.status === "computed"
        ? Number(growthMetric.value) * 100
        : null,
    milestones: inputs.milestones,
    settings: inputs.settings,
  });
  const [proposalsResult, historyResult] = await Promise.all([
    selectStageProposals(ventureUuid),
    selectStageHistory(ventureUuid),
  ]);

  return {
    currentStage: evaluation.currentStage,
    nextStage: evaluation.nextStage,
    criteria: evaluation.criteria,
    met: evaluation.met,
    total: evaluation.total,
    missing: evaluation.missing,
    progress: evaluation.progress,
    eligible: evaluation.eligible,
    reviewFlag,
    trafficLight,
    pendingProposal: shapeProposal(inputs.pendingProposal),
    proposals: (proposalsResult.rows || []).map(shapeProposal),
    history: (historyResult.rows || []).map((row) => ({
      fromStage: row.from_stage,
      toStage: row.to_stage,
      progress: row.progress === null ? null : Number(row.progress),
      decidedAt: row.decided_at,
    })),
  };
}

// ── Propose ────────────────────────────────────────────────────────────────

/**
 * Re-evaluate and, when every criterion is met, ensure ONE pending proposal
 * exists. Safe to call after any validation — it is idempotent.
 */
export async function refreshStageProposal({ ventureUuid, ventureCode, actorCid }) {
  const inputs = await loadStageInputs({ ventureUuid });
  const evaluation = evaluateNextStage(inputs);

  if (!evaluation.eligible) {
    return { proposal: null, evaluation, reviewFlag: evaluateReviewFlag(inputs), reason: "not_eligible" };
  }

  // Already proposed for this exact promotion — nothing to do.
  if (
    inputs.pendingProposal &&
    inputs.pendingProposal.to_stage === evaluation.nextStage &&
    inputs.pendingProposal.from_stage === evaluation.currentStage
  ) {
    return {
      proposal: shapeProposal(inputs.pendingProposal),
      evaluation,
      reviewFlag: evaluateReviewFlag(inputs),
      reason: "already_pending",
    };
  }

  const snapshot = {
    currentStage: evaluation.currentStage,
    nextStage: evaluation.nextStage,
    met: evaluation.met,
    total: evaluation.total,
    progress: evaluation.progress,
    criteria: evaluation.criteria,
    evaluatedAt: new Date().toISOString(),
  };

  const created = await runInTransaction(async (query) => {
    await supersedePendingProposals(query, ventureUuid);
    return insertStageProposal(query, {
      ventureUuid,
      ventureCode,
      fromStage: evaluation.currentStage,
      toStage: evaluation.nextStage,
      progress: evaluation.progress,
      snapshot,
      actorCid,
    });
  });

  const proposal = shapeProposal((created.rows || [])[0]);

  // Best effort, AFTER the proposal is committed: the Venture Manager and every
  // Super Admin are told there is something to approve. A mail failure must
  // never undo a proposal that already exists.
  let notified = null;
  try {
    const { notifyStageProposal } = await import("./stageNotify");
    notified = await notifyStageProposal({
      dbId: ventureUuid,
      ventureCode,
      proposal: {
        id: proposal.id,
        fromStage: proposal.fromStage,
        toStage: proposal.toStage,
      },
    });
  } catch (error) {
    console.warn("[venture-stage] notification failed:", error?.message);
  }

  return {
    proposal,
    evaluation,
    reviewFlag: evaluateReviewFlag(inputs),
    notified,
    reason: "created",
  };
}

// ── Decide ─────────────────────────────────────────────────────────────────

/**
 * The studio's decision. Approval is the ONLY place `ventures.business_stage`
 * is written, and it records the history row and a `stage_change` event in the
 * same transaction — so a stage can never move without both.
 */
export async function decideStageProposal({ ventureUuid, ventureCode, actorCid, input = {} }) {
  const action = String(input.action || "").trim();
  if (!["approve", "reject"].includes(action)) {
    return { errors: ["venture.reporting.stage.validation.action"] };
  }

  const reason = String(input.reason || "").trim();
  if (action === "reject" && !reason) {
    return { errors: ["venture.reporting.stage.validation.reason"] };
  }

  const decided = await runInTransaction(async (query) => {
    const pendingResult = await selectPendingStageProposal(ventureUuid);
    const pending = (pendingResult.rows || [])[0] || null;
    if (!pending) return { blocked: "venture.reporting.stage.validation.none" };

    if (action === "reject") {
      await markStageProposal(query, {
        id: pending.id,
        status: "rejected",
        actorCid,
        reason,
      });
      return { row: pending, approved: false };
    }

    await markStageProposal(query, { id: pending.id, status: "approved", actorCid });

    // The current stage is the projection the nav, dashboard and investment
    // readiness already read. It changes HERE and nowhere else.
    await updateVentureStage(query, { ventureUuid, toStage: pending.to_stage });

    await insertStageHistory(query, {
      ventureUuid,
      ventureCode,
      fromStage: pending.from_stage,
      toStage: pending.to_stage,
      progress: pending.progress,
      snapshot: pending.snapshot,
      actorCid,
    });

    // The event log is the human-readable trail of the same fact.
    await insertEvent(query, {
      ventureUuid,
      ventureCode,
      eventType: "stage_change",
      eventDate: new Date().toISOString().slice(0, 10),
      title: `${pending.from_stage} → ${pending.to_stage}`,
      description: "Stage change approved by the studio.",
      statusFrom: pending.from_stage,
      statusTo: pending.to_stage,
      actorCid,
    });

    return { row: pending, approved: true };
  });

  if (decided.blocked) return { errors: [decided.blocked] };
  return { proposal: shapeProposal(decided.row), approved: decided.approved };
}

/** The next stage of a stage, for the UI's "what comes after this". */
export const stageAfter = (stage) => NEXT_STAGE[stage] ?? null;
