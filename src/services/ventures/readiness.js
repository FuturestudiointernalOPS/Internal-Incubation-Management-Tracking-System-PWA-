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
 * EACH PIECE OF EVIDENCE IS COUNTED IN ONE COMPONENT ONLY. A task that has an
 * approved deliverable is measured by the DELIVERABLES component, not also by
 * the tasks one — otherwise one reviewer's approval moved both, and the score
 * rose twice for a single day's work. `counts.tasks.linked` says how many tasks
 * were handed to that component, so the smaller denominator is explained
 * rather than mysterious.
 *
 * Weights are renormalized over whichever components are defined (> 0), so a
 * Venture with stages but no tasks yet still gets a meaningful signal.
 *
 * This is a pure read layer: no writes. Every statement lives in
 * `@/models/ventureReadinessStore`; nothing here runs SQL. This module used to
 * be re-exported through the `@/lib/ventureReadiness` facade; that facade is
 * gone (CH-4) and importers read this module directly.
 */

import { isJourneyStageComplete, isMilestoneComplete, isTaskComplete, isSubmissionApproved } from "@/lib/ventureStatuses";
import {
  selectReadinessStageStatuses,
  selectReadinessStageStatusesPlain,
  selectReadinessMilestoneStatuses,
  selectReadinessTaskStatuses,
  selectReadinessSubmissionStates,
  selectReadinessDeliverableStates,
  selectReadinessMilestoneGraph,
  selectReadinessStageGraph,
} from "@/models/ventureReadinessStore";

export const READINESS_WEIGHTS = { journeys: 0.3, milestones: 0.3, tasks: 0.25, deliverables: 0.15 };

const OWNERS_IN = (owners) => `IN (${owners.map(() => "?").join(", ")})`;

/**
 * @param opts { dbId (internal UUID), code (VNT-xxx) } — legacy venture rows
 *            may be keyed on either, so both are queried.
 * @returns structured readiness object (never throws on empty data).
 */
export async function computeRoadmapReadiness({ dbId, code }) {
  const owners = [code, dbId].filter(Boolean);
  const ownersSql = owners.length ? OWNERS_IN(owners) : "IN (NULL)";
  const args = owners;

  const [stageResult, milestoneResult, taskResult, submissionResult, deliverableResult, milestoneGraph, stageGraph] = await Promise.all([
    // Archived journeys (soft-deleted) are excluded from the defined
    // progression. Guarded: a pre-migration database without the archive
    // column falls back to the plain stage read.
    selectReadinessStageStatuses(dbId).catch(() =>
      selectReadinessStageStatusesPlain(dbId).catch(() => ({ rows: [] })),
    ),
    selectReadinessMilestoneStatuses(ownersSql, args).catch(() => ({ rows: [] })),
    selectReadinessTaskStatuses(ownersSql, args).catch(() => ({ rows: [] })),
    selectReadinessSubmissionStates(ownersSql, args).catch(() => ({ rows: [] })),
    selectReadinessDeliverableStates(ownersSql, args).catch(() => ({ rows: [] })),
    selectReadinessMilestoneGraph(ownersSql, args).catch(() => ({ rows: [] })),
    selectReadinessStageGraph(dbId).catch(() => ({ rows: [] })),
  ]);

  const stages = stageResult.rows || [];
  const milestones = milestoneResult.rows || [];
  const tasks = taskResult.rows || [];
  const submissions = submissionResult.rows || [];
  const deliverables = deliverableResult.rows || [];

  const totalJourneys = stages.length;
  const completedJourneys = stages.filter((stage) => isJourneyStageComplete(stage.status)).length;
  const totalMilestones = milestones.length;
  const completedMilestones = milestones.filter((milestone) => isMilestoneComplete(milestone.status)).length;

  // A task whose deliverable a reviewer APPROVED is scored by the deliverables
  // component. It is therefore not also scored as a task: one fact, one place.
  const linkedTaskIds = new Set(
    deliverables
      .filter(
        (item) =>
          item.approval_status === "approved" && item.task_id !== null && item.task_id !== undefined,
      )
      .map((item) => String(item.task_id)),
  );
  const standaloneTasks = tasks.filter(
    (task) => task.id === null || task.id === undefined || !linkedTaskIds.has(String(task.id)),
  );
  const totalTasks = standaloneTasks.length;
  const completedTasks = standaloneTasks.filter((task) => isTaskComplete(task.status)).length;

  // The deliverables the journey defines are the evidence set; the older task
  // submissions are only read when a Venture has no deliverables of its own.
  const hasDeliverables = deliverables.length > 0;
  const totalReviewed = hasDeliverables ? deliverables.length : submissions.length;
  const approvedDeliverables = hasDeliverables
    ? deliverables.filter((item) => item.approval_status === "approved").length
    : submissions.filter((submission) => isSubmissionApproved(submission)).length;

  const percent = (done, total) => (total > 0 ? Math.round((done / total) * 100) : null);

  // PARTIAL progress. A milestone is as done as its deliverables are approved
  // (all of it once the milestone is closed); a journey stage is as done as the
  // average of its milestones (all of it once the stage is closed). Counts above
  // stay strict — "2 of 5 milestones done" still means closed. If the detail
  // cannot be read, the strict percentages are used instead.
  const mean = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);
  const graphMilestones = (milestoneGraph.rows || []).map((row) => {
    const total = Number(row.total) || 0;
    const approved = Number(row.approved) || 0;
    return {
      stageId: row.stage_id,
      fraction: isMilestoneComplete(row.status) ? 1 : total > 0 ? Math.min(1, approved / total) : 0,
    };
  });
  const graphStages = stageGraph.rows || [];
  const partialMilestones = graphMilestones.length
    ? Math.round(mean(graphMilestones.map((item) => item.fraction)) * 100)
    : null;
  const partialJourneys = graphStages.length
    ? Math.round(
        mean(
          graphStages.map((stage) =>
            isJourneyStageComplete(stage.status)
              ? 1
              : mean(graphMilestones.filter((item) => item.stageId === stage.id).map((item) => item.fraction)),
          ),
        ) * 100,
      )
    : null;

  const components = {
    journeys: partialJourneys ?? percent(completedJourneys, totalJourneys),
    milestones: partialMilestones ?? percent(completedMilestones, totalMilestones),
    tasks: percent(completedTasks, totalTasks),
    deliverables: totalReviewed > 0 ? percent(approvedDeliverables, totalReviewed) : null,
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
      tasks: {
        total: totalTasks,
        completed: completedTasks,
        linked: linkedTaskIds.size,
      },
      deliverables: { reviewed: totalReviewed, approved: approvedDeliverables, outstanding: totalReviewed - approvedDeliverables },
    },
    weights: READINESS_WEIGHTS,
    calculated_at: new Date().toISOString(),
  };
}
