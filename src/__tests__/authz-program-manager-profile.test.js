/**
 * D-1 — the program-manager function is a PROFILE.
 *
 * The pure decision is tested against the matrix the routes rely on:
 * platform owner, legacy session, staff + profile, staff without profile.
 */

jest.mock("@/server/auth/guards", () => ({ requireSession: jest.fn() }));
jest.mock("@/server/auth/session", () => ({ getSession: jest.fn() }));
jest.mock("@/models/authorization/accessQueries", () => ({
  projectExists: jest.fn(),
  isProjectMember: jest.fn(),
  findParticipantFacilitatorConflict: jest.fn(),
  getAssignmentStatus: jest.fn(),
}));
jest.mock("@/server/authz/programAccess", () => ({
  resolveProgramAssignment: jest.fn(),
  getFacilitatorPermissionLevel: jest.fn(),
}));
jest.mock("@/services/authorization/contextCache", () => ({
  getAuthorizationContext: jest.fn(),
}));

const {
  programManagerAccessDecision,
} = require("@/services/authorization/resourceGuards");

const allowed = { allowed: true, status: 200, errorKey: null };
const denied = (status, errorKey) => ({ allowed: false, status, errorKey });

describe("programManagerAccessDecision — D-1", () => {
  test("no session is unauthenticated", () => {
    expect(programManagerAccessDecision({ session: null, context: null })).toEqual(
      denied(401, "errors.authRequired"),
    );
  });

  test("the platform owner always passes", () => {
    expect(
      programManagerAccessDecision({
        session: { role: "super_admin" },
        context: null,
      }),
    ).toEqual(allowed);
  });

  test("a resolved super-admin context passes even with a baseline role", () => {
    expect(
      programManagerAccessDecision({
        session: { role: "staff" },
        context: { isSuperAdmin: true, profiles: [] },
      }),
    ).toEqual(allowed);
  });

  test("a legacy program_manager session still passes during the transition", () => {
    expect(
      programManagerAccessDecision({
        session: { role: "program_manager" },
        context: { profiles: [] },
      }),
    ).toEqual(allowed);
  });

  test("a baseline staff identity passes only with the program_manager PROFILE", () => {
    expect(
      programManagerAccessDecision({
        session: { role: "staff" },
        context: { profiles: ["program_manager"] },
      }),
    ).toEqual(allowed);
  });

  test("a baseline staff identity without the profile is refused", () => {
    expect(
      programManagerAccessDecision({
        session: { role: "staff" },
        context: { profiles: ["participant"] },
      }),
    ).toEqual(denied(403, "errors.insufficientPermissions"));
  });

  test("any other identity is refused", () => {
    for (const role of ["member", "participant", "facilitator", "investor"]) {
      expect(
        programManagerAccessDecision({
          session: { role },
          context: { profiles: ["program_manager"] },
        }),
      ).toEqual(denied(403, "errors.insufficientPermissions"));
    }
  });
});
