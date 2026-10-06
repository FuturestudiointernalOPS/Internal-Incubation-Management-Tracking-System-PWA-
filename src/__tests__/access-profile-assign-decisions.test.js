/**
 * Characterisation net for the decisions that live inside
 * `src/app/api/access-profiles/assign/route.js` today.
 *
 * These assertions pin the BEHAVIOUR before the logic moves to
 * `@/services/authorization/profileAssignment.js` (corridor L5, block b):
 * separation of duties, the eligibility boundary, the capability-loss diff and
 * the override-removal fallback — including the ORDER in which they apply.
 *
 * The real `@/models/authorization` SQL runs against a mocked `@/lib/db`, so the
 * statements asserted here are the ones the route actually causes.
 */

const mockExecuted = [];

const mockState = {
  contact: null, // getContactForAssignment — the TARGET user
  activeProfile: null, // getActiveAccessProfile — the profile being assigned
  overrideProfile: null, // the contact's CURRENT active override profile
  roleDefaultProfile: null, // getRoleDefaultProfileName — fallback name
  groups: [], // getUserGroupNames
  profileCaps: [], // getProfileCapabilities — caps of the profile being assigned
  currentProfileCaps: [], // caps of the contact's current override profile
  roleCaps: [], // legacy role_capabilities rows
  eligibility: { valid: true, violations: [] },
  session: { cid: "SA-1", name: "Super Admin" },
};

function mockRows(sql, args) {
  if (/^\s*(CREATE TABLE|CREATE INDEX)/i.test(sql)) return { rows: [] };

  // getCurrentBaseCapabilities — the two probe queries run in parallel.
  if (sql.includes("FROM access_profiles WHERE id = ? AND is_active = 1")) {
    if (
      mockState.contact?.access_profile_id != null &&
      Number(args[0]) === Number(mockState.contact.access_profile_id)
    ) {
      return { rows: mockState.overrideProfile ? [mockState.overrideProfile] : [] };
    }
    return { rows: mockState.activeProfile ? [mockState.activeProfile] : [] };
  }
  if (sql.includes("FROM role_access_profile_defaults rpd")) {
    return { rows: mockState.roleDefaultProfile ? [mockState.roleDefaultProfile] : [] };
  }
  if (sql.includes("SELECT group_name FROM user_groups")) {
    return { rows: mockState.groups.map((group_name) => ({ group_name })) };
  }
  if (sql.includes("FROM access_profile_capabilities WHERE profile_id")) {
    if (
      mockState.contact?.access_profile_id != null &&
      Number(args[0]) === Number(mockState.contact.access_profile_id)
    ) {
      return { rows: mockState.currentProfileCaps };
    }
    return { rows: mockState.profileCaps };
  }
  if (sql.includes("FROM role_capabilities WHERE role")) return { rows: mockState.roleCaps };
  if (sql.includes("FROM contacts WHERE cid"))
    return { rows: mockState.contact ? [mockState.contact] : [] };

  return { rows: [], rowsAffected: 1 };
}

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    execute: jest.fn(async (query) => {
      const sql = String(typeof query === "string" ? query : query?.sql || "");
      const args = (typeof query === "string" ? [] : query?.args) || [];
      mockExecuted.push({ sql, args });
      return mockRows(sql, args);
    }),
  },
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/server/auth/session", () => ({
  getSession: jest.fn(async () => mockState.session),
}));
jest.mock("@/models/authorization/accessQueries", () => ({
  logPermissionAudit: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/server/authz/responses", () => ({
  requireAuthorization: jest.fn().mockResolvedValue(null),
  requireScopedAccess: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/services/authorization/context", () => ({
  ...jest.requireActual("@/services/authorization/context"),
  invalidateAuthorizationContext: jest.fn(),
  invalidateAllAuthorizationContexts: jest.fn(),
}));

// The eligibility boundary lives in the profileAssignment service, which reads
// assertTemplateCapsEligible straight from the eligibilityAdmin service.
jest.mock("@/services/authorization/eligibilityAdmin", () => ({
  ...jest.requireActual("@/services/authorization/eligibilityAdmin"),
  assertTemplateCapsEligible: jest.fn(async () => mockState.eligibility),
}));

const { assertTemplateCapsEligible } = require("@/services/authorization/eligibilityAdmin");
const assignRoute = require("@/app/api/access-profiles/assign/route");

const putReq = (body) =>
  new Request("http://localhost/api/access-profiles/assign", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const saw = (fragment) => mockExecuted.some((entry) => entry.sql.includes(fragment));
const sawAssign = () => saw("UPDATE contacts SET access_profile_id = ? WHERE cid = ?");
const sawClear = () => saw("UPDATE contacts SET access_profile_id = NULL");

beforeEach(() => {
  mockExecuted.length = 0;
  Object.assign(mockState, {
    contact: { cid: "U-1", name: "Dev Intern", role: "intern", access_profile_id: null },
    activeProfile: { id: 5, name: "Dev Interns" },
    overrideProfile: null,
    roleDefaultProfile: null,
    groups: [],
    profileCaps: [],
    currentProfileCaps: [],
    roleCaps: [],
    eligibility: { valid: true, violations: [] },
    session: { cid: "SA-1", name: "Super Admin" },
  });
  jest.clearAllMocks();
});

describe("separation of duties — self-assignment", () => {
  test("nobody changes their own profile, NOT even a Super Admin → 403", async () => {
    // A Super Admin session whose cid IS the target: still refused.
    mockState.session = { cid: "SA-1", name: "Super Admin" };
    mockState.contact = { cid: "SA-1", name: "Super Admin", role: "super_admin", access_profile_id: null };

    const res = await assignRoute.PUT(putReq({ user_cid: "SA-1", profile_id: 5 }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(String(body.error)).toMatch(/your own access profile/i);
    expect(sawAssign()).toBe(false);
  });

  test("the SoD check runs BEFORE the target-user lookup (cheapest gate first)", async () => {
    // The user_cid resolves to nothing at all — a 403 (SoD) proves the check
    // ran before the existence probe, which would have answered 404.
    mockState.session = { cid: "SA-1", name: "Super Admin" };
    mockState.contact = null;

    const res = await assignRoute.PUT(putReq({ user_cid: "SA-1", profile_id: 5 }));
    expect(res.status).toBe(403);
  });

  test("a different cid is not blocked — no false positive on a shared string", async () => {
    // "SA-1" vs "SA-11": the comparison must be exact, not prefix-based.
    mockState.session = { cid: "SA-1", name: "Super Admin" };
    mockState.contact = { cid: "SA-11", name: "Other Admin", role: "staff", access_profile_id: null };
    mockState.profileCaps = [{ module: "projects", capability: "view", access_level: 1 }];

    const res = await assignRoute.PUT(putReq({ user_cid: "SA-11", profile_id: 5 }));
    expect(res.status).toBe(200);
    expect(sawAssign()).toBe(true);
  });
});

describe("assign guards — order before any write", () => {
  test("unknown user → 404, no write", async () => {
    mockState.contact = null;
    const res = await assignRoute.PUT(putReq({ user_cid: "GHOST", profile_id: 5 }));
    expect(res.status).toBe(404);
    expect(sawAssign()).toBe(false);
  });

  test("inactive or unknown profile → 404, no write", async () => {
    mockState.activeProfile = null;
    const res = await assignRoute.PUT(putReq({ user_cid: "U-1", profile_id: 999 }));
    expect(res.status).toBe(404);
    expect(sawAssign()).toBe(false);
  });

  test("the profile existence check runs before eligibility (404 beats 400)", async () => {
    mockState.activeProfile = null;
    mockState.eligibility = { valid: false, violations: [{ module: "projects" }] };
    const res = await assignRoute.PUT(putReq({ user_cid: "U-1", profile_id: 999 }));
    expect(res.status).toBe(404);
    expect(assertTemplateCapsEligible).not.toHaveBeenCalled();
  });

  test("eligibility refusal → 400 with the violations, no write", async () => {
    mockState.eligibility = {
      valid: false,
      violations: [{ module: "operations", capability: "edit", feature: "operations" }],
    };
    const res = await assignRoute.PUT(putReq({ user_cid: "U-1", profile_id: 5 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe("errors.ineligibleTemplateCaps");
    expect(body.violations).toEqual([
      { module: "operations", capability: "edit", feature: "operations" },
    ]);
    expect(sawAssign()).toBe(false);
  });

  test("eligibility receives the user's role AND their groups", async () => {
    mockState.contact = { cid: "U-1", name: "Dev", role: "intern", access_profile_id: null };
    mockState.groups = ["crm-team", "ops"];
    mockState.profileCaps = [{ module: "projects", capability: "view", access_level: 1 }];

    await assignRoute.PUT(putReq({ user_cid: "U-1", profile_id: 5 }));
    expect(assertTemplateCapsEligible).toHaveBeenCalledWith({
      role: "intern",
      groups: ["crm-team", "ops"],
      profileId: 5,
    });
  });

  test("the eligibility boundary is skipped entirely when there is no session role", async () => {
    mockState.contact = { cid: "U-1", name: "No Role", role: null, access_profile_id: null };
    mockState.profileCaps = [{ module: "projects", capability: "view", access_level: 1 }];

    const res = await assignRoute.PUT(putReq({ user_cid: "U-1", profile_id: 5 }));
    // assertTemplateCapsEligible is still called (the decision is the service's),
    // but with an undefined role — the refusal logic lives there, not here.
    expect(res.status).toBe(200);
  });
});

describe("capability-loss diff — 409 contract", () => {
  test("removed is computed against the LEVEL, not just presence", async () => {
    // Today the user holds projects.edit at 3; the new profile grants it at 1.
    // Same capability, lower level → still a LOSS.
    mockState.contact = { cid: "U-1", name: "Dev", role: "staff", access_profile_id: null };
    mockState.roleCaps = [
      { module: "projects", capability: "edit", access_level: 3 },
      { module: "projects", capability: "view", access_level: 1 },
    ];
    mockState.profileCaps = [
      { module: "projects", capability: "edit", access_level: 1 },
      { module: "projects", capability: "view", access_level: 1 },
    ];

    const res = await assignRoute.PUT(putReq({ user_cid: "U-1", profile_id: 5 }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("profile_assignment_removes_capabilities");
    expect(body.loss.removed).toEqual([{ module: "projects", capability: "edit", level: 3 }]);
    expect(body.loss.removedCount).toBe(1);
    expect(body.loss.gainedCount).toBe(0);
    expect(sawAssign()).toBe(false);
  });

  test("a capability held at an EQUAL level is not a loss", async () => {
    mockState.contact = { cid: "U-1", name: "Dev", role: "staff", access_profile_id: null };
    mockState.roleCaps = [{ module: "projects", capability: "edit", access_level: 2 }];
    mockState.profileCaps = [
      { module: "projects", capability: "edit", access_level: 2 },
      { module: "projects", capability: "view", access_level: 1 },
    ];

    const res = await assignRoute.PUT(putReq({ user_cid: "U-1", profile_id: 5 }));
    expect(res.status).toBe(200);
  });

  test("gainedCount counts a capability raised to a HIGHER level", async () => {
    mockState.contact = { cid: "U-1", name: "Dev", role: "staff", access_profile_id: null };
    mockState.roleCaps = [{ module: "reports", capability: "export", access_level: 1 }];
    mockState.profileCaps = [{ module: "reports", capability: "export", access_level: 3 }];

    const res = await assignRoute.PUT(putReq({ user_cid: "U-1", profile_id: 5, confirm: true }));
    expect(res.status).toBe(200);
    // confirm:true skips the diff entirely — the gain is not reported.
  });

  test("an empty profile wins over the narrower case (409 empty, message counts all)", async () => {
    mockState.contact = { cid: "U-1", name: "Dev", role: "staff", access_profile_id: null };
    mockState.roleCaps = [
      { module: "projects", capability: "view", access_level: 1 },
      { module: "reports", capability: "view", access_level: 1 },
    ];
    mockState.profileCaps = [];

    const res = await assignRoute.PUT(putReq({ user_cid: "U-1", profile_id: 5 }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("profile_assignment_empty_profile");
    expect(body.loss.newCount).toBe(0);
    expect(body.loss.removedCount).toBe(2);
    expect(String(body.message)).toMatch(/removes all 2 capabilities/i);
  });

  test("removed payload is capped at 25 entries, counts stay exact", async () => {
    mockState.contact = { cid: "U-1", name: "Dev", role: "staff", access_profile_id: null };
    mockState.roleCaps = Array.from({ length: 40 }, (_, i) => ({
      module: "reports",
      capability: `cap_${i}`,
      access_level: 1,
    }));
    mockState.profileCaps = [];

    const res = await assignRoute.PUT(putReq({ user_cid: "U-1", profile_id: 5 }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.loss.removed).toHaveLength(25);
    expect(body.loss.removedCount).toBe(40);
    expect(body.loss.currentCount).toBe(40);
  });

  test("confirm:true bypasses the diff but NOT eligibility", async () => {
    mockState.eligibility = { valid: false, violations: [{ module: "operations" }] };
    const res = await assignRoute.PUT(putReq({ user_cid: "U-1", profile_id: 5, confirm: true }));
    expect(res.status).toBe(400);
    expect(sawAssign()).toBe(false);
  });

  test("confirm must be strictly true — a truthy string does NOT bypass", async () => {
    mockState.contact = { cid: "U-1", name: "Dev", role: "staff", access_profile_id: null };
    mockState.roleCaps = [{ module: "projects", capability: "view", access_level: 1 }];
    mockState.profileCaps = [];

    const res = await assignRoute.PUT(putReq({ user_cid: "U-1", profile_id: 5, confirm: "true" }));
    expect(res.status).toBe(409);
    expect(sawAssign()).toBe(false);
  });
});

describe("override removal — fallback to the role default", () => {
  test("profile_id null clears the override and reports the role default", async () => {
    mockState.roleDefaultProfile = { name: "Intern Default" };

    const res = await assignRoute.PUT(putReq({ user_cid: "U-1", profile_id: null }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.roleDefaultName).toBe("Intern Default");
    expect(sawClear()).toBe(true);
  });

  test("no role default → roleDefaultName null, message unchanged", async () => {
    mockState.roleDefaultProfile = null;
    const res = await assignRoute.PUT(putReq({ user_cid: "U-1", profile_id: null }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.roleDefaultName).toBeNull();
    expect(String(body.message)).toMatch(/falling back to role default/i);
  });

  test("removal runs NO eligibility probe and NO capability diff", async () => {
    mockState.eligibility = { valid: false, violations: [{ module: "operations" }] };
    mockState.roleCaps = [{ module: "projects", capability: "view", access_level: 1 }];

    const res = await assignRoute.PUT(putReq({ user_cid: "U-1", profile_id: null }));
    expect(res.status).toBe(200);
    expect(assertTemplateCapsEligible).not.toHaveBeenCalled();
  });

  test("removal still requires an existing user → 404 before the clear", async () => {
    mockState.contact = null;
    const res = await assignRoute.PUT(putReq({ user_cid: "GHOST", profile_id: null }));
    expect(res.status).toBe(404);
    expect(sawClear()).toBe(false);
  });

  test("SoD also protects the REMOVE branch", async () => {
    mockState.session = { cid: "SA-1", name: "Super Admin" };
    mockState.contact = { cid: "SA-1", name: "Super Admin", role: "super_admin", access_profile_id: 5 };

    const res = await assignRoute.PUT(putReq({ user_cid: "SA-1", profile_id: null }));
    expect(res.status).toBe(403);
    expect(sawClear()).toBe(false);
  });
});

describe("audit + cache invalidation", () => {
  test("an assignment logs profile_assigned and invalidates that user's context", async () => {
    const { logPermissionAudit } = require("@/models/authorization/accessQueries");
    const { invalidateAuthorizationContext } = require("@/services/authorization/context");
    mockState.profileCaps = [{ module: "projects", capability: "view", access_level: 1 }];

    await assignRoute.PUT(putReq({ user_cid: "U-1", profile_id: 5 }));
    expect(logPermissionAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "profile_assigned", targetCid: "U-1" }),
    );
    expect(invalidateAuthorizationContext).toHaveBeenCalledWith("U-1");
  });

  test("a removal logs profile_removed and invalidates the same context", async () => {
    const { logPermissionAudit } = require("@/models/authorization/accessQueries");
    const { invalidateAuthorizationContext } = require("@/services/authorization/context");

    await assignRoute.PUT(putReq({ user_cid: "U-1", profile_id: null }));
    expect(logPermissionAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "profile_removed", targetCid: "U-1" }),
    );
    expect(invalidateAuthorizationContext).toHaveBeenCalledWith("U-1");
  });

  test("a refused 409 writes no audit entry", async () => {
    const { logPermissionAudit } = require("@/models/authorization/accessQueries");
    mockState.roleCaps = [{ module: "projects", capability: "view", access_level: 1 }];
    mockState.profileCaps = [];

    await assignRoute.PUT(putReq({ user_cid: "U-1", profile_id: 5 }));
    expect(logPermissionAudit).not.toHaveBeenCalled();
  });
});

describe("GET /api/access-profiles/assign — effective source reporting", () => {
  const getReq = (cid) =>
    new Request(`http://localhost/api/access-profiles/assign?user_cid=${cid}`);

  test("missing user_cid → 400", async () => {
    const res = await assignRoute.GET(
      new Request("http://localhost/api/access-profiles/assign"),
    );
    expect(res.status).toBe(400);
  });

  test("unknown user → 404", async () => {
    mockState.contact = null;
    const res = await assignRoute.GET(getReq("GHOST"));
    expect(res.status).toBe(404);
  });
});