/**
 * PHASE D — eligibility by profile
 * (docs/ROADMAP_ROLES_PROFILES_ACCESS.md).
 *
 * The vocabulary (a third identity kind), the read that folds profile rows into
 * the single eligibility query, the OR decision that lets a rule distinguish
 * "Member" from "Member with the Founder profile", and the template ceiling.
 *
 * Only the database is mocked: the REAL read builds the SQL, so the profile
 * branch it adds is exercised, not stubbed.
 */

const mockState = {
  profileCaps: [],
  eligibility: [],
};

function mockExecute(query) {
  const sql = typeof query === "string" ? query : query.sql || "";
  if (sql.includes("FROM access_profile_capabilities")) {
    return { rows: mockState.profileCaps };
  }
  if (sql.includes("FROM feature_eligibility")) return { rows: mockState.eligibility };
  return { rows: [] };
}

const mockDb = { execute: jest.fn(async (query) => mockExecute(query)) };

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: mockDb,
  initDb: jest.fn(async () => {}),
}));

const {
  IDENTITY_TYPES,
  validateEligibilityChanges,
  assertTemplateCapsEligible,
} = require("@/services/authorization/eligibilityAdmin");
const { evaluateEligibility } = require("@/services/authorization/eligibility");
const { getFeatureEligibilityRows } = require("@/models/authorization/contextReads");

const sqlOf = (call) => {
  const first = call[0];
  return typeof first === "string" ? first : String(first?.sql || "");
};
const argsOf = (call) => (typeof call[0] === "string" ? [] : call[0]?.args || []);

beforeEach(() => {
  mockDb.execute.mockClear();
  mockState.profileCaps = [];
  mockState.eligibility = [];
});

// ── Vocabulary ───────────────────────────────────────────────────────────────

describe("the third identity kind", () => {
  test("IDENTITY_TYPES is role, group and profile", () => {
    expect(IDENTITY_TYPES).toEqual(["role", "group", "profile"]);
  });

  test("accepts a ceiling written against a known profile", () => {
    const result = validateEligibilityChanges([
      { feature_key: "ventures", identity_type: "profile", identity_value: "founder", eligible: 1 },
    ]);
    expect(result.valid).toBe(true);
    expect(result.normalized[0]).toMatchObject({
      identity_type: "profile",
      identity_value: "founder",
      eligible: 1,
    });
  });

  test("refuses an unknown profile", () => {
    const result = validateEligibilityChanges([
      { feature_key: "ventures", identity_type: "profile", identity_value: "ghost", eligible: 1 },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("unknown profile");
  });

  test("still refuses an unknown identity_type", () => {
    const result = validateEligibilityChanges([
      { feature_key: "ventures", identity_type: "wizard", identity_value: "x", eligible: 1 },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("unknown identity_type");
  });
});

// ── Read: profile rows folded into the one query ─────────────────────────────

describe("getFeatureEligibilityRows", () => {
  test("with no profiles, the role+group SQL is unchanged", async () => {
    await getFeatureEligibilityRows("member", ["G1"]);
    const sql = sqlOf(mockDb.execute.mock.calls[0]);
    expect(sql).toMatch(/identity_type = 'role'/);
    expect(sql).toMatch(/identity_type = 'group'/);
    expect(sql).not.toMatch(/identity_type = 'profile'/);
  });

  test("with profiles, it adds the profile branch and the profile args", async () => {
    await getFeatureEligibilityRows("member", ["G1"], ["founder", "facilitator"]);
    const call = mockDb.execute.mock.calls[0];
    expect(sqlOf(call)).toMatch(/identity_type = 'profile' AND identity_value IN \(\?,\?\)/);
    expect(argsOf(call)).toEqual(["member", "G1", "founder", "facilitator"]);
  });
});

// ── Decision: OR semantics, deny still wins ──────────────────────────────────

describe("evaluateEligibility with profile rows", () => {
  test("a plain member is refused a feature only the Founder profile opens", () => {
    expect(evaluateEligibility([], "ventures")).toBe(false);
  });

  test("holding the profile makes the same person eligible (the distinction)", () => {
    const rows = [
      { feature_key: "ventures", identity_type: "profile", identity_value: "founder", eligible: 1 },
    ];
    expect(evaluateEligibility(rows, "ventures")).toBe(true);
  });

  test("an explicit deny on the profile still wins over a role allow", () => {
    const rows = [
      { feature_key: "ventures", identity_type: "role", identity_value: "member", eligible: 1 },
      { feature_key: "ventures", identity_type: "profile", identity_value: "founder", eligible: 0 },
    ];
    expect(evaluateEligibility(rows, "ventures")).toBe(false);
  });
});

// ── Ceiling: a template must stay within the profile boundary ─────────────────

describe("assertTemplateCapsEligible with active profiles", () => {
  async function run({ profiles }) {
    mockState.profileCaps = [{ module: "ventures", capability: "view", access_level: 1 }];
    // The eligibility read returns the profile row only when the caller passed
    // the profile — i.e. only when the person actually holds it.
    mockState.eligibility = profiles.includes("founder")
      ? [{ feature_key: "ventures", identity_type: "profile", identity_value: "founder", eligible: 1 }]
      : [];
    return assertTemplateCapsEligible({ role: "member", groups: [], profiles, profileId: 7 });
  }

  test("a member WITHOUT the profile cannot receive a Founder-only area", async () => {
    const result = await run({ profiles: [] });
    expect(result.valid).toBe(false);
    expect(result.violations[0]).toMatchObject({ module: "ventures", feature: "ventures" });
  });

  test("the same member WITH the Founder profile can", async () => {
    const result = await run({ profiles: ["founder"] });
    expect(result.valid).toBe(true);
  });
});
