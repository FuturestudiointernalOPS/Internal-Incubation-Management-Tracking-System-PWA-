/**
 * VENTURE STAGE SWEEP — the scheduled re-evaluation.
 *
 * WHY THIS EXISTS
 * ---------------
 * The stage rules are re-tested automatically after every validation (see the
 * monthly and quarterly services). But a venture can become eligible WITHOUT a
 * new validation:
 *
 *   • the studio lowers a threshold in the settings screen;
 *   • the studio adds evidence (an interview, a pilot) on the Events tab;
 *   • a month crosses an age boundary that changes a 3-month window.
 *
 * A weekly sweep (Mondays) is what notices those. It only ever creates a
 * PENDING proposal: nothing is promoted here, and the studio still approves.
 *
 * Creating a proposal notifies the Venture's Venture Managers and every Super
 * Admin (see `./stageNotify`), once per proposal.
 *
 * It also reports the review flag (§4.3) so a cron could mail it later.
 */

import { selectVenturesForStageSweep } from "@/models/ventureReportingStore";
import { refreshStageProposal } from "./stage";

/**
 * @param {{ ventureCode?: string|null }} options an optional single-venture
 *        sweep, which is how a rule is tested without waiting for tomorrow.
 */
export async function runStageSweep({ ventureCode = null } = {}) {
  const result = await selectVenturesForStageSweep();
  const ventures = (result.rows || []).filter(
    (venture) => !ventureCode || venture.venture_id === ventureCode,
  );

  const report = {
    evaluated: 0,
    eligible: 0,
    created: 0,
    alreadyPending: 0,
    reviewing: 0,
    failed: 0,
    items: [],
  };

  for (const venture of ventures) {
    try {
      const outcome = await refreshStageProposal({
        ventureUuid: venture.id,
        ventureCode: venture.venture_id,
        // A scheduled run has no human actor. The approval will.
        actorCid: null,
      });

      report.evaluated += 1;
      if (outcome.evaluation?.eligible) report.eligible += 1;
      if (outcome.reason === "created") report.created += 1;
      if (outcome.reason === "already_pending") report.alreadyPending += 1;

      // The review flag is a decision prompt, so it is delivered to the
      // Venture Managers and the Super Admins — at most once per validated
      // month, never once per sweep.
      if (outcome.reviewFlag?.flagged) {
        report.reviewing += 1;
        const periods = (outcome.reviewFlag.months || [])
          .map((month) => month.period)
          .filter(Boolean);
        try {
          const { notifyStageReview } = await import("./stageNotify");
          await notifyStageReview({
            dbId: venture.id,
            ventureCode: venture.venture_id,
            monthsBelow: outcome.reviewFlag.monthsBelow,
            latestPeriod: periods[periods.length - 1] || null,
          });
        } catch (error) {
          console.warn("[venture-stage] review flag notification failed:", error?.message);
        }
      }

      report.items.push({
        venture: venture.venture_id,
        currentStage: outcome.evaluation?.currentStage ?? null,
        nextStage: outcome.evaluation?.nextStage ?? null,
        eligible: Boolean(outcome.evaluation?.eligible),
        missing: outcome.evaluation?.missing ?? null,
        reason: outcome.reason,
        reviewFlag: Boolean(outcome.reviewFlag?.flagged),
        proposalId: outcome.proposal?.id ?? null,
        notified: outcome.notified ?? null,
      });
    } catch (error) {
      // One broken venture must never stop the sweep for the others.
      report.failed += 1;
      report.items.push({ venture: venture.venture_id, error: error?.message || "unknown" });
    }
  }

  return report;
}
