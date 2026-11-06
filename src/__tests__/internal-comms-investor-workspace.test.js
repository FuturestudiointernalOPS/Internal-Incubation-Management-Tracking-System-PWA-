jest.mock("@/models/communications", () => ({
  createMessage: jest.fn(),
  ensureMessagesAttachmentNameColumn: jest.fn(),
  ensureMessagesAttachmentUrlColumn: jest.fn(),
  ensureMessagesIsReadColumn: jest.fn(),
  getSenderNameByCidOrId: jest.fn(),
  insertDirectMessageNotification: jest.fn(),
  insertGroupMessageNotification: jest.fn(),
  insertProgramMessageNotification: jest.fn(),
}));
jest.mock("@/services/communications/internal-comms/scope", () => ({
  resolveUserMessageScope: jest.fn(),
  recipientSharesProgram: jest.fn(),
  resolveGroupMemberIds: jest.fn(),
  resolveProgramMemberIds: jest.fn(),
}));

const { createMessage } = require("@/models/communications");
const { sendInternalMessage } = require("@/services/communications/internal-comms/send");

describe("internal messaging isolation for investor workspaces", () => {
  beforeEach(() => jest.clearAllMocks());

  it("reserves investor-workspace messages for the approved-workspace controller", async () => {
    const result = await sendInternalMessage({
      session: { cid: "other-user", role: "user" },
      payload: {
        target_type: "investor_workspace",
        target_id: "8",
        body: "Injected into a relationship thread",
      },
    });

    expect(result).toEqual({
      denied: { error: "errors.insufficientPermissions", status: 403 },
    });
    expect(createMessage).not.toHaveBeenCalled();
  });
});
