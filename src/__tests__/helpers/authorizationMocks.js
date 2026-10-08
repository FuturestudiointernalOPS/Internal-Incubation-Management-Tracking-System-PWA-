/**
 * Shared mocks + context factories for the authorization resolver suites.
 *
 * The auth mocks own the permission matrix and the session these tests assert
 * against, so they live here once instead of being copied into every suite. A
 * test file registers them per home, e.g.
 * `jest.mock("@/server/auth/session", () => ({ getSession: mockAuthz.auth.getSession }))`
 * (also `@/server/authz/capabilities`, `@/models/authorization/bootstrap`) — the
 * `mock` prefix is what lets babel-plugin-jest-hoist accept the out-of-scope
 * reference. Jest's module registry is per test file, so these factories are
 * rebuilt for every suite that requires this helper.
 */

const PERMISSION_MODULES = {
    projects: { capabilities: ["view", "create", "edit", "delete", "archive"] },
    programs: { capabilities: ["view", "create", "edit", "delete", "publish"] },
    users: {
      capabilities: ["view", "create", "edit", "suspend", "delete", "assign_roles"],
    },
    reports: { capabilities: ["view", "create", "export", "delete"] },
    messaging: { capabilities: ["view", "send", "delete"] },
    internal_comms: { capabilities: ["view", "create_announcements", "moderate"] },
    contacts: { capabilities: ["view", "create", "edit", "delete"] },
    permissions: {
      capabilities: [
        "view_matrix",
        "grant",
        "revoke",
        "assign_capabilities",
        "assign_groups",
        "assign_responsibilities",
        "promote_super_admin",
        "remove_super_admin",
        "configure_eligibility",
      ],
    },
    engineering: {
      capabilities: ["view", "manage_tasks", "manage_errors"],
    },
    finance: { capabilities: ["view", "create", "edit", "delete", "export"] },
    settings: { capabilities: ["view", "edit"] },
    org_membership: { capabilities: ["view", "manage"] },
    facilitator: {
      capabilities: [
        "participants.view",
        "participants.manage",
        "attendance.view",
        "attendance.record",
        "assignments.view",
        "assignments.review",
        "assignments.grade",
        "sessions.conduct",
        "sessions.record",
        "progress.view",
        "groups.view",
        "groups.manage",
        "reviews.submit",
      ],
    },
};

module.exports = {
  auth: {
      PERMISSION_MODULES,
      ACCESS_LEVELS: { NONE: 0, VIEW: 1, CREATE: 2, EDIT: 3, DELETE: 4, FULL: 5 },
      getSession: jest.fn(async () => null),
      ensurePermissionsSchema: jest.fn(async () => {}),
  },
  nextServer: {
    NextResponse: {
      json: (body, init = {}) => ({ body, ...init }),
    },
  },
  db: {
    __esModule: true,
    default: { execute: jest.fn(async () => ({ rows: [] })) },
    initDb: jest.fn(async () => {}),
  },
  saCtx: (overrides = {}) => ({
    cid: "USR-SA",
    role: "super_admin",
    isSuperAdmin: true,
    eligibility: null,
    effective: { finance: { view: 5, create: 5 } },
    grants: {},
    restrictions: {},
    ...overrides,
  }),
  staffCtx: (overrides = {}) => ({
    cid: "USR-STAFF",
    role: "staff",
    isSuperAdmin: false,
    eligibility: { finance: true, crm: false },
    effective: { finance: { view: 1, create: 2 }, contacts: { view: 3 } },
    grants: {},
    restrictions: {},
    ...overrides,
  }),
};
