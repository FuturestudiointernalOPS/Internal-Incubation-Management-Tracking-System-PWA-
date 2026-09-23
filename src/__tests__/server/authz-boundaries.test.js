/**
 * AUTHORIZATION LAYER — boundaries and guard behaviour.
 *
 * The resource guards are the last thing standing between an authenticated
 * request and another program's data. They were only exercised indirectly
 * through route tests, so this suite pins their decision paths directly:
 *
 *   401 no session · 403 authenticated-but-not-assigned · 404 unknown resource
 *   409 conflicting double role · 500 when the check itself fails
 *
 * It also pins the layering: policy lives in @/server/authz, SQL lives in
 * @/models/authorization, and neither leaks into the other.
 */

const fs = require("fs");
const path = require("path");

jest.mock("next/headers", () => ({ cookies: jest.fn() }));

const mockExecute = jest.fn();
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: (...args) => mockExecute(...args) },
  initDb: jest.fn(async () => {}),
}));
jest.mock("@/server/auth/session", () => ({ getSession: jest.fn() }));
jest.mock("@/server/auth/guards", () => ({ requireSession: jest.fn() }));

const { getSession } = require("@/server/auth/session");
const { requireSession } = require("@/server/auth/guards");
const authz = require("@/server/authz");

const SRC = path.join(__dirname, "..", "..");
const STAFF = { cid: "USR1", role: "staff", email: "s@example.com", name: "S" };

const LEGACY_ASSIGNMENT = { staff_id: "USR1", role: "facilitator", permissions: {} };

/** Answer queries by matching a SQL fragment. Unmatched queries return no rows. */
function serveDb(routes) {
  mockExecute.mockImplementation(async (query = {}) => {
    const sql = String(query.sql || "").replace(/\s+/g, " ");
    for (const [fragment, result] of routes) {
      if (sql.includes(fragment)) return typeof result === "function" ? result(query) : result;
    }
    return { rows: [] };
  });
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

const relative = (file) => path.relative(SRC, file).split(path.sep).join("/");

beforeEach(() => {
  mockExecute.mockReset();
  getSession.mockReset();
  requireSession.mockReset();
  getSession.mockResolvedValue(STAFF);
  requireSession.mockResolvedValue(STAFF);
});

describe("authorization lives in its own layer", () => {
  it.each([
    "PERMISSION_MODULES",
    "ACCESS_LEVELS",
    "FACILITATOR_BYPASS_ROLES",
    "hasProgramManagementAccess",
    "resolveProgramAssignment",
    "getFacilitatorPermissionLevel",
    "requireProjectAccess",
    "requireProgramFacilitator",
    "enforceFacilitatorProgramAccess",
    "requireAssignmentAccess",
    "assertNoParticipantFacilitatorConflict",
  ])("exposes %s from @/server/authz", (name) => {
    expect(authz[name]).toBeDefined();
  });

  it("no longer implements the guards, the capability vocabulary or the reads", () => {
    const source = fs.readFileSync(path.join(SRC, "lib", "auth.js"), "utf8");
    for (const name of [
      "requireProjectAccess",
      "requireProgramFacilitator",
      "enforceFacilitatorProgramAccess",
      "requireAssignmentAccess",
      "assertNoParticipantFacilitatorConflict",
      "resolveProgramAssignment",
      "getFacilitatorPermissionLevel",
      "PERMISSION_MODULES",
      "getUserGroups",
      "logPermissionAudit",
      "isAssignedPmForProgram",
      "hasAnyFacilitatorAssignment",
      "getFacilitatorTeamScope",
      "isSupervisorOf",
      "getProgramFacilitatorAssignment",
      "getProgramAssignment",
      "getAssignmentStatus",
    ]) {
      expect(source).not.toMatch(new RegExp(`export\\s+(async\\s+)?(function|const)\\s+${name}\\b`));
    }
  });

  it("keeps every SQL statement of the guard paths in the model layer", () => {
    const offenders = walk(path.join(SRC, "server", "authz")).filter((file) => {
      const source = fs.readFileSync(file, "utf8");
      return /db\.execute|@\/lib\/db/.test(source);
    });

    expect(offenders.map(relative)).toEqual([]);
  });
});

describe("hasProgramManagementAccess", () => {
  it.each([
    ["super_admin", true],
    ["program_manager", true],
    ["staff", false],
    ["participant", false],
    [undefined, false],
  ])("%s → %s", (role, expected) => {
    expect(authz.hasProgramManagementAccess(role)).toBe(expected);
  });
});

describe("resolveProgramAssignment", () => {
  it("prefers the legacy v2_program_staff assignment", async () => {
    serveDb([["FROM v2_program_staff", { rows: [LEGACY_ASSIGNMENT] }]]);

    await expect(authz.resolveProgramAssignment("7", "USR1")).resolves.toEqual({
      source: "v2_program_staff",
      assignment: LEGACY_ASSIGNMENT,
    });
  });

  it("falls back to the generalized contact_roles assignment", async () => {
    serveDb([["FROM contact_roles", { rows: [{ id: 9, context_id: "7", contact_cid: "USR1" }] }]]);

    const resolved = await authz.resolveProgramAssignment("7", "USR1");

    expect(resolved.source).toBe("contact_roles");
    expect(resolved.assignment).toMatchObject({ id: 9, program_id: "7", staff_id: "USR1" });
  });

  it("returns null when there is no assignment at all", async () => {
    serveDb([]);

    await expect(authz.resolveProgramAssignment("7", "USR1")).resolves.toBeNull();
  });
});

describe("getFacilitatorPermissionLevel", () => {
  it("lets an explicit override on the assignment win", async () => {
    serveDb([]);

    const level = await authz.getFacilitatorPermissionLevel(
      "7",
      { permissions: { "sessions.conduct": 3 } },
      "sessions.conduct",
    );

    expect(level).toBe(3);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("falls back to the assignment's access profile", async () => {
    serveDb([
      [
        "FROM access_profile_capabilities",
        { rows: [{ module: "sessions", capability: "conduct", access_level: 2 }] },
      ],
    ]);

    await expect(
      authz.getFacilitatorPermissionLevel("7", { access_profile_id: 5 }, "sessions.conduct"),
    ).resolves.toBe(2);
  });

  it("falls back to the program default, then to zero", async () => {
    serveDb([
      [
        "facilitator_default_permissions",
        { rows: [{ facilitator_default_permissions: { "sessions.conduct": 1 } }] },
      ],
    ]);
    await expect(authz.getFacilitatorPermissionLevel("7", {}, "sessions.conduct")).resolves.toBe(1);

    serveDb([]);
    await expect(authz.getFacilitatorPermissionLevel("7", {}, "sessions.conduct")).resolves.toBe(0);
  });

  it("denies rather than throws when the lookup fails", async () => {
    mockExecute.mockRejectedValue(new Error("connection terminated"));

    await expect(authz.getFacilitatorPermissionLevel("7", {}, "sessions.conduct")).resolves.toBe(0);
  });
});

describe("requireProjectAccess", () => {
  it("admits a super_admin without touching the database", async () => {
    requireSession.mockResolvedValue({ ...STAFF, role: "super_admin" });

    await expect(authz.requireProjectAccess("7")).resolves.toBeNull();
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("answers 404 for an unknown project", async () => {
    serveDb([["FROM v2_projects WHERE id::text", { rows: [] }]]);

    const response = await authz.requireProjectAccess("7");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ success: false, error: "Project not found" });
  });

  it("admits a project member", async () => {
    serveDb([
      ["FROM v2_projects WHERE id::text", { rows: [{ id: "7" }] }],
      ["FROM project_members", { rows: [{ "?column?": 1 }] }],
    ]);

    await expect(authz.requireProjectAccess("7")).resolves.toBeNull();
  });

  it("refuses an authenticated non-member with 403", async () => {
    serveDb([["FROM v2_projects WHERE id::text", { rows: [{ id: "7" }] }]]);

    const response = await authz.requireProjectAccess("7");

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "errors.insufficientPermissions",
    });
  });

  it("answers 401 when there is no session", async () => {
    requireSession.mockRejectedValue(new Error("Unauthorized"));

    const response = await authz.requireProjectAccess("7");

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ success: false, error: "errors.authRequired" });
  });

  it("answers 500 when the session check itself fails", async () => {
    requireSession.mockRejectedValue(new Error("boom"));

    const response = await authz.requireProjectAccess("7");

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "errors.authSystemFailure",
    });
  });
});

describe("requireProgramFacilitator", () => {
  it("answers 401 without a session", async () => {
    getSession.mockResolvedValue(null);

    const response = await authz.requireProgramFacilitator("7");

    expect(response.status).toBe(401);
  });

  it("admits a super_admin", async () => {
    getSession.mockResolvedValue({ ...STAFF, role: "super_admin" });

    await expect(authz.requireProgramFacilitator("7")).resolves.toBeNull();
  });

  it("admits an assigned facilitator and refuses an unassigned user", async () => {
    serveDb([["FROM v2_program_staff", { rows: [LEGACY_ASSIGNMENT] }]]);
    await expect(authz.requireProgramFacilitator("7")).resolves.toBeNull();

    serveDb([]);
    const refused = await authz.requireProgramFacilitator("7");
    expect(refused.status).toBe(403);
  });

  it("answers 500 when the resolution throws", async () => {
    mockExecute.mockRejectedValue(new Error("connection terminated"));
    // resolution swallows read errors and returns null; force a hard failure
    getSession.mockRejectedValue(new Error("boom"));

    const response = await authz.requireProgramFacilitator("7");

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "errors.authzSystemFailure",
    });
  });
});

describe("enforceFacilitatorProgramAccess", () => {
  it("checks the capability level when one is requested", async () => {
    serveDb([["FROM v2_program_staff", { rows: [{ ...LEGACY_ASSIGNMENT, permissions: { "sessions.conduct": 1 } }] }]]);

    await expect(authz.enforceFacilitatorProgramAccess("7", "sessions.conduct", 1)).resolves.toBeNull();

    const refused = await authz.enforceFacilitatorProgramAccess("7", "sessions.conduct", 3);
    expect(refused.status).toBe(403);
  });

  it("refuses a user with no assignment", async () => {
    serveDb([]);

    const response = await authz.enforceFacilitatorProgramAccess("7");

    expect(response.status).toBe(403);
  });
});

describe("requireAssignmentAccess", () => {
  it("exempts the bypass roles", async () => {
    getSession.mockResolvedValue({ ...STAFF, role: "program_manager" });

    await expect(authz.requireAssignmentAccess({ contextId: "7" })).resolves.toBeNull();
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("denies a resource type that has no policy yet", async () => {
    const response = await authz.requireAssignmentAccess({ resource: "planet", contextId: "7" });

    expect(response.status).toBe(403);
  });

  it("denies when the assignment status does not match the required one", async () => {
    serveDb([
      ["FROM v2_program_staff", { rows: [LEGACY_ASSIGNMENT] }],
      ["SELECT status FROM contact_roles", { rows: [{ status: "suspended" }] }],
    ]);

    const response = await authz.requireAssignmentAccess({
      contextId: "7",
      requireStatus: "active",
    });

    expect(response.status).toBe(403);
  });

  it("admits when the assignment status matches", async () => {
    serveDb([
      ["FROM v2_program_staff", { rows: [LEGACY_ASSIGNMENT] }],
      ["SELECT status FROM contact_roles", { rows: [{ status: "active" }] }],
    ]);

    await expect(
      authz.requireAssignmentAccess({ contextId: "7", requireStatus: "active" }),
    ).resolves.toBeNull();
  });
});

describe("assertNoParticipantFacilitatorConflict", () => {
  it("answers 409 when the person already facilitates the same program", async () => {
    serveDb([["FROM v2_program_staff", { rows: [{ "?column?": 1 }] }]]);

    const response = await authz.assertNoParticipantFacilitatorConflict("7", "USR1");

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "errors.roleConflictParticipantFacilitator",
    });
  });

  it("returns null when there is no conflict, or when arguments are missing", async () => {
    serveDb([]);
    await expect(authz.assertNoParticipantFacilitatorConflict("7", "USR1")).resolves.toBeNull();
    await expect(authz.assertNoParticipantFacilitatorConflict(null, "USR1")).resolves.toBeNull();
  });

  it("fails open when the lookup errors, so enrolment is never blocked by it", async () => {
    mockExecute.mockRejectedValue(new Error("connection terminated"));

    await expect(authz.assertNoParticipantFacilitatorConflict("7", "USR1")).resolves.toBeNull();
  });
});
