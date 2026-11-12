import { needsFacilitatorSubmissionScope } from "@/services/ventures/submissions/scope";

const participant = { cid: "P1", role: "member" };

describe("needsFacilitatorSubmissionScope — a participant's own program submissions", () => {
  it("does not ask a participant reading their own rows for a facilitator assignment", () => {
    expect(needsFacilitatorSubmissionScope(participant, "PROG", false, "P1")).toBe(false);
  });

  it("keeps the facilitator check for someone else's rows", () => {
    expect(needsFacilitatorSubmissionScope(participant, "PROG", false, "P2")).toBe(true);
  });

  it("keeps the facilitator check for a whole-program read", () => {
    expect(needsFacilitatorSubmissionScope(participant, "PROG", false, null)).toBe(true);
  });

  it("is unchanged for managers, staff, teams and reads without a program", () => {
    expect(needsFacilitatorSubmissionScope(participant, "PROG", true, "P2")).toBe(false);
    expect(needsFacilitatorSubmissionScope({ cid: "S", role: "staff" }, "PROG", false, "P2")).toBe(false);
    expect(needsFacilitatorSubmissionScope({ cid: "T", role: "team" }, "PROG", false, "P2")).toBe(false);
    expect(needsFacilitatorSubmissionScope(participant, null, false, "P2")).toBe(false);
  });
});
