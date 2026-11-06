jest.mock("@/models/investor/activityLog", () => ({ selectInvestorContext: jest.fn() }));
jest.mock("@/models/investor/venturesAndUpdates", () => ({ findVisibleInvestorVenture: jest.fn() }));
jest.mock("@/services/investor/featureFlags", () => ({ readInvestorFlags: jest.fn() }));
jest.mock("@/services/investor/activity", () => ({ emitInvestorEvent: jest.fn() }));
const { selectInvestorContext } = require("@/models/investor/activityLog");
const { findVisibleInvestorVenture } = require("@/models/investor/venturesAndUpdates");
const { readInvestorFlags } = require("@/services/investor/featureFlags");
const { emitInvestorEvent } = require("@/services/investor/activity");
const { recordVerifiedInvestorInteraction } = require("@/services/investor/interactions");
const session = { cid: "SYNTHETIC", role: "member" };
beforeEach(() => {
  jest.clearAllMocks();
  readInvestorFlags.mockResolvedValue({ activity: true });
  selectInvestorContext.mockResolvedValue({ rows: [{ id: "investor-uuid", approval_status: "approved", visibility_mode: "deal_flow_only" }] });
  findVisibleInvestorVenture.mockImplementation(async ref => ({ rows: [{ id: `canonical-${ref}` }] }));
  emitInvestorEvent.mockResolvedValue("event-id");
});
test.each([
  ["login", ["one"]], ["investment_recorded", ["one"]], ["venture_viewed", []],
  ["venture_viewed", ["one", "two"]], ["compare_used", ["one"]],
  ["compare_used", ["one", "two", "three", "four", "five"]],
  ["compare_used", ["one", "one"]], ["venture_viewed", [{ id: "one" }]],
])("rejects untrusted interaction %s/%p", async (kind, ventureIds) => {
  expect((await recordVerifiedInvestorInteraction({ session, kind, ventureIds })).status).toBe(400);
  expect(emitInvestorEvent).not.toHaveBeenCalled();
});
test("disabled flag performs no identity/directory lookup or event write", async () => {
  readInvestorFlags.mockResolvedValue({ activity: false });
  expect(await recordVerifiedInvestorInteraction({ session, kind: "venture_viewed", ventureIds: ["one"] })).toEqual({ ok: true, recorded: false });
  expect(selectInvestorContext).not.toHaveBeenCalled();
  expect(findVisibleInvestorVenture).not.toHaveBeenCalled();
  expect(emitInvestorEvent).not.toHaveBeenCalled();
});
test("server resolves context and visible canonical IDs before writing", async () => {
  expect(await recordVerifiedInvestorInteraction({ session, kind: "venture_viewed", ventureIds: ["VNT-DEMO"] })).toEqual({ ok: true, recorded: true });
  expect(findVisibleInvestorVenture).toHaveBeenCalledWith("VNT-DEMO", "deal_flow_only");
  expect(emitInvestorEvent).toHaveBeenCalledWith({ session, investorId: "investor-uuid", eventType: "venture_viewed", ventureId: "canonical-VNT-DEMO", metadata: null });
});
test("guessing an unavailable venture records nothing", async () => {
  findVisibleInvestorVenture.mockResolvedValue({ rows: [] });
  expect((await recordVerifiedInvestorInteraction({ session, kind: "venture_viewed", ventureIds: ["hidden"] })).status).toBe(404);
  expect(emitInvestorEvent).not.toHaveBeenCalled();
});
test("pending approval cannot submit events", async () => {
  selectInvestorContext.mockResolvedValue({ rows: [{ approval_status: "pending_review" }] });
  expect((await recordVerifiedInvestorInteraction({ session, kind: "venture_viewed", ventureIds: ["one"] })).status).toBe(403);
  expect(emitInvestorEvent).not.toHaveBeenCalled();
});
test("two aliases of the same venture do not inflate comparison size", async () => {
  findVisibleInvestorVenture.mockResolvedValue({ rows: [{ id: "same-uuid" }] });
  expect((await recordVerifiedInvestorInteraction({ session, kind: "compare_used", ventureIds: ["code", "uuid"] })).status).toBe(400);
  expect(emitInvestorEvent).not.toHaveBeenCalled();
});
test("one comparison creates one server event containing its permitted IDs", async () => {
  await recordVerifiedInvestorInteraction({ session, kind: "compare_used", ventureIds: ["one", "two"] });
  expect(emitInvestorEvent).toHaveBeenCalledTimes(1);
  expect(emitInvestorEvent.mock.calls[0][0].metadata).toEqual({ venture_ids: ["canonical-one", "canonical-two"] });
});
