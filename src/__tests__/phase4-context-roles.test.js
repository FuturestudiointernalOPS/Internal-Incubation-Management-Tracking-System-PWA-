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

let mockProfileRows = [];

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    execute: jest.fn(async (queryObj) => {
      const sql = typeof queryObj === "string" ? queryObj : queryObj?.sql;
      const args = typeof queryObj === "string" ? [] : queryObj?.args || [];
      executed.push({ sql: String(sql), args });

      // The single-row lookup the PUT path validates against.
      if (String(sql).includes("FROM profiles WHERE key ="))
        return { rows: mockProfileRows };
      // The catalogue list the GET path renders as the dropdown.
      if (String(sql).includes("FROM profiles")) {
        return { rows: [{ key: "mentor", label: "Mentor", is_active: 1 }] };
      }
      if (String(sql).includes("FROM context_role_profiles")) {
        return {
          rows: [
            {
              id: 1,
              context: "venture",
              role_key: "founder",
              profile_key: null,
              is_active: 1,
              notes: "",
              profile_name: null,
            },
          ],
        };
      }
      // The holder counts are now read as ONE statement that labels each count
      // with its "context:role_key" pair (a UNION ALL when there is more than
      // one, so the label — not "UNION ALL" — is what identifies the batch).
      if (String(sql).includes(" AS pair")) {
        return {
          rows: String(sql)
            .split("UNION ALL")
            .map((part) => part.match(/SELECT '([^']+)' AS pair/))
            .filter(Boolean)
            .map((match) => ({ pair: match[1], c: 4 })),
        };
      }
      if (String(sql).includes("COUNT(")) return { rows: [{ c: 4 }] };
      return { rows: [] };
    }),
  },
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/server/auth/session", () => ({
  getSession: jest.fn().mockResolvedValue({ cid: "SA-1", name: "Super Admin" }),
}));
jest.mock("@/models/authorization/accessQueries", () => ({
  logPermissionAudit: jest.fn().mockResolvedValue(true),
}));

let mockAuthzDecision = null;
const mockInvalidateAll = jest.fn();
jest.mock("@/models/authorization/index", () => ({
  requireAuthorization: jest.fn().mockImplementation(async () => mockAuthzDecision),
  invalidateAllAuthorizationContexts: mockInvalidateAll,
}));

const requireAuthorization = require("@/models/authorization/index").requireAuthorization;
const logPermissionAudit = require("@/models/authorization/accessQueries").logPermissionAudit;
const invalidateAllAuthorizationContexts = mockInvalidateAll;
const route = require("@/app/api/engineering/permissions/context-roles/route");
const {
  CONTEXT_ROLE_CONTEXTS,
  CONTEXT_ROLE_SEED,
  isValidContextRoleContext,
  isValidContextRoleKey,
} = require("@/models/authorization/contextRoleProfiles");
const {
  profileKeyForAccessProfileName,
} = require("@/models/authorization/profileTakeoverBackfill");

const putReq = (body) =>
  new Request("http://localhost/api/engineering/permissions/context-roles", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  executed.length = 0;
  mockAuthzDecision = null;
  mockProfileRows = [{ key: "mentor", label: "Mentor" }];
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
    const seen = new Set(CONTEXT_ROLE_SEED.map((row) => `${row.context}:${row.role_key}`));
    expect(seen.size).toBe(CONTEXT_ROLE_SEED.length);
  });

  test("mapped seed profiles resolve to a profile key (no typos)", () => {
    for (const row of CONTEXT_ROLE_SEED) {
      if (row.profile_name !== null) {
        // Every legacy access-profile NAME maps to exactly one profile KEY; an
        // unmapped name would leave the registry row silently unmapped.
        expect(profileKeyForAccessProfileName(row.profile_name)).toBeTruthy();
      }
    }
  });

  test("unmapped contextual roles stay visible as documented gaps", () => {
    const gaps = CONTEXT_ROLE_SEED.filter((row) => row.profile_name === null);
    // Facilitator and learner still have no seeded profile; each gap must carry
    // an explanatory note instead of being hidden.
    expect(gaps.length).toBeGreaterThan(0);
    for (const gap of gaps) expect(String(gap.notes).length).toBeGreaterThan(10);
    expect(gaps.some((gap) => gap.context === "venture" && gap.role_key === "founder")).toBe(false);
  });

  test("the founder gap is filled (Phase 5b) with the scope-aware Founder profile", () => {
    const founder = CONTEXT_ROLE_SEED.find(
      (row) => row.context === "venture" && row.role_key === "founder",
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
    const all = executed.map((entry) => entry.sql).join("\n");
    expect(all).toContain("LEFT JOIN profiles");
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

  test("rejects a profile key that does not exist → 400", async () => {
    mockProfileRows = [];
    const res = await route.PUT(
      putReq({ context: "venture", role_key: "founder", profile_key: "ghost_profile" }),
    );
    expect(res.status).toBe(400);
    expect(executed.some((entry) => entry.sql.includes("INSERT INTO context_role_profiles"))).toBe(false);
  });

  test("saves the mapping (upsert) and audits it with the optional reason", async () => {
    const res = await route.PUT(
      putReq({
        context: "lms",
        role_key: "learner",
        profile_key: "mentor",
        is_active: true,
        notes: "learner default",
        reason: "product review 2026-09",
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.mapping.profile_name).toBe("Mentor");

    const upsert = executed.find((entry) =>
      entry.sql.includes("INSERT INTO context_role_profiles"),
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

  test("accepts profile_key null (unmapped stays a first-class state)", async () => {
    const res = await route.PUT(
      putReq({ context: "venture", role_key: "founder", profile_key: null }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.mapping.profile_key).toBeNull();
    const audit = logPermissionAudit.mock.calls[0][0];
    expect(audit.details).toContain("no default");
  });

  test("a write never invalidates authorization contexts in Phase 4 (registry is inert)", async () => {
    await route.PUT(putReq({ context: "venture", role_key: "founder", profile_key: "mentor" }));
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
    const updates = executed.filter((entry) => entry.sql.includes("UPDATE context_role_profiles"));
    expect(updates.length).toBeGreaterThan(0);
    // The repair is strictly additive: only rows still NULL are eligible.
    for (const update of updates) expect(update.sql).toContain("profile_key IS NULL");

    const founderUpdate = updates.find((update) => update.args[1] === "venture" && update.args[2] === "founder");
    expect(founderUpdate).toBeTruthy();
    expect(founderUpdate.args[0]).toBe("founder"); // the profile key resolved by name
    expect(
      result.updated.find((update) => update.context === "venture" && update.role_key === "founder").profile,
    ).toBe("Founder");
  });
});
