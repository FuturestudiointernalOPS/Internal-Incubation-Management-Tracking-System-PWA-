jest.mock("@/models/communications", () => ({
  isContactInFacilitatorTeams: jest.fn(),
  isContactInFacilitatorTeamsForUpdate: jest.fn(),
}));

import {
  isContactInFacilitatorTeams,
  isContactInFacilitatorTeamsForUpdate,
} from "@/models/communications";
import { isParticipantInFacilitatorScope } from "@/services/communications/followups";

const scope = { scope: "teams", teamIds: [11, 12] };

describe("isParticipantInFacilitatorScope", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("denies without a participant, without querying", async () => {
    await expect(isParticipantInFacilitatorScope(scope, undefined)).resolves.toBe(false);
    expect(isContactInFacilitatorTeams).not.toHaveBeenCalled();
    expect(isContactInFacilitatorTeamsForUpdate).not.toHaveBeenCalled();
  });

  it("denies when the facilitator has no team, without querying", async () => {
    await expect(
      isParticipantInFacilitatorScope({ scope: "teams", teamIds: [] }, "p1"),
    ).resolves.toBe(false);
    expect(isContactInFacilitatorTeams).not.toHaveBeenCalled();
  });

  it("allows a participant found in the facilitator's teams", async () => {
    isContactInFacilitatorTeams.mockResolvedValue({ rows: [{ id: 1 }] });
    await expect(isParticipantInFacilitatorScope(scope, "p1")).resolves.toBe(true);
    expect(isContactInFacilitatorTeams).toHaveBeenCalledWith("p1", [11, 12]);
    expect(isContactInFacilitatorTeamsForUpdate).not.toHaveBeenCalled();
  });

  it("denies a participant the team lookup does not find", async () => {
    isContactInFacilitatorTeams.mockResolvedValue({ rows: [] });
    await expect(isParticipantInFacilitatorScope(scope, "p1")).resolves.toBe(false);
  });

  it("uses the update lookup when forUpdate is set", async () => {
    isContactInFacilitatorTeamsForUpdate.mockResolvedValue({ rows: [{ id: 1 }] });
    await expect(
      isParticipantInFacilitatorScope(scope, "p1", { forUpdate: true }),
    ).resolves.toBe(true);
    expect(isContactInFacilitatorTeamsForUpdate).toHaveBeenCalledWith("p1", [11, 12]);
    expect(isContactInFacilitatorTeams).not.toHaveBeenCalled();
  });

  it("denies on the update path when the update lookup finds nothing", async () => {
    isContactInFacilitatorTeamsForUpdate.mockResolvedValue({ rows: [] });
    await expect(
      isParticipantInFacilitatorScope(scope, "p1", { forUpdate: true }),
    ).resolves.toBe(false);
  });
});
