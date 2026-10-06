/**
 * LMS public registration — the DECISIONS.
 *
 * These used to sit inline in `src/app/api/public/register/route.js` and
 * `src/app/api/public/group-info/route.js`. They now live in
 * `src/services/lms/publicRegistration.js`. This suite pins the observable
 * behaviour: the group fallback, the anonymous-submission rule, the
 * facilitator/participant conflict guard, and the public group info.
 */

jest.mock("@/models/platformConfig", () => ({
  findContactCidByEmail: jest.fn(),
  findFamilyForGroupInfo: jest.fn(),
  findRegistrationGroupInFamilies: jest.fn(),
  findRegistrationGroupInV2Groups: jest.fn(),
  findV2GroupForGroupInfo: jest.fn(),
  getProgramRegistrationWindow: jest.fn(),
  insertContactForRegistration: jest.fn(),
  insertParticipantForRegistration: jest.fn(),
  insertParticipantProgramMembership: jest.fn(),
}));

jest.mock("@/server/authz/guards", () => ({
  assertNoParticipantFacilitatorConflict: jest.fn(),
}));

jest.mock("@/server/auth/password", () => ({
  hashPassword: jest.fn(),
}));

const platform = require("@/models/platformConfig");
const { assertNoParticipantFacilitatorConflict } = require("@/server/authz/guards");
const { hashPassword } = require("@/server/auth/password");
const {
  registerParticipantViaGroupLink,
  buildPublicGroupInfo,
} = require("@/services/lms/publicRegistration");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("registerParticipantViaGroupLink", () => {
  it("falls back to v2_groups and 404s when neither has the group", async () => {
    platform.findRegistrationGroupInFamilies.mockResolvedValue({ rows: [] });
    platform.findRegistrationGroupInV2Groups.mockResolvedValue({ rows: [] });

    expect(
      await registerParticipantViaGroupLink({ name: "A", email: "a@x.io", password: "123456", groupId: "g1" }),
    ).toEqual({ ok: false, status: 404, error: "Group not found." });
  });

  it("never rewrites an existing account's credentials but still syncs membership", async () => {
    platform.findRegistrationGroupInFamilies.mockResolvedValue({
      rows: [{ name: "Cohort", program_id: 5 }],
    });
    platform.findContactCidByEmail.mockResolvedValue({ rows: [{ cid: "USR-OLD" }] });
    assertNoParticipantFacilitatorConflict.mockResolvedValue(null);

    const result = await registerParticipantViaGroupLink({
      name: "Ada",
      email: "  Ada@Example.io ",
      password: "123456",
      groupId: "g1",
    });

    expect(platform.insertContactForRegistration).not.toHaveBeenCalled();
    expect(result.user).toEqual({
      cid: "USR-OLD",
      name: "Ada",
      email: "ada@example.io",
      role: "participant",
    });
    expect(platform.insertParticipantForRegistration).toHaveBeenCalledWith(
      5,
      "USR-OLD",
      "Ada",
      "ada@example.io",
      undefined,
    );
    expect(platform.insertParticipantProgramMembership).toHaveBeenCalledWith("USR-OLD", 5);
  });

  it("creates a contact for a new email with a strengthened hash", async () => {
    platform.findRegistrationGroupInFamilies.mockResolvedValue({
      rows: [{ name: "Cohort", program_id: 5 }],
    });
    platform.findContactCidByEmail.mockResolvedValue({ rows: [] });
    hashPassword.mockResolvedValue("HASH");
    assertNoParticipantFacilitatorConflict.mockResolvedValue(null);

    const result = await registerParticipantViaGroupLink({
      name: "Ada",
      email: "ada@example.io",
      password: "123456",
      groupId: "g1",
    });

    expect(hashPassword).toHaveBeenCalledWith("123456", { rounds: 12 });
    expect(platform.insertContactForRegistration).toHaveBeenCalledWith(
      result.user.cid,
      "Ada",
      "ada@example.io",
      undefined,
      "HASH",
      "Cohort",
    );
  });

  it("refuses a facilitator registering as a participant in the same program", async () => {
    platform.findRegistrationGroupInFamilies.mockResolvedValue({
      rows: [{ name: "Cohort", program_id: 5 }],
    });
    platform.findContactCidByEmail.mockResolvedValue({ rows: [] });
    hashPassword.mockResolvedValue("HASH");
    assertNoParticipantFacilitatorConflict.mockResolvedValue("conflict");

    expect(
      await registerParticipantViaGroupLink({ name: "A", email: "a@x.io", password: "123456", groupId: "g1" }),
    ).toEqual({ ok: false, status: 409, reason: "role_conflict" });
    expect(platform.insertParticipantForRegistration).not.toHaveBeenCalled();
  });

  it("skips the program block when the group has no program", async () => {
    platform.findRegistrationGroupInFamilies.mockResolvedValue({ rows: [{ name: "Open" }] });
    platform.findContactCidByEmail.mockResolvedValue({ rows: [] });
    hashPassword.mockResolvedValue("HASH");

    const result = await registerParticipantViaGroupLink({
      name: "A",
      email: "a@x.io",
      password: "123456",
      groupId: "g1",
    });

    expect(result.ok).toBe(true);
    expect(platform.insertParticipantForRegistration).not.toHaveBeenCalled();
  });
});

describe("buildPublicGroupInfo", () => {
  it("resolves the group from families with its registration window", async () => {
    platform.findFamilyForGroupInfo.mockResolvedValue({
      rows: [{ id: "g1", name: "Cohort", program_id: 5 }],
    });
    platform.getProgramRegistrationWindow.mockResolvedValue({ rows: [{ registration_window: "spring" }] });

    expect(await buildPublicGroupInfo({ groupId: "g1" })).toEqual({
      ok: true,
      group: { id: "g1", name: "Cohort", program_id: 5, registration_window: "spring" },
    });
  });

  it("falls back to v2_groups", async () => {
    platform.findFamilyForGroupInfo.mockResolvedValue({ rows: [] });
    platform.findV2GroupForGroupInfo.mockResolvedValue({ rows: [{ id: "g2", name: "Open" }] });

    expect(await buildPublicGroupInfo({ groupId: "g2" })).toEqual({
      ok: true,
      group: { id: "g2", name: "Open", registration_window: null },
    });
  });

  it("404s an unknown group", async () => {
    platform.findFamilyForGroupInfo.mockResolvedValue({ rows: [] });
    platform.findV2GroupForGroupInfo.mockResolvedValue({ rows: [] });

    expect(await buildPublicGroupInfo({ groupId: "nope" })).toEqual({
      ok: false,
      status: 404,
      error: "Group not found",
    });
  });
});
