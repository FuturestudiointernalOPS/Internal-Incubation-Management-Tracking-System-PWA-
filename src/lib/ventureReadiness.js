/**
 * Venture roadmap readiness engine (Vinance 3 — Phase 3).
 *
 * Investment Readiness over the DEFINED Venture progression (doc §12–15):
 * Journey stages → Milestones → Tasks → approved Deliverables, across the
 * whole roadmap — not just whatever happens to be active today. Anything the
 * manager adds later participates automatically because every count is
 * computed live from the canonical spine.
 *
 * Scoring (transparent, weighted):
 *   journeys      30%  — completed stages / total stages
 *   milestones    30%  — completed milestones / total milestones
 *   tasks         25%  — terminal-success tasks / total tasks
 *   deliverables  15%  — approved submissions / submissions reviewed
 *
 * Weights are renormalized over whichever components are defined (> 0), so a
 * Venture with stages but no tasks yet still gets a meaningful signal.
 *
 * This is a pure read layer: no writes, no schema access beyond SELECT.
 */

import { isJourneyStageComplete, isMilestoneComplete, isTaskComplete, isSubmissionApproved } from "@/lib/ventureStatuses";

export const READINESS_WEIGHTS = { journeys: 0.3, milestones: 0.3, tasks: 0.25, deliverables: 0.15 };

const OWNERS_IN = (owners) => `IN (${owners.map(() => "?").join(", ")})`;

/**
 * @param db  db handle
 * @param opts { dbId (internal UUID), code (VNT-xxx) } — legacy venture rows
 *            may be keyed on either, so both are queried.
 * @returns structured readiness object (never throws on empty data).
 */
export async function computeRoadmapReadiness(db, { dbId, code }) {
  const owners = [code, dbId].filter(Boolean);
  const ownersSql = owners.length ? OWNERS_IN(owners) : "IN (NULL)";
  const args = owners;

  const [stageRes, msRes, taskRes, subRes] = await Promise.all([
    db.execute({
      sql: `SELECT status FROM venture_journey_stages WHERE venture_id = ?`,
      args: [dbId],
    }).catch(() => ({ rows: [] })),
    db.execute({
      sql: `SELECT status FROM venture_milestones WHERE venture_id ${ownersSql}`,
      args,
    }).catch(() => ({ rows: [] })),
    db.execute({
      sql: `SELECT status FROM venture_tasks WHERE venture_id ${ownersSql}`,
      args,
    }).catch(() => ({ rows: [] })),
    db.execute({
      sql: `SELECT s.status, s.review_decision
            FROM venture_task_submissions s
            JOIN venture_tasks t ON t.id = s.task_id
            WHERE t.venture_id ${ownersSql}`,
      args,
    }).catch(() => ({ rows: [] })),
  ]);

  const stages = stageRes.rows || [];
  const milestones = msRes.rows || [];
  const tasks = taskRes.rows || [];
  const submissions = subRes.rows || [];

  const totalJourneys = stages.length;
  const completedJourneys = stages.filter((s) => isJourneyStageComplete(s.status)).length;
  const totalMilestones = milestones.length;
  const completedMilestones = milestones.filter((m) => isMilestoneComplete(m.status)).length;
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => isTaskComplete(t.status)).length;
  const totalReviewed = submissions.length;
  const approvedDeliverables = submissions.filter((s) => isSubmissionApproved(s)).length;

  const pct = (done, total) => (total > 0 ? Math.round((done / total) * 100) : null);

  const components = {
    journeys: pct(completedJourneys, totalJourneys),
    milestones: pct(completedMilestones, totalMilestones),
    tasks: pct(completedTasks, totalTasks),
    deliverables: totalReviewed > 0 ? pct(approvedDeliverables, totalReviewed) : null,
  };

  // Weighted average over defined components, renormalized.
  let score = 0;
  let weightSum = 0;
  for (const [key, weight] of Object.entries(READINESS_WEIGHTS)) {
    if (components[key] !== null) {
      score += components[key] * weight;
      weightSum += weight;
    }
  }
  const overallPercent = weightSum > 0 ? Math.round(score / weightSum) : 0;

  return {
    overall_percent: overallPercent,
    components,
    counts: {
      journeys: { total: totalJourneys, completed: completedJourneys },
      milestones: { total: totalMilestones, completed: completedMilestones },
      tasks: { total: totalTasks, completed: completedTasks },
      deliverables: { reviewed: totalReviewed, approved: approvedDeliverables, outstanding: totalReviewed - approvedDeliverables },
    },
    weights: READINESS_WEIGHTS,
    calculated_at: new Date().toISOString(),
  };
}

export default { computeRoadmapReadiness };
