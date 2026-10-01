/**
 * Lane L2 — the review decision reading moved out of the deliverables
 * controller (`services/ventures/deliverableReview.js`).
 */
jest.mock("@/lib/ventureMilestoneEngine", () => ({}));
jest.mock("@/lib/ventures", () => ({}));

const { readDeliverableDecision } = require("@/services/ventures/deliverableReview");

describe("readDeliverableDecision", () => {
  test("approved, comments optional and trimmed", () => {
    expect(readDeliverableDecision({ decision: "approved" })).toEqual({ ok: true, decision: "approved", comments: null });
    expect(readDeliverableDecision({ decision: "approved", comments: "  ok " })).toEqual({ ok: true, decision: "approved", comments: "ok" });
  });

  test("changes requested needs a comment", () => {
    expect(readDeliverableDecision({ decision: "changes_requested", comments: "  " }))
      .toEqual({ ok: false, error: "Comments are required when requesting changes." });
    expect(readDeliverableDecision({ decision: "changes_requested", comments: "Add numbers" }))
      .toEqual({ ok: true, decision: "changes_requested", comments: "Add numbers" });
  });

  test("any other decision is refused", () => {
    for (const body of [{}, { decision: "rejected" }, null]) {
      expect(readDeliverableDecision(body)).toEqual({ ok: false, error: "decision (approved|changes_requested) is required." });
    }
  });
});
