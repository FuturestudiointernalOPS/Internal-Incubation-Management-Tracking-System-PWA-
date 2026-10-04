/**
 * Authorization Foundation (Phase 0) — eligibility policy and the
 * server → client restriction wire format.
 *
 * Pure logic only — the DB layer is mocked, no database access.
 *
 * Siblings: authorization-resolver.lms.test.js (module gating),
 * authorization-resolver.migrations.test.js (one-time migrations),
 * authorization-eligibility-api.test.js (the eligibility API).
 *
 * Mocks and context factories come from ./helpers/authorizationMocks.
 */

const mockAuthz = require("./helpers/authorizationMocks");

jest.mock("@/lib/db", () => mockAuthz.db);
jest.mock("@/server/authz/capabilities", () => {
  const auth = mockAuthz.auth;
  return { PERMISSION_MODULES: auth.PERMISSION_MODULES, ACCESS_LEVELS: auth.ACCESS_LEVELS };
});
jest.mock("@/server/auth/session", () => ({ getSession: mockAuthz.auth.getSession }));
jest.mock("@/models/authorization/bootstrap", () => ({ ensurePermissionsSchema: mockAuthz.auth.ensurePermissionsSchema }));
jest.mock("next/server", () => mockAuthz.nextServer);

const { authorize } = require("@/services/authorization/context");
const { requireAuthorization } = require("@/models/authorization/index");
const { saCtx, staffCtx } = require("./helpers/authorizationMocks");

describe("requireAuthorization", () => {
  test("returns 401 without a session", async () => {
    const res = await requireAuthorization("finance", "view");
    expect(res.status).toBe(401);
  });
});


// ─── Final eligibility policy (#3) — admin / participant / founder values ───
// Product Owner-approved final eligibility values:
//   - admin           → NOT eligible for internal_comms or reporting
//   - participant     → NOT eligible for crm
//   - founder         → NOT eligible for crm
// Verified against the production database by the read-only dry-run
// (scripts/dryrun-eligibility-policy.mjs): zero decision changes for every
// existing user (no admin-role users exist; participants/founders hold no
// contacts capabilities). These tests lock in the resolver behavior that the
// backfill (ensureFinalPolicyBackfill) and the updated seeds enforce.

describe("final eligibility policy (#3)", () => {
  test("admin is NOT eligible for communication (internal_comms legacy) or reports", () => {
    const {
  FEATURE_ELIGIBILITY_DEFAULTS,
} = require("@/models/authorization/eligibility");
    expect(FEATURE_ELIGIBILITY_DEFAULTS.communication).not.toContain("admin");
    expect(FEATURE_ELIGIBILITY_DEFAULTS.reports).not.toContain("admin");
  });

  test("participant and founder are NOT crm-eligible", () => {
    const {
  FEATURE_ELIGIBILITY_DEFAULTS,
} = require("@/models/authorization/eligibility");
    expect(FEATURE_ELIGIBILITY_DEFAULTS.crm).not.toContain("participant");
    expect(FEATURE_ELIGIBILITY_DEFAULTS.crm).not.toContain("founder");
  });

  test("admin with announcement caps is DENIED post-policy", () => {
    const admin = staffCtx({
      role: "admin",
      isSuperAdmin: false,
      eligibility: { communication: false, reports: false },
      effective: { internal_comms: { view: 1, create_announcements: 2, moderate: 3 } },
    });
    expect(authorize(admin, "internal_comms", "create_announcements")).toBe(false);
    expect(authorize(admin, "internal_comms", "moderate")).toBe(false);
    expect(authorize(admin, "internal_comms", "view")).toBe(false);
  });

  test("admin with reports caps is DENIED post-policy (submit + export routes)", () => {
    const admin = staffCtx({
      role: "admin",
      isSuperAdmin: false,
      eligibility: { communication: false, reports: false },
      effective: { reports: { view: 1, create: 2, export: 3 } },
    });
    expect(authorize(admin, "reports", "create")).toBe(false);
    expect(authorize(admin, "reports", "export")).toBe(false);
  });

  test("participant with a contacts grant is DENIED post-policy (eligibility boundary)", () => {
    const participant = staffCtx({
      role: "participant",
      isSuperAdmin: false,
      eligibility: { crm: false },
      effective: { contacts: { view: 5 } },
      grants: { contacts: { view: 5 } },
    });
    expect(authorize(participant, "contacts", "view")).toBe(false);
  });

  test("super_admin is unaffected by the policy (bypass preserved)", () => {
    expect(authorize(saCtx(), "internal_comms", "create_announcements")).toBe(true);
    expect(authorize(saCtx(), "reports", "export")).toBe(true);
    expect(authorize(saCtx(), "contacts", "view")).toBe(true);
  });

  test("ensureFinalPolicyBackfill deletes ONLY the retired role rows (group rows sacred)", async () => {
    const dbMock = require("@/lib/db").default;
    const { ensureFinalPolicyBackfill } = require("@/models/authorization/backfill");
    dbMock.execute.mockClear();
    await ensureFinalPolicyBackfill();
    const deletes = dbMock.execute.mock.calls
      .map((call) => (typeof call[0] === "string" ? call[0] : call[0]?.sql))
      .filter((sql) => sql && sql.includes("DELETE FROM feature_eligibility"));
    expect(deletes.length).toBeGreaterThan(0);
    const allSql = deletes.join("\n");
    for (const sql of deletes) {
      expect(sql).toMatch(/identity_type\s*=\s*'role'/);
    }
    expect(allSql).toMatch(/feature_key\s*=\s*'crm'/);
    expect(allSql).toMatch(/identity_value\s*IN\s*\(\s*'participant',\s*'founder'\s*\)/);
  });
});


describe("org_membership capability (Phase 1 — protected groups)", () => {
  test("is part of the module set; SA bypasses", () => {
    const { PERMISSION_MODULES } = require("@/server/authz/capabilities");
    expect(PERMISSION_MODULES.org_membership.capabilities).toEqual([
      "view",
      "manage",
    ]);
    expect(authorize(saCtx(), "org_membership", "manage")).toBe(true);
    expect(authorize(saCtx(), "org_membership", "view")).toBe(true);
  });

  test("holders may manage membership; assign_capabilities does NOT imply it", () => {
    const manager = staffCtx({
      role: "staff",
      eligibility: {},
      effective: { org_membership: { view: 1, manage: 2 } },
    });
    const capAssigner = staffCtx({
      role: "staff",
      eligibility: {},
      effective: { permissions: { assign_capabilities: 2 } }, // different power
    });
    expect(authorize(manager, "org_membership", "manage")).toBe(true);
    expect(authorize(manager, "org_membership", "view")).toBe(true);
    expect(authorize(capAssigner, "org_membership", "manage")).toBe(false);
    expect(authorize(capAssigner, "org_membership", "view")).toBe(false);
  });
});


/**
 * Restrictions must survive the server → client wire: the People matrix reads
 * `sources.restrictions` from the user-context JSON, and a raw Set serializes
 * to `{}` (which silently turned every restriction into "allowed").
 */
describe("restrictionsToJson (server → client wire format)", () => {
  const { restrictionsToJson } = require("@/services/authorization/context");
  const { deriveUserCapState } = require("@/components/permissions/matrixHelpers");

  test("projects Set-based restrictions into the JSON object shape", () => {
    expect(
      restrictionsToJson({ finance: new Set(["view", "create"]) }),
    ).toEqual({ finance: { view: true, create: true } });
  });

  test("a restriction survives JSON.stringify → JSON.parse (the wire)", () => {
    const wire = JSON.parse(
      JSON.stringify(restrictionsToJson({ finance: new Set(["view"]) })),
    );
    expect(wire).toEqual({ finance: { view: true } });
  });

  test("empty and null maps project to {}", () => {
    expect(restrictionsToJson({})).toEqual({});
    expect(restrictionsToJson(null)).toEqual({});
  });

  test("the People helper reads the projected restriction (DENIED, not allowed)", () => {
    const state = deriveUserCapState(
      {
        profile: { finance: { view: 1 } },
        groups: {},
        grants: {},
        restrictions: JSON.parse(
          JSON.stringify(restrictionsToJson({ finance: new Set(["view"]) })),
        ),
      },
      "finance",
      "view",
    );
    expect(state.restricted).toBe(true);
    expect(state.effective).toBe(false);
  });
});

