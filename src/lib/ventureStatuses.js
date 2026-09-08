/**
 * Venture OS canonical status vocabulary (Vinance 3 — Phase 1).
 *
 * Single source of truth for the statuses stored by the canonical
 * Journey → Milestone → Task → Submission spine. Progress calculations,
 * completion guards and read layers should derive from these helpers
 * instead of hardcoding literals.
 *
 * IMPORTANT: stored values are NEVER renamed or rewritten here. These
 * constants simply centralize the vocabulary that read layers rely on,
 * so "what counts as complete" is decided in exactly one place.
 */

// ─── Journey stages (venture_journey_stages.status) ───────────────────────
export const JOURNEY_STAGE_STATUSES = ["locked", "active", "completed"];
export const JOURNEY_STAGE_COMPLETED = "completed";

export function isJourneyStageComplete(status) {
  return status === JOURNEY_STAGE_COMPLETED;
}

// ─── Milestones (venture_milestones.status) ────────────────────────────────
// "locked" (Vinance 3 Phase 3): milestone is part of the roadmap but not yet
// released — the previous milestone in its Journey stage must be completed
// (approved by the Lead Manager / Super Admin) before it unlocks.
export const MILESTONE_STATUSES = [
  "locked",
  "not_started",
  "in_progress",
  "under_review",
  "changes_requested",
  "completed",
];
export const MILESTONE_COMPLETED = "completed";
export const MILESTONE_LOCKED = "locked";

export function isMilestoneComplete(status) {
  return status === MILESTONE_COMPLETED;
}

export function isMilestoneLocked(status) {
  return status === MILESTONE_LOCKED;
}

// ─── Tasks (venture_tasks.status) ──────────────────────────────────────────
// Board columns: the statuses the Kanban groups by (order = column order).
export const TASK_BOARD_COLUMNS = [
  "backlog",
  "todo",
  "in_progress",
  "review",
  "done",
  "blocked",
  "cancelled",
];

// Statuses written by the staff review flows (task reviews + submissions).
export const TASK_REVIEW_OUTCOME_STATUSES = [
  "accepted",
  "rejected",
  "revision_requested",
];

// Terminal-success statuses — what progress calculations count as complete.
// "done" is the board status; "accepted" is a task completed through review;
// "completed" is the legacy alias some older tools wrote.
export const TASK_COMPLETED_STATUSES = ["done", "accepted", "completed"];

// Completion statuses that are gated on an approved submission when the task
// is configured review_required = TRUE (completion authority, D5).
export const TASK_REVIEW_GATED_COMPLETION_STATUSES = TASK_COMPLETED_STATUSES;

export function isTaskComplete(status) {
  return TASK_COMPLETED_STATUSES.includes(status);
}

// ─── Task submissions (venture_task_submissions) ──────────────────────────
export const SUBMISSION_STATUSES = ["submitted"];
export const SUBMISSION_REVIEW_DECISIONS = ["approved", "changes_requested"];

export function isSubmissionApproved(submission) {
  return Boolean(submission && submission.review_decision === "approved");
}
