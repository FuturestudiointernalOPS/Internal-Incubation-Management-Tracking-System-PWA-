/**
 * PHASE B — the profile ↔ role rule (docs/ROADMAP_ROLES_PROFILES_ACCESS.md).
 *
 * Three surfaces:
 *   1. `evaluateProfileRoleFit` — the PURE decision (allowed / role-not-allowed /
 *      profile-inactive), plus the two helpers around it (the couple → profile
 *      mapping and the enforcement gate);
 *   2. the AUTOMATIC control point — `syncContextGrantsForUser` reports the écart
 *      and, since Phase H flipped `PROFILE_ROLE_ENFORCEMENT` to "block", REFUSES
 *      it before any write (the earlier "warn" phase reported it and still
 *      applied the grants);
 *   3. the MANUAL control point — a responsibility whose key names a profile
 *      yields the same écart, and a key that names no profile yields nothing.
 *
 * The reconcile runs against the REAL service over a mocked database, so the
 * statements the check points cause are exercised, not stubbed away.
 */

const mockState = {
  founderCids: new Set(), // cids with an ACTIVE founder relationship
  profileRows: [], // rows of the `profiles` table
  contacts: {}, // cid → { role }
  profileCaps: [
    { module: "ventures", capability: "view", access_level: 1 },
    { module: "ventures", capability: "edit", access_level: 3 },
  ],
  userCaps: [],
  applied: [],
};

function profileRow(key, context, allowedRoles, isActive = 1) {
  return {
    key,
    context,
    allowed_roles: JSON.stringify(allowedRoles),
    is_active: isActive,
    notes: "",
  };
}

function mockExecute(query) {
  const sqlText = typeof query === "string" ? query : query.sql || "";
  const args = typeof query === "string" ? [] : query.args || [];

  if (/^\s*(CREATE TABLE|CREATE INDEX)/i.test(sqlText)) return { rows: [] };

  if (sqlText.includes("FROM profiles")) {
    const key = String(args[0]);
    return { rows: mockState.profileRows.filter((row) => row.key === key) };
  }

  if (sqlText.includes("SELECT role, access_profile_id FROM contacts WHERE cid = ?")) {
    const contact = mockState.contacts[String(args[0])];
    return { rows: contact ? [{ role: contact.role, access_profile_id: null }] : [] };
  }

  if (sqlText.includes("FROM context_role_profiles")) {
    return {
      rows: [
        {
          id: 1,
          context: "venture",
          role_key: "founder",
          profile_id: 7,
          is_active: 1,
          profile_name: "Founder",
        },
      ],
    };
  }

  if (sqlText.includes("FROM access_profile_capabilities")) {
    return { rows: mockState.profileCaps };
  }

  if (sqlText.includes("FROM venture_members")) {
    return {
      rows: mockState.founderCids.has(String(args[0]))
        ? [{ venture_id: "VNT-1" }]
        : [],
    };
  }

  if (sqlText.includes("SELECT module, capability, access_level, granted_by, expires_at FROM user_capabilities")) {
    return { rows: mockState.userCaps.filter((row) => row.user_cid === String(args[0])) };
  }

  if (sqlText.includes("INSERT INTO user_capabilities")) {
    const [user_cid, module, capability, access_level, granted_by] = args;
    mockState.userCaps = mockState.userCaps.filter(
      (row) => !(row.user_cid === user_cid && row.module === module && row.capability === capability),
    );
    mockState.userCaps.push({ user_cid, module, capability, access_level, granted_by });
    return { rows: [] };
  }

  if (sqlText.includes("DELETE FROM user_capabilities")) {
    const [user_cid, module, capability, granted_by] = args;
    mockState.userCaps = mockState.userCaps.filter(
      (row) =>
        !(
          row.user_cid === user_cid &&
          row.module === module &&
          row.capability === capability &&
          row.granted_by === granted_by
        ),
    );
    return { rows: [] };
  }

  if (sqlText.includes("FROM context_applied_grants") && sqlText.includes("SELECT")) {
    return {
      rows: mockState.applied.filter(
        (row) =>
          row.user_cid === String(args[0]) &&
          row.context === args[1] &&
          row.role_key === args[2],
      ),
    };
  }

  if (sqlText.includes("INSERT INTO context_applied_grants")) {
    const [user_cid, context, role_key, source_ref, module, capability, access_level] = args;
    mockState.applied = mockState.applied.filter(
      (row) =>
        !(
          row.user_cid === user_cid &&
          row.context === context &&
          row.role_key === role_key &&
          row.module === module &&
          row.capability === capability
        ),
    );
    mockState.applied.push({ user_cid, context, role_key, source_ref, module, capability, access_level });
    return { rows: [] };
  }

  if (sqlText.includes("DELETE FROM context_applied_grants")) {
    const [user_cid, context, role_key, module, capability] = args;
    mockState.applied = mockState.applied.filter(
      (row) =>
        !(
          row.user_cid === user_cid &&
          row.context === context &&
          row.role_key === role_key &&
          row.module === module &&
          row.capability === capability
        ),
    );
    return { rows: [] };
  }

  if (sqlText.includes("UPDATE context_applied_grants SET source_ref")) {
    const [source_ref, user_cid, context, role_key] = args;
    for (const applied of mockState.applied) {
      if (applied.user_cid === user_cid && applied.context === context && applied.role_key === role_key) {
        applied.source_ref = source_ref;
      }
    }
    return { rows: [] };
  }

  return { rows: [] };
}

const mockDb = { execute: jest.fn(async (query) => mockExecute(query)) };

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: mockDb,
  initDb: jest.fn(async () => true),
}));

jest.mock("@/services/authorization/context", () => ({
  invalidateAuthorizationContext: jest.fn(),
}));

const {
  PROFILE_ROLE_ENFORCEMENT,
  evaluateProfileRoleFit,
  profileKeyForContextRole,
  profileRoleGateDecision,
  buildProfileRoleGap,
} = require("@/services/authorization/profileCatalog");
const { buildResponsibilityProfileGap } = require("@/services/authorization/responsibilityAssignment");
const { syncContextGrantsForUser } = require("@/services/authorization/contextGrants");

const CID = "C-PROFILE";

beforeEach(() => {
  mockState.founderCids = new Set();
  mockState.profileRows = [];
  mockState.contacts = {};
  mockState.userCaps = [];
  mockState.applied = [];
  mockDb.execute.mockClear();
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ── 1. The pure decision ─────────────────────────────────────────────────────

describe("evaluateProfileRoleFit", () => {
  test("the DEFAULT switch is block — Phase H refuses the écart", () => {
    expect(PROFILE_ROLE_ENFORCEMENT).toBe("block");
  });

  test("a role the profile lists is allowed", () => {
    expect(evaluateProfileRoleFit({ allowedRoles: ["member"] }, "member")).toEqual({
      allowed: true,
      reason: "ok",
    });
  });

  test("a role the profile does not list is refused, with the reason", () => {
    // program_manager is staff-only; a baseline member is the acceptance case.
    expect(evaluateProfileRoleFit({ allowedRoles: ["staff"] }, "member")).toEqual({
      allowed: false,
      reason: "role-not-allowed",
    });
  });

  test("an inactive profile is refused whatever the role", () => {
    expect(
      evaluateProfileRoleFit({ allowedRoles: ["member"], is_active: 0 }, "member"),
    ).toEqual({ allowed: false, reason: "profile-inactive" });
    expect(
      evaluateProfileRoleFit({ allowedRoles: ["member"], isActive: false }, "member"),
    ).toEqual({ allowed: false, reason: "profile-inactive" });
  });

  test("[] means explicitly nobody — every baseline role is an écart", () => {
    for (const role of ["member", "staff"]) {
      expect(evaluateProfileRoleFit({ allowedRoles: [] }, role).reason).toBe("role-not-allowed");
    }
  });

  test("Super Admin is out of ceiling — never an écart", () => {
    expect(evaluateProfileRoleFit({ allowedRoles: [] }, "super_admin")).toEqual({
      allowed: true,
      reason: "ok",
    });
  });

  test("accepts a STORED row shape (JSON string + 1/0)", () => {
    expect(evaluateProfileRoleFit({ allowed_roles: '["staff"]', is_active: 1 }, "staff")).toEqual({
      allowed: true,
      reason: "ok",
    });
    expect(evaluateProfileRoleFit({ allowed_roles: '["staff"]', is_active: 1 }, "member")).toEqual({
      allowed: false,
      reason: "role-not-allowed",
    });
  });

  test("an unknown/absent role fails closed", () => {
    expect(evaluateProfileRoleFit({ allowedRoles: ["member"] }, null).reason).toBe(
      "role-not-allowed",
    );
  });
});

describe("profileKeyForContextRole", () => {
  test("maps the supported couples to their profile key", () => {
    expect(profileKeyForContextRole("venture", "founder")).toBe("founder");
    expect(profileKeyForContextRole("program", "facilitator")).toBe("facilitator");
    expect(profileKeyForContextRole("program", "program_manager")).toBe("program_manager");
  });

  test("a couple whose context does not match the profile is not a profile", () => {
    expect(profileKeyForContextRole("lms", "founder")).toBe(null);
    expect(profileKeyForContextRole("venture", "ghost")).toBe(null);
  });
});

describe("profileRoleGateDecision — one switch, both control points", () => {
  const gap = { profile: "program_manager", role: "member", reason: "role-not-allowed" };

  test("no écart is never blocked", () => {
    expect(profileRoleGateDecision(null, "block").blocked).toBe(false);
  });

  test("warn reports the écart without blocking", () => {
    expect(profileRoleGateDecision(gap, "warn")).toEqual({
      blocked: false,
      gap,
      mode: "warn",
    });
  });

  test("block refuses (Phase H)", () => {
    expect(profileRoleGateDecision(gap, "block").blocked).toBe(true);
  });
});

// ── 2. The automatic control point ───────────────────────────────────────────

describe("syncContextGrantsForUser — the profile ↔ role écart", () => {
  test("a member founder (profile allows member) has no écart", async () => {
    mockState.founderCids.add(CID);
    mockState.contacts[CID] = { role: "member" };
    mockState.profileRows = [profileRow("founder", "venture", ["member"])];

    const result = await syncContextGrantsForUser(CID, { context: "venture", roleKey: "founder" });

    expect(result.success).toBe(true);
    expect(result.profileRoleGap).toBeNull();
  });

  test("a member holding a staff-only profile is REFUSED before any write", async () => {
    mockState.founderCids.add(CID);
    mockState.contacts[CID] = { role: "member" };
    // The administrator narrowed the profile to staff only.
    mockState.profileRows = [profileRow("founder", "venture", ["staff"])];

    const result = await syncContextGrantsForUser(CID, { context: "venture", roleKey: "founder" });

    // Phase H — the écart now blocks: the reconcile returns before applying
    // anything, so the profile is never attributed to a non-listed role.
    expect(result.success).toBe(false);
    expect(result.error).toBe("profile-role-not-allowed");
    expect(result.profileRoleGap).toEqual({
      profile: "founder",
      role: "member",
      reason: "role-not-allowed",
    });
    expect(result.applied).toBeUndefined();
    expect(mockState.userCaps).toEqual([]);
    expect(mockState.applied).toEqual([]);
  });

  test("an inactive profile is REFUSED with profile-inactive, before any write", async () => {
    mockState.founderCids.add(CID);
    mockState.contacts[CID] = { role: "member" };
    mockState.profileRows = [profileRow("founder", "venture", ["member"], 0)];

    const result = await syncContextGrantsForUser(CID, { context: "venture", roleKey: "founder" });

    expect(result.success).toBe(false);
    expect(result.error).toBe("profile-role-not-allowed");
    expect(result.profileRoleGap.reason).toBe("profile-inactive");
    expect(mockState.userCaps).toEqual([]);
  });

  test("a Super Admin is never an écart, whatever the profile allows", async () => {
    mockState.founderCids.add(CID);
    mockState.contacts[CID] = { role: "super_admin" };
    mockState.profileRows = [profileRow("founder", "venture", ["member"])];

    const result = await syncContextGrantsForUser(CID, { context: "venture", roleKey: "founder" });

    expect(result.profileRoleGap).toBeNull();
  });

  test("no active relationship means no profile is attributed — no écart, no work", async () => {
    mockState.contacts[CID] = { role: "member" };
    mockState.profileRows = [profileRow("founder", "venture", ["staff"])];

    const result = await syncContextGrantsForUser(CID, { context: "venture", roleKey: "founder" });

    expect(result.profileRoleGap).toBeNull();
  });

  test("the stored catalogue row wins over the code default", async () => {
    mockState.founderCids.add(CID);
    mockState.contacts[CID] = { role: "staff" };
    // The default catalogue opens `founder` to member; the admin edit does not.
    mockState.profileRows = [profileRow("founder", "venture", ["member"])];

    const gap = await buildProfileRoleGap({ profileKey: "founder", cid: CID });
    expect(gap).toEqual({ profile: "founder", role: "staff", reason: "role-not-allowed" });
  });
});

// ── 3. The manual control point ──────────────────────────────────────────────

describe("buildResponsibilityProfileGap — the manual responsibility path", () => {
  test("a responsibility whose key names no profile yields no écart, without a read", async () => {
    mockState.contacts[CID] = { role: "member" };
    expect(
      await buildResponsibilityProfileGap({ userCid: CID, responsibilityKey: "crm" }),
    ).toBeNull();
  });

  test("a responsibility naming a profile yields the same écart as the automatic path", async () => {
    mockState.contacts[CID] = { role: "member" };
    mockState.profileRows = [profileRow("program_manager", "program", ["staff"])];

    expect(
      await buildResponsibilityProfileGap({ userCid: CID, responsibilityKey: "program_manager" }),
    ).toEqual({ profile: "program_manager", role: "member", reason: "role-not-allowed" });
  });

  test("a fitting role yields nothing", async () => {
    mockState.contacts[CID] = { role: "staff" };
    mockState.profileRows = [profileRow("program_manager", "program", ["staff"])];

    expect(
      await buildResponsibilityProfileGap({ userCid: CID, responsibilityKey: "program_manager" }),
    ).toBeNull();
  });
});
