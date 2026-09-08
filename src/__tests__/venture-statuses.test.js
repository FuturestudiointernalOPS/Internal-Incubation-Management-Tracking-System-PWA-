/**
 * Unit tests — canonical Venture OS status vocabulary (Vinance 3, Phase 1).
 *
 * Guards the single source of truth that progress calculations and read
 * layers derive from (src/lib/ventureStatuses.js). If a stored status stops
 * counting as complete here, dashboards/progress change — this file exists
 * to make that decision explicit.
 */

const {
  JOURNEY_STAGE_STATUSES,
  isJourneyStageComplete,
  MILESTONE_STATUSES,
  isMilestoneComplete,
  TASK_BOARD_COLUMNS,
  TASK_REVIEW_OUTCOME_STATUSES,
  TASK_COMPLETED_STATUSES,
  TASK_REVIEW_GATED_COMPLETION_STATUSES,
  isTaskComplete,
  SUBMISSION_STATUSES,
  SUBMISSION_REVIEW_DECISIONS,
  isSubmissionApproved,
} = require("@/lib/ventureStatuses");

describe("ventureStatuses — journey stages", () => {
  test("vocabulary covers locked/active/completed only", () => {
    expect(JOURNEY_STAGE_STATUSES).toEqual(["locked", "active", "completed"]);
  });

  test("only completed is terminal", () => {
    expect(isJourneyStageComplete("completed")).toBe(true);
    expect(isJourneyStageComplete("active")).toBe(false);
    expect(isJourneyStageComplete("locked")).toBe(false);
  });
});

describe("ventureStatuses — milestones", () => {
  test("vocabulary matches the founder Journey labels + locked release state", () => {
    expect(MILESTONE_STATUSES).toEqual([
      "locked",
      "not_started",
      "in_progress",
      "under_review",
      "changes_requested",
      "completed",
    ]);
  });

  test("only completed is terminal; locked is the unreleased state", () => {
    expect(isMilestoneComplete("completed")).toBe(true);
    for (const s of ["not_started", "in_progress", "under_review", "changes_requested", "locked"]) {
      expect(isMilestoneComplete(s)).toBe(false);
    }
  });
});

describe("ventureStatuses — tasks", () => {
  test("kanban board columns keep their legacy order (response contract)", () => {
    expect(TASK_BOARD_COLUMNS).toEqual([
      "backlog",
      "todo",
      "in_progress",
      "review",
      "done",
      "blocked",
      "cancelled",
    ]);
  });

  test("review outcome statuses are explicit", () => {
    expect(TASK_REVIEW_OUTCOME_STATUSES).toEqual([
      "accepted",
      "rejected",
      "revision_requested",
    ]);
  });

  test("terminal-success set = done + accepted (review) + legacy completed", () => {
    expect(TASK_COMPLETED_STATUSES).toEqual(["done", "accepted", "completed"]);
    expect(TASK_REVIEW_GATED_COMPLETION_STATUSES).toEqual(TASK_COMPLETED_STATUSES);
  });

  test("isTaskComplete matches the terminal set only", () => {
    expect(isTaskComplete("done")).toBe(true);
    expect(isTaskComplete("accepted")).toBe(true);
    expect(isTaskComplete("completed")).toBe(true);
    for (const s of ["backlog", "todo", "in_progress", "review", "blocked", "cancelled", "rejected", "revision_requested"]) {
      expect(isTaskComplete(s)).toBe(false);
    }
  });
});

describe("ventureStatuses — submissions", () => {
  test("review decisions are approved | changes_requested", () => {
    expect(SUBMISSION_REVIEW_DECISIONS).toEqual(["approved", "changes_requested"]);
    expect(SUBMISSION_STATUSES).toEqual(["submitted"]);
  });

  test("approval is detected on the review_decision column", () => {
    expect(isSubmissionApproved({ review_decision: "approved" })).toBe(true);
    expect(isSubmissionApproved({ review_decision: "changes_requested" })).toBe(false);
    expect(isSubmissionApproved(null)).toBe(false);
  });
});
