/**
 * PHASE H — global-role cleanup + strict blocking
 * (docs/ROADMAP_ROLES_PROFILES_ACCESS.md).
 *
 * Four surfaces:
 *   1. the PURE classification/report/target rules — no database, no HTTP;
 *   2. the SURVEY and the ALIGNMENT driven through the REAL service over a
 *      mocked database, so the statements the operation runs are exercised;
 *   3. the STORE's guarded statement shape;
 *   4. the API contract (GET report, POST align, both gated + audited).
 *
 * The Phase B suite already pins the ENFORCEMENT flip (`PROFILE_ROLE_ENFORCEMENT`
 * is "block") and the reconcile's refusal; this suite covers the DATA half —
 * the "relevé" and the alignment that let the flip land without anyone losing
 * access.
 */

const mockExecute = jest.fn();

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: (...args) => mockExecute(...args) },
  initDb: jest.fn(async () => {}),
}));

jest.mock("@/server/auth/session", () => ({
  getSession: jest.fn(async () => ({ cid: "U-ADMIN", name: "Admin" })),
}));

jest.mock("@/models/authorization/accessQueries", () => ({
  logPermissionAudit: jest.fn(async () => {}),
}));

jest.mock("@/lib/requestOrigin", () => ({
  requireSameOrigin: jest.fn(() => null),
}));

jest.mock("@/models/authorization/index", () => ({
  requireAuthorization: jest.fn(async () => null),
}));

const {
  DEFAULT_BASELINE_ROLE,
  classifyRoleValue,
  isLegacyRoleValue,
  targetBaselineForRole,
  buildLegacyRoleReport,
  surveyLegacyRoles,
  alignLegacyRoles,
} = require("@/services/authorization/legacyRoleCleanup");

const sqlOf = (call) => {
  const first = call[0];
  return typeof first === "string" ? first : String(first?.sql || "");
};
const callsMatching = (pattern) =>
  mockExecute.mock.calls.filter((call) => pattern.test(sqlOf(call)));

beforeEach(() => {
  mockExecute.mockReset();
  mockExecute.mockResolvedValue({ rows: [], rowsAffected: 1 });
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ── 1. Pure rules ────────────────────────────────────────────────────────────

describe("classifyRoleValue", () => {
  test("the three baseline identities are baseline", () => {
    expect(classifyRoleValue("member")).toBe("baseline");
    expect(classifyRoleValue("staff")).toBe("baseline");
    expect(classifyRoleValue("super_admin")).toBe("baseline");
  });

  test("a catalogue profile is a profile value", () => {
    expect(classifyRoleValue("founder")).toBe("profile");
    expect(classifyRoleValue("program_manager")).toBe("profile");
  });

  test("anything else is retired, and an empty value is its own defect", () => {
    expect(classifyRoleValue("mentor")).toBe("retired");
    expect(classifyRoleValue("team")).toBe("retired");
    expect(classifyRoleValue("")).toBe("empty");
    expect(classifyRoleValue(null)).toBe("empty");
  });

  test("isLegacyRoleValue is exactly 'not baseline and not empty'", () => {
    expect(isLegacyRoleValue("member")).toBe(false);
    expect(isLegacyRoleValue("")).toBe(false);
    expect(isLegacyRoleValue("founder")).toBe(true);
    expect(isLegacyRoleValue("mentor")).toBe(true);
  });
});

describe("targetBaselineForRole — the alignment preserves the profile fit", () => {
  test("a staff-only profile aligns onto staff", () => {
    expect(targetBaselineForRole("program_manager")).toBe("staff");
    expect(targetBaselineForRole("venture_manager")).toBe("staff");
  });

  test("member-open profiles and retired labels align onto member", () => {
    expect(targetBaselineForRole("founder")).toBe("member");
    expect(targetBaselineForRole("participant")).toBe("member");
    expect(targetBaselineForRole("facilitator")).toBe("member");
    expect(targetBaselineForRole("mentor")).toBe("member");
    expect(DEFAULT_BASELINE_ROLE).toBe("member");
  });
});

describe("buildLegacyRoleReport", () => {
  test("splits baseline from legacy, totals both, and is unsafe while a legacy value remains", () => {
    const report = buildLegacyRoleReport([
      { role: "member", count: 10 },
      { role: "staff", count: 2 },
      { role: "super_admin", count: 1 },
      { role: "founder", count: 3 },
      { role: "mentor", count: 1 },
    ]);

    expect(report.baseline.map((entry) => entry.role)).toEqual([
      "member",
      "staff",
      "super_admin",
    ]);
    expect(report.legacy.map((entry) => entry.role)).toEqual(["founder", "mentor"]);
    expect(report.legacy.find((entry) => entry.role === "founder").target).toBe("member");
    expect(report.totalContacts).toBe(17);
    expect(report.totalLegacy).toBe(4);
    expect(report.safe).toBe(false);
  });

  test("safe is true only when no account carries a legacy value", () => {
    const report = buildLegacyRoleReport([
      { role: "member", count: 10 },
      { role: "staff", count: 2 },
    ]);
    expect(report.legacy).toEqual([]);
    expect(report.totalLegacy).toBe(0);
    expect(report.safe).toBe(true);
  });
});

// ── 2. Survey + alignment over a mocked database ─────────────────────────────

const ROLE_COUNTS = [
  { role: "member", count: 10 },
  { role: "staff", count: 2 },
  { role: "founder", count: 3 },
  { role: "program_manager", count: 1 },
  { role: "mentor", count: 2 },
];

function mockSurvey() {
  mockExecute.mockImplementation(async (arg) => {
    const sql = typeof arg === "string" ? arg : String(arg?.sql || "");
    if (/SELECT role, COUNT\(\*\)::int AS count/i.test(sql)) {
      return { rows: ROLE_COUNTS };
    }
    if (/SELECT cid, name, role, status/i.test(sql)) {
      const role = arg?.args?.[0];
      return {
        rows: [{ cid: `C-${role}`, name: "Someone", role, status: "active" }],
      };
    }
    if (/UPDATE contacts SET role = \? WHERE role = \?/i.test(sql)) {
      const fromRole = arg?.args?.[1];
      const count = ROLE_COUNTS.find((row) => row.role === fromRole)?.count || 0;
      return { rows: [], rowsAffected: count };
    }
    return { rows: [], rowsAffected: 0 };
  });
}

describe("surveyLegacyRoles", () => {
  test("returns the report plus the accounts behind each legacy value", async () => {
    mockSurvey();
    const survey = await surveyLegacyRoles();

    expect(survey.safe).toBe(false);
    expect(survey.legacy.map((entry) => entry.role)).toEqual([
      "founder",
      "program_manager",
      "mentor",
    ]);
    expect(survey.accounts.founder).toHaveLength(1);
    expect(survey.accounts.founder[0].cid).toBe("C-founder");
  });
});

describe("alignLegacyRoles", () => {
  test("aligns every legacy value onto its target with a guarded UPDATE", async () => {
    mockSurvey();
    const result = await alignLegacyRoles();

    expect(result.success).toBe(true);
    // A staff-only profile goes to staff; everything else to member.
    expect(result.aligned).toEqual([
      { role: "founder", kind: "profile", to_role: "member", aligned: 3 },
      { role: "program_manager", kind: "profile", to_role: "staff", aligned: 1 },
      { role: "mentor", kind: "retired", to_role: "member", aligned: 2 },
    ]);

    const updates = callsMatching(/UPDATE contacts SET role = \? WHERE role = \?/i);
    expect(updates).toHaveLength(3);
    // Never a DELETE, and the guard names the exact legacy value.
    expect(callsMatching(/DELETE FROM contacts/i)).toHaveLength(0);
    expect(updates.every((call) => /WHERE role = \?/i.test(sqlOf(call)))).toBe(true);
  });

  test("a single requested value aligns only that value and reports the rest as skipped", async () => {
    mockSurvey();
    const result = await alignLegacyRoles({ roleValue: "program_manager" });

    expect(result.aligned).toEqual([
      { role: "program_manager", kind: "profile", to_role: "staff", aligned: 1 },
    ]);
    expect(result.skipped.map((entry) => entry.role)).toEqual(["founder", "mentor"]);
    expect(callsMatching(/UPDATE contacts SET role/i)).toHaveLength(1);
  });

  test("refuses a value that is not legacy, and writes nothing", async () => {
    mockSurvey();
    const result = await alignLegacyRoles({ roleValue: "member" });

    expect(result.success).toBe(false);
    expect(result.error).toBe("not a legacy role value");
    expect(callsMatching(/UPDATE contacts SET role/i)).toHaveLength(0);
  });
});

// ── 3. Store statement shape ─────────────────────────────────────────────────

describe("legacy role cleanup store", () => {
  test("the alignment statement is guarded by the exact legacy value", async () => {
    const { alignContactsFromRoleToBaseline } = require(
      "@/models/authorization/legacyRoleCleanupStore",
    );
    await alignContactsFromRoleToBaseline({ fromRole: "founder", toRole: "member" });
    const update = callsMatching(/UPDATE contacts/i)[0];
    expect(sqlOf(update)).toMatch(/UPDATE contacts SET role = \? WHERE role = \?/i);
    expect(update[0].args).toEqual(["member", "founder"]);
  });
});

// ── 4. Route contract ────────────────────────────────────────────────────────

// ── 5. Vocabulary — profiles are not roles ───────────────────────────────────

describe("eligibility vocabulary — profiles live in their catalogue", () => {
  const {
    FEATURE_ELIGIBILITY_DEFAULTS,
    FEATURE_ELIGIBILITY_PROFILE_DEFAULTS,
  } = require("@/models/authorization/eligibility");
  const { PROFILE_KEYS } = require("@/models/authorization/profile-catalog");

  test("no catalogue profile remains in the ROLE eligibility defaults", () => {
    for (const roles of Object.values(FEATURE_ELIGIBILITY_DEFAULTS)) {
      for (const role of roles) expect(PROFILE_KEYS).not.toContain(role);
    }
  });

  test("every PROFILE default is a catalogue profile", () => {
    for (const profiles of Object.values(FEATURE_ELIGIBILITY_PROFILE_DEFAULTS)) {
      for (const profile of profiles) expect(PROFILE_KEYS).toContain(profile);
    }
  });

  test("the profile ceiling mirrors coverage the role list used to carry", () => {
    expect(FEATURE_ELIGIBILITY_PROFILE_DEFAULTS.lms).toContain("program_manager");
    expect(FEATURE_ELIGIBILITY_PROFILE_DEFAULTS.investors).toContain("investor");
    expect(FEATURE_ELIGIBILITY_PROFILE_DEFAULTS.ventures).toContain("founder");
    expect(FEATURE_ELIGIBILITY_PROFILE_DEFAULTS.programs).toContain("facilitator");
    expect(FEATURE_ELIGIBILITY_PROFILE_DEFAULTS.operations).toContain("participant");
  });
});

describe("GET/POST /api/engineering/permissions/legacy-role-cleanup", () => {
  const loadRoute = () => {
    jest.resetModules();
    return require("@/app/api/engineering/permissions/legacy-role-cleanup/route");
  };

  test("GET is gated on permissions.view_matrix and returns the relevé", async () => {
    const route = loadRoute();
    const { requireAuthorization } = require("@/models/authorization/index");
    mockSurvey();

    const res = await route.GET({});
    const body = await res.json();

    expect(requireAuthorization).toHaveBeenCalledWith("permissions", "view_matrix");
    expect(body.success).toBe(true);
    expect(body.safe).toBe(false);
    expect(body.legacy.map((entry) => entry.role)).toContain("founder");
    expect(body.accounts.founder[0].cid).toBe("C-founder");
  });

  test("POST is gated on permissions.configure_eligibility, aligns and audits", async () => {
    const route = loadRoute();
    const { requireAuthorization } = require("@/models/authorization/index");
    const { logPermissionAudit } = require("@/models/authorization/accessQueries");
    mockSurvey();

    const res = await route.POST({ json: async () => ({ role: "program_manager" }) });
    const body = await res.json();

    expect(requireAuthorization).toHaveBeenCalledWith("permissions", "configure_eligibility");
    expect(body.success).toBe(true);
    expect(body.aligned_total).toBe(1);
    expect(logPermissionAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "legacy_roles_aligned" }),
    );
  });

  test("POST refuses a non-legacy value with a 400", async () => {
    const route = loadRoute();
    mockSurvey();

    const res = await route.POST({ json: async () => ({ role: "member" }) });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
  });
});
