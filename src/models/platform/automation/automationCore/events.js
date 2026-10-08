/**
 * Platform automation event names.
 *
 * Split out of `automationCore.js` so the rule modules import the event names
 * directly, without a require cycle back through the barrel.
 */

export const PLATFORM_EVENTS = {
  RUN_CREATED: "run.created",
  RUN_LAUNCHED: "run.launched",
  RUN_CLOSED: "run.closed",
  SUBMISSION_RECEIVED: "submission.received",
  SUBMISSION_DRAFT_SAVED: "submission.draft_saved",
  REVIEW_COMPLETED: "review.completed",
  ASSIGNMENT_ADDED: "assignment.added",
  DEADLINE_APPROACHING: "deadline.approaching",
};