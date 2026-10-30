jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn() },
}));

const db = require("@/lib/db").default;
const {
  getParticipantKnowledgeBankItemById,
} = require("@/models/programMembership/participantProgramDetail");

describe("participant knowledge-bank model scope", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.execute.mockResolvedValue({ rows: [] });
  });

  test("loads only the active note explicitly linked to the requested program", async () => {
    await getParticipantKnowledgeBankItemById("note-7");

    expect(db.execute).toHaveBeenCalledWith({
      sql: "SELECT * FROM v2_knowledge_bank WHERE id::text = ? AND is_archived = 0",
      args: ["note-7"],
    });
  });
});
