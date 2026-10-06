/**
 * AUTH LAYER — architectural boundaries.
 *
 * Three invariants must hold as the server layer grows:
 *
 *   1. HOMES — every symbol `@/lib/auth` used to forward is implemented in, and
 *      exported from, its real layer: `@/server/auth` (authentication) or an
 *      authorization module. The facade was removed once its importers were
 *      repointed (docs/LAYER_SPLIT.md).
 *   2. SEPARATION — authentication (`@/server/auth`) answers "who are you?";
 *      authorization (capabilities, scopes, ownership, roles catalog) answers
 *      "may you do this?" and must not leak into the authentication layer.
 *   3. DEPENDENCY HYGIENE — password hashing is a single seam, and the server
 *      layer never reaches up into the UI.
 */

const fs = require("fs");
const path = require("path");

jest.mock("next/headers", () => ({ cookies: jest.fn() }));
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [] })) },
  initDb: jest.fn(async () => {}),
}));
jest.mock("@/lib/token-hashing", () => ({
  hashToken: (token) => `hash-${token}`,
  ensureTokenHashColumns: jest.fn(async () => {}),
}));
jest.mock("@/lib/identity", () => ({
  deriveLegacyRoleEnabled: () => false,
  deriveLegacyRole: ({ storedRole }) => storedRole,
}));

/** The authentication symbols the server layer owns. */
const AUTHENTICATION_EXPORTS = [
  "SESSION_COOKIE_NAME",
  "createSession",
  "getSession",
  "destroySession",
  "setSessionCookieOnResponse",
  "requireSession",
  "requireAuth",
];

/** The authorization symbols `@/lib/auth` has always exported. */
const AUTHORIZATION_EXPORTS = [
  "requireProjectAccess",
  "PERMISSION_MODULES",
  "ACCESS_LEVELS",
  "getUserGroups",
  "logPermissionAudit",
  "hasProgramManagementAccess",
  "isAssignedPmForProgram",
  "getProgramFacilitatorAssignment",
  "getProgramAssignment",
  "resolveProgramAssignment",
  "hasAnyFacilitatorAssignment",
  "getFacilitatorPermissionLevel",
  "getFacilitatorTeamScope",
  "requireProgramFacilitator",
  "enforceFacilitatorProgramAccess",
  "assertNoParticipantFacilitatorConflict",
  "isSupervisorOf",
  "getAssignmentStatus",
  "requireAssignmentAccess",
  "seedDefaultRoleCapabilities",
  "getUserEffectiveProfile",
  "getAccessProfileCapabilities",
  "seedDefaultAccessProfiles",
  "ensureResponsibilitiesSchema",
  "ensurePermissionsSchema",
  "getUserResponsibilities",
  "assignResponsibility",
  "removeResponsibility",
  "getAllResponsibilities",
  "seedDefaultResponsibilities",
];

const SRC = path.join(__dirname, "..", "..");

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(js|jsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function relative(file) {
  return path.relative(SRC, file).split(path.sep).join("/");
}

describe("the moved symbols are exported by their real homes", () => {
  const AUTH_HOME = require("@/server/auth");

  it.each(AUTHENTICATION_EXPORTS)("the authentication symbol %s is exported by @/server/auth", (name) => {
    expect(AUTH_HOME[name]).toBeDefined();
  });

  it.each(AUTHORIZATION_EXPORTS)("the authorization symbol %s is exported by its layer", (name) => {
    const homes = [
      require("@/server/authz/capabilities"),
      require("@/server/authz/programAccess"),
      require("@/server/authz/guards"),
      require("@/models/authorization/accessQueries"),
      require("@/models/authorization/bootstrap"),
      require("@/services/authorization/accessProfiles"),
    ];
    expect(homes.some((home) => home[name] !== undefined)).toBe(true);
  });
});

describe("authentication and authorization stay separate", () => {
  it.each(AUTHORIZATION_EXPORTS)(
    "the authentication layer does not implement the authorization symbol %s",
    (name) => {
      const serverAuth = require("@/server/auth");
      expect(serverAuth[name]).toBeUndefined();
    },
  );

  it("the authentication layer does not import the authorization layer", () => {
    const offenders = walk(path.join(SRC, "server", "auth")).filter((file) =>
      /from\s+["'][^"']*(authz|authorization|ventureScope|venturePermissions|programScopedAccess|masterNavigation)/.test(
        fs.readFileSync(file, "utf8"),
      ),
    );

    expect(offenders.map(relative)).toEqual([]);
  });
});

describe("dependency hygiene", () => {
  it("bcrypt is imported only by the password module", () => {
    const offenders = walk(SRC)
      .filter((file) => !relative(file).startsWith("__tests__/"))
      .filter((file) => relative(file) !== "server/auth/password.js")
      .filter((file) => /(?:from|require\()\s*["']bcryptjs["']/.test(fs.readFileSync(file, "utf8")));

    expect(offenders.map(relative)).toEqual([]);
  });

  it("the server layer never imports the UI or the route handlers", () => {
    const offenders = walk(path.join(SRC, "server")).filter((file) => {
      const source = fs.readFileSync(file, "utf8");
      return /from\s+["']@\/(app|components)\//.test(source);
    });

    expect(offenders.map(relative)).toEqual([]);
  });
});
