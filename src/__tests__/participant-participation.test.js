/**
 * The ONE participation rule (src/services/participant/participation.js).
 *
 * Pins the contract the side menu, the participant dashboard, the workspace
 * hub and the login landing all read:
 *   - any modern seat counts, whatever its status; a COMPLETED seat stays open
 *     (read-only) instead of losing the door;
 *   - the older group/program links (marked `legacy` by the read) count when no
 *     modern row exists;
 *   - a seat whose program no longer exists grants nothing.
 */

jest.mock("@/models/participant-membership", () => ({
  getParticipantParticipationSnapshot: jest.fn(),
  getParticipantProgramIds: jest.fn(),
}));

const models = require("@/models/participant-membership");
const {
  resolveParticipantParticipation,
  resolveProgramSeat,
} = require("@/services/participant/participation");

beforeEach(() => {
  jest.clearAllMocks();
  models.getParticipantParticipationSnapshot.mockResolvedValue({ rows: [] });
});

describe("resolveParticipantParticipation", () => {
  test("an active seat makes the person a participant, not read-only", async () => {
    models.getParticipantParticipationSnapshot.mockResolvedValue({
      rows: [
        {
          program_id: "P-1",
          source: "membership",
          status: "active",
          program_name: "Alpha",
          program_exists: true,
        },
      ],
    });

    const result = await resolveParticipantParticipation({ cid: "user-1" });
    expect(result.isProgramParticipant).toBe(true);
    expect(result.hasCompleted).toBe(false);
    expect(result.memberships).toEqual([
      expect.objectContaining({ program_id: "P-1", status: "active", readOnly: false, legacy: false }),
    ]);
  });

  test("a COMPLETED seat keeps the door open, read-only", async () => {
    models.getParticipantParticipationSnapshot.mockResolvedValue({
      rows: [
        {
          program_id: "P-1",
          source: "membership",
          status: "completed",
          program_name: "Alpha",
          program_exists: true,
        },
      ],
    });

    const result = await resolveParticipantParticipation({ cid: "user-1" });
    expect(result.isProgramParticipant).toBe(true);
    expect(result.hasCompleted).toBe(true);
    expect(result.memberships[0]).toEqual(
      expect.objectContaining({ program_id: "P-1", completed: true, readOnly: true }),
    );
  });

  test("an older group link opens the door, flagged as legacy", async () => {
    models.getParticipantParticipationSnapshot.mockResolvedValue({
      rows: [
        {
          program_id: "P-2",
          source: "legacy",
          status: null,
          program_name: "Beta",
          program_exists: true,
        },
      ],
    });

    const result = await resolveParticipantParticipation({ cid: "user-1" });
    expect(result.isProgramParticipant).toBe(true);
    expect(result.memberships).toEqual([
      expect.objectContaining({ program_id: "P-2", legacy: true, status: "active", readOnly: false }),
    ]);
  });

  test("a seat whose program no longer exists grants nothing", async () => {
    models.getParticipantParticipationSnapshot.mockResolvedValue({
      rows: [{ program_id: "P-9", source: "membership", status: "active", program_exists: false }],
    });

    const result = await resolveParticipantParticipation({ cid: "user-1" });
    expect(result.isProgramParticipant).toBe(false);
    expect(result.memberships).toEqual([]);
  });

  test("a failed combined read still opens the door from the id lookup", async () => {
    models.getParticipantParticipationSnapshot.mockRejectedValue(new Error("legacy table missing"));
    models.getParticipantProgramIds.mockResolvedValue(["P-3"]);

    const result = await resolveParticipantParticipation({ cid: "user-1" });
    expect(result.isProgramParticipant).toBe(true);
    expect(result.memberships[0]).toEqual(
      expect.objectContaining({ program_id: "P-3", status: "active", readOnly: false }),
    );
  });

  test("an unknown cid answers no participation without reading", async () => {
    const result = await resolveParticipantParticipation({ cid: null });
    expect(result.isProgramParticipant).toBe(false);
    expect(models.getParticipantParticipationSnapshot).not.toHaveBeenCalled();
  });
});

describe("resolveProgramSeat", () => {
  test("returns the seat of the asked program, or null", async () => {
    models.getParticipantParticipationSnapshot.mockResolvedValue({
      rows: [
        { program_id: "P-1", source: "membership", status: "active", program_exists: true },
        { program_id: "P-2", source: "membership", status: "completed", program_exists: true },
      ],
    });

    await expect(
      resolveProgramSeat({ cid: "user-1", programId: "P-2" }),
    ).resolves.toEqual(expect.objectContaining({ program_id: "P-2", readOnly: true }));
    await expect(
      resolveProgramSeat({ cid: "user-1", programId: "P-8" }),
    ).resolves.toBeNull();
  });
});
