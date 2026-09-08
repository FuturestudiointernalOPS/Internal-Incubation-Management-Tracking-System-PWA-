/**
 * Venture Phase 1 foundation — unit tests
 *
 * Covers the new foundation logic:
 * - resolveTeamMembersForPromotion: resolves the REAL team membership
 *   (contacts.v2_team_id / v2_participants.v2_team_id) instead of the old
 *   broken v2_group_members lookup.
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
const { resolveTeamMembersForPromotion } = require("@/lib/ventures");

describe("resolveTeamMembersForPromotion", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns team members resolved from contacts.v2_team_id", async () => {
    db.execute.mockResolvedValueOnce({
      rows: [
        { contact_id: "USR_1", name: "John", email: "john@example.com" },
        { contact_id: "USR_2", name: "Mary", email: "mary@example.com" },
      ],
    });

    const members = await resolveTeamMembersForPromotion("TEAM-1");

    expect(members).toHaveLength(2);
    expect(members[0]).toMatchObject({ contact_id: "USR_1", name: "John" });
    expect(db.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        sql: expect.stringContaining("contacts c"),
        args: ["TEAM-1", "TEAM-1"],
      }),
    );
  });

  it("filters out rows without a contact_id", async () => {
    db.execute.mockResolvedValueOnce({
      rows: [
        { contact_id: "USR_1", name: "John", email: "john@example.com" },
        { contact_id: null, name: "Ghost", email: "ghost@example.com" },
      ],
    });

    const members = await resolveTeamMembersForPromotion("TEAM-1");

    expect(members).toHaveLength(1);
    expect(members[0].contact_id).toBe("USR_1");
  });

  it("returns an empty array when the team has no members", async () => {
    db.execute.mockResolvedValueOnce({ rows: [] });

    const members = await resolveTeamMembersForPromotion("TEAM-EMPTY");

    expect(members).toEqual([]);
  });
});
