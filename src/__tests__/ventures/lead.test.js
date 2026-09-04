/**
 * Venture lead management (Phase 4) — unit tests for changeVentureLead.
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    execute: jest.fn(),
  },
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("uuid", () => ({
  v4: jest.fn().mockReturnValue("mock-uuid-1234567890abcdef"),
}));

const db = require("@/lib/db").default;
const { changeVentureLead } = require("@/lib/ventures");

beforeEach(() => {
  jest.clearAllMocks();
  db.execute.mockImplementation(async () => ({ rows: [] }));
});

describe("changeVentureLead", () => {
  it("promotes the new member and clears the previous lead", async () => {
    db.execute
      .mockResolvedValueOnce({ rows: [{ id: 5, contact_id: "USR_NEW", name: "Mary" }] }) // member lookup
      .mockResolvedValueOnce({ rows: [] }) // previous lead lookup
      .mockResolvedValueOnce({ rows: [] }) // clear current lead
      .mockResolvedValueOnce({ rows: [] }) // promote new lead
      .mockResolvedValueOnce({ rows: [] }); // ownership history

    const result = await changeVentureLead({
      ventureId: "VNT-ABC",
      memberId: 5,
      actorCid: "SA_1",
      actorName: "Admin",
    });

    expect(result).toEqual({ success: true });

    const clearCall = db.execute.mock.calls[2][0];
    expect(clearCall.sql).toContain("lead_founder = FALSE, is_owner = FALSE");
    expect(clearCall.args[0]).toBe("VNT-ABC");

    const promoteCall = db.execute.mock.calls[3][0];
    expect(promoteCall.sql).toContain("lead_founder = TRUE, is_owner = TRUE, member_type = 'founder', role = 'founder'");
    expect(promoteCall.args[0]).toBe(5);

    const historyCall = db.execute.mock.calls[4][0];
    expect(historyCall.sql).toContain("INSERT INTO ownership_history");
    expect(historyCall.args[0]).toBe("VNT-ABC");
    expect(historyCall.args[1]).toBe("USR_NEW"); // new_owner_id
    expect(historyCall.args[3]).toBe("Mary"); // new_owner_name
  });

  it("returns an error when the member does not exist or is not active", async () => {
    db.execute.mockResolvedValueOnce({ rows: [] }); // member lookup

    const result = await changeVentureLead({ ventureId: "VNT-ABC", memberId: 999, actorCid: "SA_1" });

    expect(result.error).toBe("Venture member not found.");
    expect(db.execute).toHaveBeenCalledTimes(1);
  });
});
