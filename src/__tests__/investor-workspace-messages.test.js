jest.mock("@/models/investorRelations/relationships", () => ({
  getRelationshipWorkspaceDetail: jest.fn(),
  listFounderCidsForVenture: jest.fn(),
}));
jest.mock("@/models/investor/workspaceMessages", () => ({
  countUnreadWorkspaceMessages: jest.fn(),
  insertWorkspaceMessage: jest.fn(),
  listWorkspaceMessages: jest.fn(),
  markWorkspaceMessagesRead: jest.fn(),
}));
jest.mock("@/models/investor/meetingSlots", () => ({
  listWorkspacesByInvestor: jest.fn(),
  listWorkspacesByVentureIds: jest.fn(),
}));
jest.mock("@/models/authorization/contextGrantsStore", () => ({
  listActiveFounderVentures: jest.fn(),
}));
jest.mock("@/services/investor/activity", () => ({
  emitInvestorEvent: jest.fn(),
  resolveInvestorContext: jest.fn(),
}));

const relations = require("@/models/investorRelations/relationships");
const messages = require("@/models/investor/workspaceMessages");
const meetingSlots = require("@/models/investor/meetingSlots");
const grants = require("@/models/authorization/contextGrantsStore");
const activity = require("@/services/investor/activity");
const {
  readWorkspaceConversation,
  countUnreadWorkspaceMessagesForCaller,
  sendWorkspaceMessage,
} = require("@/services/investor/workspaceMessages");

const investorSession = { cid: "investor-cid", role: "investor" };
const workspaceId = "11111111-1111-4111-8111-111111111111";
const workspace = {
  id: workspaceId,
  status: "active",
  investor_id: "profile-uuid",
  investor_cid: "investor-cid",
  venture_id: "venture-uuid",
};

describe("investor workspace conversations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    relations.getRelationshipWorkspaceDetail.mockResolvedValue({ rows: [workspace] });
    relations.listFounderCidsForVenture.mockResolvedValue({ rows: [{ cid: "founder-cid" }] });
    grants.listActiveFounderVentures.mockResolvedValue([]);
    activity.resolveInvestorContext.mockResolvedValue({
      investorId: "profile-uuid",
      approvalStatus: "approved",
    });
    messages.insertWorkspaceMessage.mockResolvedValue({
      rows: [{ id: 12, sender_id: "investor-cid", body: "Hello", is_read: false }],
    });
    messages.markWorkspaceMessagesRead.mockResolvedValue({ rows: [] });
    messages.listWorkspaceMessages.mockResolvedValue({ rows: [] });
    messages.countUnreadWorkspaceMessages.mockResolvedValue({ rows: [{ unread_count: 2 }] });
    meetingSlots.listWorkspacesByInvestor.mockResolvedValue({ rows: [{ id: workspaceId, status: "active" }] });
    meetingSlots.listWorkspacesByVentureIds.mockResolvedValue({ rows: [] });
  });

  it("allows only the approved workspace investor to send messages", async () => {
    const result = await sendWorkspaceMessage({
      workspaceId,
      body: "  Hello  ",
      session: investorSession,
    });

    expect(result).toMatchObject({ ok: true, message: { body: "Hello", from_me: true } });
    expect(messages.insertWorkspaceMessage).toHaveBeenCalledWith({
      workspaceId,
      senderId: "investor-cid",
      body: "Hello",
    });
    expect(activity.emitInvestorEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "message_sent",
      actorType: "investor",
    }));
  });

  it("allows an active venture founder to read the same workspace thread", async () => {
    grants.listActiveFounderVentures.mockResolvedValue(["venture-uuid"]);
    activity.resolveInvestorContext.mockResolvedValue({ investorId: null });
    messages.listWorkspaceMessages.mockResolvedValue({
      rows: [{ id: 12, sender_id: "investor-cid", body: "Hello", is_read: true }],
    });

    const result = await readWorkspaceConversation({
      workspaceId,
      session: { cid: "founder-cid", role: "founder" },
    });

    expect(result).toMatchObject({
      ok: true,
      messages: [{ id: 12, body: "Hello", from_me: false }],
    });
  });

  it("denies a different investor and writes no messages", async () => {
    activity.resolveInvestorContext.mockResolvedValue({
      investorId: "other-profile",
      approvalStatus: "approved",
    });

    const result = await sendWorkspaceMessage({
      workspaceId,
      body: "Hello",
      session: investorSession,
    });

    expect(result).toMatchObject({ ok: false, status: 403 });
    expect(messages.insertWorkspaceMessage).not.toHaveBeenCalled();
  });

  it("rejects empty or oversized messages before database access", async () => {
    const empty = await sendWorkspaceMessage({ workspaceId, body: " ", session: investorSession });
    const long = await sendWorkspaceMessage({
      workspaceId,
      body: "x".repeat(4001),
      session: investorSession,
    });

    expect(empty).toMatchObject({ ok: false, status: 400 });
    expect(long).toMatchObject({ ok: false, status: 400 });
    expect(relations.getRelationshipWorkspaceDetail).not.toHaveBeenCalled();
    expect(messages.insertWorkspaceMessage).not.toHaveBeenCalled();
  });

  it("counts unread messages only in the caller's active investor workspaces", async () => {
    const result = await countUnreadWorkspaceMessagesForCaller({ session: investorSession });

    expect(result).toEqual({ ok: true, unreadCount: 2 });
    expect(messages.countUnreadWorkspaceMessages).toHaveBeenCalledWith({
      workspaceIds: [workspaceId],
      readerId: investorSession.cid,
    });
  });

  it("rejects a non-UUID workspace identifier before reading", async () => {
    const result = await readWorkspaceConversation({ workspaceId: 8, session: investorSession });

    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(relations.getRelationshipWorkspaceDetail).not.toHaveBeenCalled();
  });

  it("does not allow a founder when the workspace is not active", async () => {
    relations.getRelationshipWorkspaceDetail.mockResolvedValue({
      rows: [{ ...workspace, status: "closed" }],
    });
    grants.listActiveFounderVentures.mockResolvedValue(["venture-uuid"]);

    const result = await readWorkspaceConversation({
      workspaceId,
      session: { cid: "founder-cid", role: "founder" },
    });

    expect(result).toMatchObject({ ok: false, status: 404 });
    expect(messages.listWorkspaceMessages).not.toHaveBeenCalled();
  });
});
