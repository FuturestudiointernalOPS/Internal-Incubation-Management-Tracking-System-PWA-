/**
 * PHASE 4 — Context Role → Profile registry.
 *
 * Two contracts are locked here:
 *   1. The seed catalogue stays consistent with the identity model
 *      (known contexts, valid keys, unique pairs, existing profile names,
 *      unmapped roles kept as visible gaps rather than invented defaults).
 *   2. The API is a GOVERNANCE surface: capability-gated, audited, validated —
 *      and it must NOT invalidate authorization contexts, because the resolver
 *      does not consume the registry yet (no behavior change in Phase 4).
 */

const executed = [];

let mockProfileMetaRows = [];

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    execute: jest.fn(async (queryObj) => {
      const sql = typeof queryObj === "string" ? queryObj : queryObj?.sql;
      const args = typeof queryObj === "string" ? [] : queryObj?.args || [];
      executed.push({ sql: String(sql), args });

      if (String(sql).includes("SELECT id FROM access_profiles WHERE name ="))
        return { rows: [{ id: 7 }] };
      if (String(sql).includes("FROM access_profiles WHERE id ="))
        return { rows: mockProfileMetaRows };
      if (String(sql).includes("FROM context_role_profiles")) {
        return {
          rows: [
            {
              id: 1,
              context: "venture",
              role_key: "founder",
              profile_id: null,
              is_active: 1,
              notes: "",
              profile_name: null,
            },
          ],
        };
      }
      if (String(sql).includes("SELECT ap.*")) {
        return { rows: [{ id: 7, name: "Mentor", is_active: 1 }] };
      }
      if (String(sql).includes("COUNT(")) return { rows: [{ c: 4 }] };
      return { rows: [] };
    }),
  },
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn().mockResolvedValue({ cid: "SA-1", name: "Super Admin" }),
  logPermissionAudit: jest.fn().mockResolvedValue(true),
}));

let mockAuthzDecision = null;
const mockInvalidateAll = jest.fn();
jest.mock("@/lib/authorization", () => ({
  requireAuthorization: jest.fn().mockImplementation(async () => mockAuthzDecision),
  invalidateAllAuthorizationContexts: mockInvalidateAll,
}));

const requireAuthorization = require("@/lib/authorization").requireAuthorization;
const logPermissionAudit = require("@/lib/auth").logPermissionAudit;
const invalidateAllAuthorizationContexts = mockInvalidateAll;
const route = require("@/app/api/engineering/permissions/context-roles/route");
const {
  CONTEXT_ROLE_CONTEXTS,
  CONTEXT_ROLE_SEED,
  isValidContextRoleContext,
  isValidContextRoleKey,
} = require("@/models/authorization/contextRoleProfiles");

/** Profile names created by seedDefaultAccessProfiles() in src/lib/auth.js. */
const SEEDED_PROFILE_NAMES = [
  "Super Admin Default",
  "Staff Default",
  "Participant Default",
  "Developer",
  "Developer Intern",
  "Program Manager",
  "Project Owner",
  "Operations Manager",
  "Instructor",
  "Finance Assistant",
  "Mentor",
  "Founder",
];

const putReq = (body) =>
  new Request("http://localhost/api/engineering/permissions/context-roles", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  executed.length = 0;
  mockAuthzDecision = null;
  mockProfileMetaRows = [{ id: 7, name: "Mentor" }];
  jest.clearAllMocks();
});

describe("Phase 4 — seed catalogue integrity", () => {
  test("every seed row uses a known context and a valid role key", () => {
    for (const row of CONTEXT_ROLE_SEED) {
      expect(isValidContextRoleContext(row.context)).toBe(true);
      expect(isValidContextRoleKey(row.role_key)).toBe(true);
    }
  });

  test("(context, role_key) pairs are unique", () => {
    const seen = new Set(CONTEXT_ROLE_SEED.map((r) => `${r.context}:${r.role_key}`));
    expect(seen.size).toBe(CONTEXT_ROLE_SEED.length);
  });

  test("mapped seed profiles exist in the default profile seed (no typos)", () => {
    for (const row of CONTEXT_ROLE_SEED) {
      if (row.profile_name !== null) {
        expect(SEEDED_PROFILE_NAMES).toContain(row.profile_name);
      }
    }
  });

  test("unmapped contextual roles stay visible as documented gaps", () => {
    const gaps = CONTEXT_ROLE_SEED.filter((r) => r.profile_name === null);
    // Facilitator / team member / learner still have no seeded profile;
    // each gap must carry an explanatory note instead of being hidden.
    expect(gaps.length).toBeGreaterThan(0);
    for (const gap of gaps) expect(String(gap.notes).length).toBeGreaterThan(10);
    expect(gaps.some((g) => g.context === "venture" && g.role_key === "founder")).toBe(false);
  });

  test("the founder gap is filled (Phase 5b) with the scope-aware Founder profile", () => {
    const founder = CONTEXT_ROLE_SEED.find(
      (r) => r.context === "venture" && r.role_key === "founder",
    );
    expect(founder.profile_name).toBe("Founder");
  });

  test("validation helpers reject junk", () => {
    expect(isValidContextRoleContext("crm")).toBe(false);
    expect(isValidContextRoleContext("")).toBe(false);
    expect(isValidContextRoleKey("Program Manager")).toBe(false);
    expect(isValidContextRoleKey("program_manager")).toBe(true);
  });
});

describe("GET /api/engineering/permissions/context-roles", () => {
  test("requires permissions.view_matrix", async () => {
    await route.GET();
    expect(requireAuthorization).toHaveBeenCalledWith("permissions", "view_matrix");
  });

  test("unauthorized → 403", async () => {
    mockAuthzDecision = new Response(JSON.stringify({ success: false }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
    const res = await route.GET();
    expect(res.status).toBe(403);
  });

  test("returns rows with holder counts and the profile list (LEFT JOIN — gaps kept)", async () => {
    const res = await route.GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.contexts).toEqual(CONTEXT_ROLE_CONTEXTS);
    expect(data.roles).toHaveLength(1);
    expect(data.roles[0].holders).toBe(4);
    expect(data.profiles.length).toBeGreaterThan(0);
    const all = executed.map((e) => e.sql).join("\n");
    expect(all).toContain("LEFT JOIN access_profiles");
    expect(all).toContain("ON CONFLICT (context, role_key) DO NOTHING");
  });

  test("a read never invalidates authorization contexts", async () => {
    await route.GET();
    expect(invalidateAllAuthorizationContexts).not.toHaveBeenCalled();
  });
});

describe("PUT /api/engineering/permissions/context-roles", () => {
  test("requires permissions.assign_capabilities", async () => {
    await route.PUT(putReq({ context: "venture", role_key: "founder" }));
    expect(requireAuthorization).toHaveBeenCalledWith("permissions", "assign_capabilities");
  });

  test("rejects an unknown context or invalid role key → 400", async () => {
    const badContext = await route.PUT(
      putReq({ context: "crm", role_key: "founder" }),
    );
    expect(badContext.status).toBe(400);
    const badKey = await route.PUT(
      putReq({ context: "venture", role_key: "Founder!" }),
    );
    expect(badKey.status).toBe(400);
  });

  test("rejects a profile id that does not exist → 400", async () => {
    mockProfileMetaRows = [];
    const res = await route.PUT(
      putReq({ context: "venture", role_key: "founder", profile_id: 999 }),
    );
    expect(res.status).toBe(400);
    expect(executed.some((e) => e.sql.includes("INSERT INTO context_role_profiles"))).toBe(false);
  });

  test("saves the mapping (upsert) and audits it with the optional reason", async () => {
    const res = await route.PUT(
      putReq({
        context: "lms",
        role_key: "learner",
        profile_id: 7,
        is_active: true,
        notes: "learner default",
        reason: "product review 2026-09",
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.mapping.profile_name).toBe("Mentor");

    const upsert = executed.find((e) =>
      e.sql.includes("INSERT INTO context_role_profiles"),
    );
    expect(upsert).toBeTruthy();
    expect(upsert.sql).toContain("ON CONFLICT (context, role_key) DO UPDATE");

    expect(logPermissionAudit).toHaveBeenCalledTimes(1);
    const audit = logPermissionAudit.mock.calls[0][0];
    expect(audit.action).toBe("context_role_profile_updated");
    expect(audit.details).toContain("lms:learner");
    expect(audit.details).toContain("Mentor");
    expect(audit.details).toContain("product review 2026-09");
  });

  test("accepts profile_id null (unmapped stays a first-class state)", async () => {
    const res = await route.PUT(
      putReq({ context: "venture", role_key: "founder", profile_id: null }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.mapping.profile_id).toBeNull();
    const audit = logPermissionAudit.mock.calls[0][0];
    expect(audit.details).toContain("no default");
  });

  test("a write never invalidates authorization contexts in Phase 4 (registry is inert)", async () => {
    await route.PUT(putReq({ context: "venture", role_key: "founder", profile_id: 7 }));
    expect(invalidateAllAuthorizationContexts).not.toHaveBeenCalled();
  });
});

describe("Phase 6 — NULL mapping repair (profile added after the seed)", () => {
  test("fills only NULL mappings and never touches a configured one", async () => {
    const {
      backfillContextRoleProfileMappings,
    } = require("@/models/authorization/contextRoleProfiles");
    executed.length = 0;

    const result = await backfillContextRoleProfileMappings();

    expect(result.success).toBe(true);
    const updates = executed.filter((q) => q.sql.includes("UPDATE context_role_profiles"));
    expect(updates.length).toBeGreaterThan(0);
    // The repair is strictly additive: only rows still NULL are eligible.
    for (const u of updates) expect(u.sql).toContain("profile_id IS NULL");

    const founderUpdate = updates.find((u) => u.args[1] === "venture" && u.args[2] === "founder");
    expect(founderUpdate).toBeTruthy();
    expect(founderUpdate.args[0]).toBe(7); // the profile id resolved by name
    expect(
      result.updated.find((u) => u.context === "venture" && u.role_key === "founder").profile,
    ).toBe("Founder");
  });
});
