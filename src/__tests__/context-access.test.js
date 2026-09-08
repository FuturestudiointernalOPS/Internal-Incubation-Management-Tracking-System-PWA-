/**
 * Phase 8 — CONTEXT & ASSIGNMENT ACCESS tests (§14 matrix).
 *
 * Covers the standardized scoped decision path (requireScopedAccess):
 * capability AND context both required, SA bypass, per-resource assignment
 * resolution (program / project / venture). Development tests only — the
 * comprehensive suite is reserved for Phase 12.
 *
 * Membership-layer guarantees (external facilitator never in FUTURE STUDIO,
 * expired membership stops organizational access, participant → facilitator
 * history preserved) are covered by membership.test.js + resolver tests;
 * the relevant combinations are re-asserted here at the context layer.
 */

const mockDbRows = {
  v2ProgramStaff: [], // { program_id, staff_id, role }
  contactRoles: [], // { context_type, context_id, contact_cid, is_current, role, started_at }
  projectMembers: [], // { project_id, user_cid }
  ventureMembers: [], // { venture_id, user_cid, contact_id, removed_at }
};

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    execute: jest.fn(async ({ sql, args = [] }) => {
      const s = String(sql);
      if (s.includes("FROM v2_program_staff")) {
        const [programId, staffId] = args;
        return {
          rows: mockDbRows.v2ProgramStaff.filter(
            (r) => String(r.program_id) === String(programId) && String(r.staff_id) === String(staffId),
          ),
        };
      }
      if (s.includes("FROM contact_roles")) {
        const [contextId, userCid] = args;
        return {
          rows: mockDbRows.contactRoles
            .filter(
              (r) =>
                String(r.context_id) === String(contextId) &&
                String(r.contact_cid) === String(userCid) &&
                r.is_current === true,
            )
            .sort((a, b) => new Date(b.started_at || 0) - new Date(a.started_at || 0)),
        };
      }
      if (s.includes("FROM project_members")) {
        const [projectId, userCid] = args;
        return {
          rows: mockDbRows.projectMembers.filter(
            (r) => String(r.project_id) === String(projectId) && String(r.user_cid) === String(userCid),
          ),
        };
      }
      if (s.includes("FROM venture_members")) {
        const [ventureId, userCid, contactId] = args;
        return {
          rows: mockDbRows.ventureMembers.filter(
            (r) =>
              String(r.venture_id) === String(ventureId) &&
              (String(r.user_cid) === String(userCid) || String(r.contact_id) === String(contactId)) &&
              r.removed_at == null,
          ),
        };
      }
      return { rows: [] };
    }),
  },
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn().mockResolvedValue({ cid: "USR_X", name: "X", role: "staff", email: "x@example.com" }),
}));

const mockAuthzContext = { isSuperAdmin: false, eligibility: {}, effective: {} };
let mockCapabilityDecision = null; // null = capability allowed
jest.mock("@/lib/authorization", () => ({
  getAuthorizationContext: jest.fn().mockImplementation(async () => mockAuthzContext),
  requireAuthorization: jest.fn().mockImplementation(async () => mockCapabilityDecision),
}));

const { requireScopedAccess, resolveContextAssignment } = require("@/lib/authorization/context");
const { requireAuthorization } = require("@/lib/authorization");

const allow = { resource: "program", contextId: "P1", module: "programs", capability: "view" };

beforeEach(() => {
  mockDbRows.v2ProgramStaff = [];
  mockDbRows.contactRoles = [];
  mockDbRows.projectMembers = [];
  mockDbRows.ventureMembers = [];
  mockAuthzContext.isSuperAdmin = false;
  mockCapabilityDecision = null;
  jest.clearAllMocks();
});

const status = async (res) => (res ? res.status : 200);

describe("A/B — staff: capability AND assignment required", () => {
  test("staff with capability but NO assignment → denied (A)", async () => {
    expect(await status(await requireScopedAccess(allow))).toBe(403);
  });

  test("staff with capability + program assignment → allowed (B)", async () => {
    mockDbRows.v2ProgramStaff = [{ program_id: "P1", staff_id: "USR_X", role: "assistant" }];
    expect(await status(await requireScopedAccess(allow))).toBe(200);
  });

  test("staff with assignment but NO capability → denied (capability is never bypassed)", async () => {
    mockDbRows.contactRoles = [
      { context_type: "program", context_id: "P1", contact_cid: "USR_X", is_current: true, role: "assistant" },
    ];
    mockCapabilityDecision = new Response(JSON.stringify({ success: false }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
    expect(await status(await requireScopedAccess(allow))).toBe(403);
  });
});

describe("C/D — facilitator: program-scoped access", () => {
  test("facilitator with capability but NO program assignment → denied (C)", async () => {
    const res = await requireScopedAccess({
      resource: "program",
      contextId: "P1",
      module: "facilitator",
      capability: "participants.view",
    });
    expect(await status(res)).toBe(403);
  });

  test("facilitator with program assignment + facilitator capability → allowed (D)", async () => {
    mockDbRows.v2ProgramStaff = [{ program_id: "P1", staff_id: "USR_X", role: "facilitator" }];
    const res = await requireScopedAccess({
      resource: "program",
      contextId: "P1",
      module: "facilitator",
      capability: "participants.view",
    });
    expect(await status(res)).toBe(200);
  });

  test("assignment via the generalized contact_roles layer also resolves (participant → facilitator history preserved via is_current)", async () => {
    // Past participant relationship (is_current=false) + current facilitator.
    mockDbRows.contactRoles = [
      { context_type: "program", context_id: "P1", contact_cid: "USR_X", is_current: false, role: "participant", started_at: "2025-01-01" },
      { context_type: "program", context_id: "P1", contact_cid: "USR_X", is_current: true, role: "facilitator", started_at: "2026-01-01" },
    ];
    const resolved = await resolveContextAssignment({ resource: "program", contextId: "P1", userCid: "USR_X" });
    expect(resolved).not.toBeNull();
    expect(resolved.source).toBe("contact_roles");
    expect(resolved.assignment.role).toBe("facilitator");
  });
});

describe("E/F — external facilitator vs Future Studio staff + facilitator", () => {
  test("context resolution never consults organizational membership (no FUTURE STUDIO coupling)", async () => {
    mockDbRows.v2ProgramStaff = [{ program_id: "P1", staff_id: "USR_X", role: "facilitator" }];
    const resolved = await resolveContextAssignment({ resource: "program", contextId: "P1", userCid: "USR_X" });
    expect(resolved.source).toBe("v2_program_staff");
    // The context layer has no notion of FUTURE STUDIO — membership stays separate.
    const dbSql = require("@/lib/db").default.execute;
    expect(dbSql.mock.calls.some(([c]) => String(c.sql || "").includes("group_memberships"))).toBe(false);
  });
});

describe("G — participant → facilitator transition", () => {
  test("current role wins; historical participant rows remain untouched (no deletion anywhere)", async () => {
    mockDbRows.contactRoles = [
      { context_type: "program", context_id: "P1", contact_cid: "USR_X", is_current: false, role: "participant" },
      { context_type: "program", context_id: "P1", contact_cid: "USR_X", is_current: true, role: "facilitator" },
    ];
    const resolved = await resolveContextAssignment({ resource: "program", contextId: "P1", userCid: "USR_X" });
    expect(resolved.assignment.role).toBe("facilitator");
    expect(mockDbRows.contactRoles.filter((r) => r.role === "participant").length).toBe(1); // history intact
  });
});

describe("H/I — venture & project scoping", () => {
  test("venture member → allowed; non-member → denied (H)", async () => {
    mockDbRows.ventureMembers = [{ venture_id: "V1", user_cid: "USR_X", contact_id: "USR_X", removed_at: null }];
    const res = await requireScopedAccess({ resource: "venture", contextId: "V1", module: "ventures", capability: "view" });
    expect(await status(res)).toBe(200);

    mockDbRows.ventureMembers = [];
    const denied = await requireScopedAccess({ resource: "venture", contextId: "V1", module: "ventures", capability: "view" });
    expect(await status(denied)).toBe(403);
  });

  test("removed venture membership does not grant access", async () => {
    mockDbRows.ventureMembers = [{ venture_id: "V1", user_cid: "USR_X", contact_id: "USR_X", removed_at: "2026-01-01" }];
    const res = await requireScopedAccess({ resource: "venture", contextId: "V1", module: "ventures", capability: "view" });
    expect(await status(res)).toBe(403);
  });

  test("project member → allowed; non-member denied; no cross-project access (I)", async () => {
    mockDbRows.projectMembers = [{ project_id: "15", user_cid: "USR_X" }];
    const own = await requireScopedAccess({ resource: "project", contextId: "15", module: "projects", capability: "view" });
    expect(await status(own)).toBe(200);

    const other = await requireScopedAccess({ resource: "project", contextId: "16", module: "projects", capability: "view" });
    expect(await status(other)).toBe(403);
  });
});

describe("L — Super Admin bypass + context integrity", () => {
  test("SA passes without assignment (existing resolver semantics)", async () => {
    mockAuthzContext.isSuperAdmin = true;
    const res = await requireScopedAccess(allow);
    expect(await status(res)).toBe(200);
    expect(requireAuthorization).not.toHaveBeenCalled();
  });

  test("missing contextId → 403 (no URL/body manipulation can target nothing)", async () => {
    const res = await requireScopedAccess({ ...allow, contextId: "" });
    expect(await status(res)).toBe(403);
  });

  test("unknown resource type → 403 (no silent fallback)", async () => {
    const res = await requireScopedAccess({ resource: "planet", contextId: "X", module: "programs", capability: "view" });
    expect(await status(res)).toBe(403);
  });
});
