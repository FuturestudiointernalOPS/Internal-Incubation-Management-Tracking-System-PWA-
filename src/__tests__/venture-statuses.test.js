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
  isJourneyStageUpcoming,
  isJourneyStageComplete,
  MILESTONE_STATUSES,
  isMilestoneComplete,
  isMilestoneHeld,
  HELD_MILESTONE_STATUSES,
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
  test("vocabulary covers upcoming/active/completed only", () => {
    expect(JOURNEY_STAGE_STATUSES).toEqual(["upcoming", "active", "completed"]);
  });

  test("only completed is terminal; upcoming is the not-started state", () => {
    expect(isJourneyStageComplete("completed")).toBe(true);
    expect(isJourneyStageComplete("active")).toBe(false);
    expect(isJourneyStageComplete("upcoming")).toBe(false);
    expect(isJourneyStageUpcoming("upcoming")).toBe(true);
    expect(isJourneyStageUpcoming("active")).toBe(false);
  });
});

describe("ventureStatuses — milestones", () => {
  test("vocabulary matches the founder Journey labels + the two held states", () => {
    expect(MILESTONE_STATUSES).toEqual([
      "upcoming",
      "blocked",
      "not_started",
      "in_progress",
      "under_review",
      "changes_requested",
      "completed",
    ]);
  });

  test("only completed is terminal; upcoming and blocked are held", () => {
    expect(isMilestoneComplete("completed")).toBe(true);
    for (const status of ["upcoming", "blocked", "not_started", "in_progress", "under_review", "changes_requested"]) {
      expect(isMilestoneComplete(status)).toBe(false);
    }
    expect(isMilestoneHeld("upcoming")).toBe(true);
    expect(isMilestoneHeld("blocked")).toBe(true);
    expect(isMilestoneHeld("not_started")).toBe(false);
    // The release sweeps also tolerate the retired `locked` value.
    expect(HELD_MILESTONE_STATUSES).toEqual(["upcoming", "blocked", "locked"]);
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
    for (const status of ["backlog", "todo", "in_progress", "review", "blocked", "cancelled", "rejected", "revision_requested"]) {
      expect(isTaskComplete(status)).toBe(false);
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
