/**
 * A deliverable approved, then refused with a request for changes, reads as
 * "changes requested" everywhere — the founder's screen included — even though
 * its lifecycle status was left at `completed` by the earlier approval.
 */
const { deliverableStatusWord } = require("@/lib/ventureStatuses");
const { deriveMilestoneStatusFromDeliverables } = require("@/services/ventures/milestoneEngine/status");

const stale = { status: "completed", approval_status: "rejected", rejection_reason: "need context" };

test("the founder's word for a stale-completed refused deliverable is changes requested", () => {
  expect(deliverableStatusWord(stale).id).toBe("changes_requested");
});

test("an approved one is still approved, and a re-approval wins over the old refusal", () => {
  expect(deliverableStatusWord({ status: "completed", approval_status: "approved" }).id).toBe("approved");
  expect(deliverableStatusWord({ status: "submitted", approval_status: null }).id).toBe("awaiting_review");
});

test("the milestone follows the refusal: it is sent back, not completed", () => {
  expect(deriveMilestoneStatusFromDeliverables([stale, { status: "completed", approval_status: "approved" }])).toBe("changes_requested");
  expect(deriveMilestoneStatusFromDeliverables([{ status: "completed", approval_status: "approved" }])).toBe("completed");
});
