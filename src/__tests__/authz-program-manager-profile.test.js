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
const {
  isProgramManagerProfileSession,
  isProgramManagerSession,
} = require("@/services/authorization/programManagement");
const { getAuthorizationContext } = require("@/services/authorization/contextCache");

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

describe("the async profile predicate used by decision sites", () => {
  beforeEach(() => {
    getAuthorizationContext.mockReset();
  });

  test("a legacy program-manager role passes without a context lookup", async () => {
    expect(await isProgramManagerProfileSession({ role: "program_manager" })).toBe(
      true,
    );
    expect(getAuthorizationContext).not.toHaveBeenCalled();
  });

  test("a staff identity passes only when the context carries the profile", async () => {
    getAuthorizationContext.mockResolvedValue({
      profiles: ["program_manager"],
    });
    expect(await isProgramManagerProfileSession({ role: "staff", cid: "U-1" })).toBe(
      true,
    );

    getAuthorizationContext.mockResolvedValue({ profiles: ["participant"] });
    expect(await isProgramManagerProfileSession({ role: "staff", cid: "U-1" })).toBe(
      false,
    );
  });

  test("the platform owner is management authority but not a PM profile", async () => {
    expect(await isProgramManagerProfileSession({ role: "super_admin" })).toBe(
      false,
    );
    expect(await isProgramManagerSession({ role: "super_admin" })).toBe(true);
  });

  test("a failed profile lookup is a refusal", async () => {
    getAuthorizationContext.mockRejectedValue(new Error("db down"));
    expect(await isProgramManagerProfileSession({ role: "staff", cid: "U-1" })).toBe(
      false,
    );
  });
});

/**
 * Lot 7 — the interface mirrors profile-specific rules from the profile the
 * server resolved, never from the role label D-1 no longer carries.
 */
describe("the profile the UI reads", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const { holdsProfile } = require("@/lib/identity");
  const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

  test("holdsProfile answers on the list the server resolved", () => {
    expect(holdsProfile(["program_manager"], "program_manager")).toBe(true);
    expect(holdsProfile(["PROGRAM_MANAGER"], "program_manager")).toBe(true);
    expect(holdsProfile(["participant"], "program_manager")).toBe(false);
    expect(holdsProfile([], "program_manager")).toBe(false);
    expect(holdsProfile(undefined, "program_manager")).toBe(false);
  });

  test("me/permissions returns the contextual profiles", () => {
    expect(read("src/app/api/me/permissions/route.js")).toContain(
      "profiles: ctx?.profiles || []",
    );
  });

  test("the shared permission provider carries them to the screens", () => {
    const provider = read("src/lib/PermissionProvider.js");
    expect(provider).toContain("profiles: Array.isArray(response.profiles)");
    expect(provider).toContain("profiles,");
  });
});
