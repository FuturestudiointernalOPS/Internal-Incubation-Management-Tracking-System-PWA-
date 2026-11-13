/**
 * Étape 4 — landing from access (the default-off rule).
 *
 * The priority list is data; this suite pins the evaluation:
 *   - the structural space home is the fallback, never a role-label branch;
 *   - a profile or a relationship opens a member context;
 *   - a capability gates the staff/owner destinations;
 *   - exactly one owned venture wins over the generic member home.
 */

const {
  resolveLandingFromAccess,
} = require("@/models/platform/roles");

const venture = (overrides = {}) => ({
  venture_id: "VNT-1",
  status: "active",
  member_type: "founder",
  is_owner: true,
  ...overrides,
});

describe("landing from access — staff and owner", () => {
  test("the owner lands on the admin home", () => {
    expect(
      resolveLandingFromAccess({
        role: "super_admin",
        effective: { permissions: { view_matrix: 1 } },
      }),
    ).toBe("/admin");
  });

  test("the owner stays in the admin space even without the matrix right", () => {
    expect(
      resolveLandingFromAccess({ role: "super_admin", effective: {} }),
    ).toBe("/admin");
  });

  test("a program manager profile with the program right lands in the PM space", () => {
    expect(
      resolveLandingFromAccess({
        role: "staff",
        profiles: ["program_manager"],
        effective: { programs: { view: 1 } },
      }),
    ).toBe("/staff/program-manager");
  });

  test("the PM profile without the program right falls back to staff", () => {
    expect(
      resolveLandingFromAccess({
        role: "staff",
        profiles: ["program_manager"],
        effective: {},
      }),
    ).toBe("/staff");
  });

  test("the finance right selects the finance home", () => {
    expect(
      resolveLandingFromAccess({
        role: "staff",
        effective: { finance: { view: 1 } },
      }),
    ).toBe("/staff/finance");
  });

  test("plain staff lands on the staff home", () => {
    expect(resolveLandingFromAccess({ role: "staff" })).toBe("/staff");
  });
});

describe("landing from access — member contexts", () => {
  test("a team account keeps its workspace", () => {
    expect(resolveLandingFromAccess({ role: "team", teamId: 7 })).toBe(
      "/member/team/7",
    );
    expect(resolveLandingFromAccess({ role: "team" })).toBe("/member/team");
  });

  test("an investor profile lands in the investor space", () => {
    expect(
      resolveLandingFromAccess({ role: "member", profiles: ["investor"] }),
    ).toBe("/member/investor/dashboard");
  });

  test("an investor relationship lands in the investor space", () => {
    expect(
      resolveLandingFromAccess({ role: "member", isInvestor: true }),
    ).toBe("/member/investor/dashboard");
  });

  test("exactly one owned active venture wins over the member home", () => {
    expect(
      resolveLandingFromAccess({
        role: "member",
        ventures: [venture()],
        profiles: ["investor"],
      }),
    ).toBe("/member/participant/ventures/VNT-1");
  });

  test("several owned ventures fall to the founder home, not one venture", () => {
    expect(
      resolveLandingFromAccess({
        role: "member",
        ventures: [venture(), venture({ venture_id: "VNT-2" })],
      }),
    ).toBe("/member/founder");
  });

  test("several ventures without a founder context keep the member hub", () => {
    const memberVenture = (ventureId) =>
      venture({ venture_id: ventureId, member_type: "team_member", is_owner: false });
    expect(
      resolveLandingFromAccess({
        role: "member",
        ventures: [memberVenture("VNT-1"), memberVenture("VNT-2")],
      }),
    ).toBe("/member");
  });

  test("a founder profile lands on the founder home", () => {
    expect(
      resolveLandingFromAccess({ role: "member", profiles: ["founder"] }),
    ).toBe("/member/founder");
  });

  test("a facilitator profile lands on the facilitator space", () => {
    expect(
      resolveLandingFromAccess({ role: "member", profiles: ["facilitator"] }),
    ).toBe("/member/facilitator");
  });

  test("a participant profile lands on the participant dashboard", () => {
    expect(
      resolveLandingFromAccess({ role: "member", profiles: ["participant"] }),
    ).toBe("/member/participant");
  });

  test("a program relationship lands on the participant dashboard", () => {
    expect(
      resolveLandingFromAccess({
        role: "member",
        isProgramParticipant: true,
      }),
    ).toBe("/member/participant");
  });

  test("no signal falls back to the neutral member hub", () => {
    expect(resolveLandingFromAccess({ role: "member" })).toBe("/member");
  });

  test("an unknown identity is treated as a personal identity", () => {
    expect(resolveLandingFromAccess({ role: "security_officer" })).toBe(
      "/member",
    );
  });
});

describe("landing from access — rights are optional at evaluation time", () => {
  test("an unloaded matrix does not block the profile destination", () => {
    expect(
      resolveLandingFromAccess({
        role: "staff",
        profiles: ["program_manager"],
        effective: null,
      }),
    ).toBe("/staff/program-manager");
  });
});
