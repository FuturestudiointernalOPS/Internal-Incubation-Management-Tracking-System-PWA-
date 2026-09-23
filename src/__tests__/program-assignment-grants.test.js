/**
 * ASSIGNMENT-DERIVED PROGRAM ACCESS — regression contract.
 *
 * A program facilitator and a program manager hold their access because of the
 * assignment they have on a PARTICULAR program, and only while that program
 * runs. This suite locks the four properties that make that true:
 *
 *   1. CONSISTENCY — the grant is DERIVED from the assignment. A facilitator's
 *      grant is the union of the per-program tick levels (a capability ticked
 *      off in every program disappears; one ticked in a single program survives,
 *      because the per-program gate decides WHERE it applies).
 *   2. DURATION — the grant carries the latest program end date as its expiry,
 *      and an ended program justifies nothing at all.
 *   3. NON-REGRESSION — an entry the tick list never carried resolves to
 *      "granted", which is what today's behaviour amounts to. Reading it as
 *      denied would strip access from every facilitator already in production.
 *   4. REMOVABILITY — an administrator's explicit block removes the capability
 *      even though the relationship keeps re-applying it, because blocks are
 *      applied AFTER the merge.
 */

let mockState = {};

const PROGRAM_ACTIVE = "P-ACTIVE";
const PROGRAM_OPEN_ENDED = "P-OPEN";

const ALL_FACILITATOR_KEYS = require("@/lib/facilitator-permissions").FACILITATOR_CAPABILITY_KEYS;

function resetState() {
  mockState = {
    assignments: [],
    managedProgramIds: [],
    programDefaults: {}, // program_id → object
    profileCaps: [], // rows for access_profile_capabilities
    registry: null, // context_role_profiles row
    userCaps: [],
    applied: [],
    profileCapsQueriedFor: [],
  };
}

async function mockExecute(query) {
  const sqlText = typeof query === "string" ? query : query.sql || "";
  const args = typeof query === "string" ? [] : query.args || [];

  // Schema self-healing
  if (/^\s*(CREATE TABLE|CREATE INDEX)/i.test(sqlText)) return { rows: [] };

  // Registry mapping (program manager)
  if (sqlText.includes("FROM context_role_profiles")) {
    return { rows: mockState.registry ? [mockState.registry] : [] };
  }

  // Program defaults batch
  if (sqlText.includes("facilitator_default_permissions AS def")) {
    return {
      rows: args.map((id) => ({
        id,
        def: mockState.programDefaults[String(id)] ?? null,
      })),
    };
  }

  // Assignment rows (staff join)
  if (sqlText.includes("FROM v2_program_staff")) {
    return { rows: mockState.assignments };
  }

  // Named manager lookup
  if (sqlText.includes("assigned_pm_id AS TEXT) = ?")) {
    return {
      rows: mockState.managedProgramIds.map((id) => ({
        program_id: id,
        role_key: "program_manager",
        permissions: null,
        access_profile_id: null,
        end_date: null,
        status: "Active",
        is_archived: 0,
      })),
    };
  }

  // Profile capabilities (registry path + assignment profile path)
  if (sqlText.includes("FROM access_profile_capabilities")) {
    mockState.profileCapsQueriedFor.push(args);
    return { rows: mockState.profileCaps };
  }

  if (sqlText.includes("SELECT module, capability, access_level, granted_by, expires_at FROM user_capabilities")) {
    return { rows: mockState.userCaps.filter((row) => row.user_cid === String(args[0])) };
  }

  if (sqlText.includes("FROM context_applied_grants") && sqlText.includes("SELECT")) {
    const [cid, context, roleKey] = args;
    return {
      rows: mockState.applied.filter(
        (row) =>
          row.user_cid === cid && row.context === context && row.role_key === roleKey,
      ),
    };
  }

  if (sqlText.includes("INSERT INTO user_capabilities")) {
    const [user_cid, module, capability, access_level, granted_by, expires_at] = args;
    mockState.userCaps = mockState.userCaps.filter(
      (row) => !(row.user_cid === user_cid && row.module === module && row.capability === capability),
    );
    mockState.userCaps.push({
      user_cid,
      module,
      capability,
      access_level,
      granted_by,
      expires_at,
    });
    return { rows: [] };
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
    mockState.applied.push({
      user_cid,
      context,
      role_key,
      source_ref,
      module,
      capability,
      access_level,
    });
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

  if (sqlText.includes("DELETE FROM context_applied_grants")) {
    if (args.length === 2) {
      const [user_cid, context, role_key] = args;
      mockState.applied = mockState.applied.filter(
        (row) =>
          !(row.user_cid === user_cid && row.context === context && row.role_key === role_key),
      );
      return { rows: [] };
    }
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

  return { rows: [] };
}

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async (query) => mockExecute(query)) },
  initDb: jest.fn(async () => true),
}));

jest.mock("@/models/authorization/resolver", () => ({
  invalidateAuthorizationContext: jest.fn(),
}));

const {
  isProgramEnded,
  isMissingColumnError,
  listActiveProgramAssignments,
  resetAssignmentProfileColumnCache,
  deriveAssignmentsExpiry,
  deriveFacilitatorDesiredCaps,
  resolveAssignmentCapabilityLevel,
  UNCONFIGURED_LEVEL,
} = require("@/models/authorization/programAssignments");
const {
  planContextGrantChanges,
  syncContextGrantsForUser,
  contextGrantSentinel,
} = require("@/models/authorization/contextGrants");
const { mergeEffectiveCapabilities } = jest.requireActual(
  "@/models/authorization/resolver",
);

const CID = "USR_FACILITATOR_1";

/** Far-future so "active" means active regardless of the real clock. */
const OPEN_END = "2099-06-30";
const OPEN_END_ID = PROGRAM_ACTIVE;

const FACILITATOR_SENTINEL = contextGrantSentinel("program", "facilitator");

function assignment(programId, permissions, extra = {}) {
  return {
    program_id: programId,
    role_key: "facilitator",
    permissions: permissions ? JSON.stringify(permissions) : null,
    access_profile_id: null,
    ...extra,
  };
}

function ours(module, capability) {
  return mockState.userCaps.filter(
    (row) =>
      row.user_cid === CID &&
      row.module === module &&
      row.capability === capability &&
      row.granted_by === FACILITATOR_SENTINEL,
  );
}

beforeEach(() => resetState());

describe("isProgramEnded — when does program access stop", () => {
  test("an archived program has ended", () => {
    expect(isProgramEnded({ is_archived: 1, status: "Active" })).toBe(true);
  });

  test("a completed / archived status has ended (case-insensitive)", () => {
    expect(isProgramEnded({ status: "Completed" })).toBe(true);
    expect(isProgramEnded({ status: "archived" })).toBe(true);
  });

  test("a past end date has ended", () => {
    expect(isProgramEnded({ status: "Active", end_date: "2020-01-01" })).toBe(true);
  });

  test("a running program with no end date has NOT ended", () => {
    expect(isProgramEnded({ status: "Active", end_date: null })).toBe(false);
    expect(isProgramEnded({ status: "Planned" })).toBe(false);
  });

  test("an unknown schedule does not end a program (fail-safe direction)", () => {
    expect(isProgramEnded({})).toBe(false);
  });
});

describe("deriveAssignmentsExpiry — access ends with the program", () => {
  test("uses the LATEST end date across assignments", () => {
    expect(
      deriveAssignmentsExpiry([
        { end_date: "2026-03-31" },
        { end_date: "2026-06-30" },
      ]),
    ).toBe("2026-06-30");
  });

  test("no expiry when any assignment has no end date (cannot bound what has no date)", () => {
    expect(
      deriveAssignmentsExpiry([{ end_date: "2026-06-30" }, { end_date: null }]),
    ).toBe(null);
  });
});

describe("resolveAssignmentCapabilityLevel — consistency with the assignment", () => {
  test("the per-assignment tick list wins", () => {
    expect(
      resolveAssignmentCapabilityLevel(
        assignment(PROGRAM_ACTIVE, { "attendance.record": 3 }),
        "attendance.record",
        {},
      ),
    ).toBe(3);
  });

  test("an explicit 0 is a deliberate removal", () => {
    expect(
      resolveAssignmentCapabilityLevel(
        assignment(PROGRAM_ACTIVE, { "attendance.record": 0 }),
        "attendance.record",
        {},
      ),
    ).toBe(0);
  });

  test("falls back to the assignment's profile, then the program default", () => {
    expect(
      resolveAssignmentCapabilityLevel(assignment(PROGRAM_ACTIVE, null), "sessions.record", {
        profileCaps: [{ module: "facilitator", capability: "sessions.record", access_level: 2 }],
      }),
    ).toBe(2);
    expect(
      resolveAssignmentCapabilityLevel(assignment(PROGRAM_ACTIVE, null), "sessions.record", {
        programDefault: { "sessions.record": 1 },
      }),
    ).toBe(1);
  });

  test("an entry nobody ever configured resolves to GRANTED (today's behaviour)", () => {
    // Reading it as denied would strip access from every facilitator already in
    // production the moment enforcement starts reading the tick list.
    expect(
      resolveAssignmentCapabilityLevel(assignment(PROGRAM_ACTIVE, {}), "groups.view", {}),
    ).toBe(UNCONFIGURED_LEVEL);
    expect(UNCONFIGURED_LEVEL).toBeGreaterThanOrEqual(1);
  });
});

describe("deriveFacilitatorDesiredCaps — the union of what the assignments grant", () => {
  test("a capability ticked in ANY program is granted, at the strongest level", () => {
    const { desired, programs } = deriveFacilitatorDesiredCaps([
      assignment(PROGRAM_ACTIVE, { "attendance.record": 2 }),
      assignment(PROGRAM_OPEN_ENDED, { "attendance.record": 0, "assignments.grade": 3 }),
    ]);
    expect(desired["facilitator.attendance.record"].level).toBe(2);
    expect(desired["facilitator.assignments.grade"].level).toBe(3);
    expect(programs.sort()).toEqual([PROGRAM_ACTIVE, PROGRAM_OPEN_ENDED].sort());
  });

  test("a capability ticked off in EVERY program is not granted", () => {
    const { desired } = deriveFacilitatorDesiredCaps([
      assignment(PROGRAM_ACTIVE, { "groups.manage": 0 }),
      assignment(PROGRAM_OPEN_ENDED, { "groups.manage": 0 }),
    ]);
    expect(desired["facilitator.groups.manage"]).toBeUndefined();
  });

  test("no assignments justify nothing at all", () => {
    expect(deriveFacilitatorDesiredCaps([]).desired).toEqual({});
  });
});

describe("syncContextGrantsForUser — program facilitator", () => {
  test("applies the tick-list capabilities, stamped and idempotent", async () => {
    mockState.assignments = [
      assignment(PROGRAM_ACTIVE, { "attendance.record": 2 }, { end_date: OPEN_END }),
    ];

    const first = await syncContextGrantsForUser(CID, {
      context: "program",
      roleKey: "facilitator",
    });

    expect(first.success).toBe(true);
    expect(first.programs).toEqual([PROGRAM_ACTIVE]);
    expect(first.expiresAt).toBe(OPEN_END);
    expect(first.applied).toContain("facilitator.attendance.record");
    expect(ours("facilitator", "attendance.record")).toHaveLength(1);
    // The expiry is what ends the access even if no sweep ever runs.
    expect(ours("facilitator", "attendance.record")[0].expires_at).toBe(OPEN_END);

    const second = await syncContextGrantsForUser(CID, {
      context: "program",
      roleKey: "facilitator",
    });
    expect(second.applied).toEqual([]);
    expect(second.revoked).toEqual([]);
  });

  test("an ENDED program justifies nothing and its grants are withdrawn", async () => {
    mockState.assignments = [
      assignment(PROGRAM_ACTIVE, { "attendance.record": 2 }, { end_date: OPEN_END }),
    ];
    await syncContextGrantsForUser(CID, { context: "program", roleKey: "facilitator" });
    expect(ours("facilitator", "attendance.record")).toHaveLength(1);

    // The assignment is still stored, but the program has ended.
    mockState.assignments = [
      assignment(PROGRAM_ACTIVE, { "attendance.record": 2 }, {
        end_date: OPEN_END,
        is_archived: 1,
      }),
    ];
    const result = await syncContextGrantsForUser(CID, {
      context: "program",
      roleKey: "facilitator",
    });

    expect(result.reason).toBe("no active relationship");
    expect(result.revoked).toContain("facilitator.attendance.record");
    expect(ours("facilitator", "attendance.record")).toHaveLength(0);
  });

  test("the named manager of a program is treated as a program manager", async () => {
    mockState.managedProgramIds = [PROGRAM_ACTIVE];
    mockState.registry = {
      profile_id: 11,
      profile_name: "Assigned Program Manager",
      is_active: 1,
    };
    mockState.profileCaps = [
      { module: "programs", capability: "view", access_level: 1 },
      { module: "programs", capability: "edit", access_level: 3 },
    ];

    const result = await syncContextGrantsForUser(CID, {
      context: "program",
      roleKey: "program_manager",
    });

    expect(result.profile).toBe("Assigned Program Manager");
    expect(result.applied.sort()).toEqual(["programs.edit", "programs.view"]);
    const sentinel = contextGrantSentinel("program", "program_manager");
    const rows = mockState.userCaps.filter((row) => row.granted_by === sentinel);
    expect(rows.map((row) => row.module).every((module) => module === "programs")).toBe(true);
  });

  test("an unsupported context is refused instead of silently revoking everything", async () => {
    const result = await syncContextGrantsForUser(CID, {
      context: "team",
      roleKey: "member",
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe("unsupported context role");
  });
});

describe("removability — a block beats the assignment-derived grant", () => {
  test("an explicit block removes the capability the relationship keeps granting", () => {
    // What the reconcile writes (max-merged with profile/group/grants):
    const baseCaps = {};
    const groupCaps = {};
    const grants = { facilitator: { "attendance.record": 2, "groups.view": 1 } };
    // What an administrator set from the People screen:
    const restrictions = { facilitator: new Set(["attendance.record"]) };

    const effective = mergeEffectiveCapabilities(baseCaps, groupCaps, grants, restrictions);

    expect(effective.facilitator["attendance.record"]).toBeUndefined();
    expect(effective.facilitator["groups.view"]).toBe(1);
  });

  test("re-granting through the relationship does not bypass the block", () => {
    // Same held capability, re-applied at a HIGHER level by the next reconcile.
    const effective = mergeEffectiveCapabilities(
      {},
      {},
      { facilitator: { "attendance.record": 5 } },
      { facilitator: new Set(["attendance.record"]) },
    );
    expect(effective.facilitator?.["attendance.record"]).toBeUndefined();
  });
});

describe("planContextGrantChanges — expiry is part of the comparison", () => {
  const desired = {
    "facilitator.groups.view": { module: "facilitator", capability: "groups.view", level: 1 },
  };

  test("a row whose level AND expiry already match is left alone", () => {
    const { toApply } = planContextGrantChanges({
      desired,
      existing: [
        {
          module: "facilitator",
          capability: "groups.view",
          access_level: 1,
          granted_by: FACILITATOR_SENTINEL,
          expires_at: "2026-06-30",
        },
      ],
      sentinel: FACILITATOR_SENTINEL,
      expiresAt: "2026-06-30",
    });
    expect(toApply).toEqual([]);
  });

  test("a program whose end date moved re-dates the grant", () => {
    const { toApply } = planContextGrantChanges({
      desired,
      existing: [
        {
          module: "facilitator",
          capability: "groups.view",
          access_level: 1,
          granted_by: FACILITATOR_SENTINEL,
          expires_at: "2026-06-30",
        },
      ],
      sentinel: FACILITATOR_SENTINEL,
      expiresAt: "2026-12-31",
    });
    expect(toApply).toHaveLength(1);
    expect(toApply[0].expiresAt).toBe("2026-12-31");
  });

  test("a manual grant is still never overwritten", () => {
    const { toApply } = planContextGrantChanges({
      desired,
      existing: [
        {
          module: "facilitator",
          capability: "groups.view",
          access_level: 1,
          granted_by: "USER_SA",
          expires_at: null,
        },
      ],
      sentinel: FACILITATOR_SENTINEL,
      expiresAt: "2026-12-31",
    });
    expect(toApply).toEqual([]);
  });
});

describe("eligibility ceiling — the assignment grant must not be dead on arrival", () => {
  const { FEATURE_ELIGIBILITY_DEFAULTS } = require("@/models/authorization/eligibility-defaults");
  const { RESPONSIBILITY_FEATURE_ROLES } = require("@/lib/featureAccess");

  test("the programs feature is eligible for the contextual identities", () => {
    // A facilitator is a baseline Member (or carries the facilitator label);
    // without the ceiling row the resolver refuses BEFORE reading the grant.
    expect(FEATURE_ELIGIBILITY_DEFAULTS.programs).toContain("facilitator");
    expect(FEATURE_ELIGIBILITY_DEFAULTS.programs).toContain("member");
  });

  test("the responsibility defaults stay in exact sync (they share one source)", () => {
    expect(RESPONSIBILITY_FEATURE_ROLES.programs).toEqual(
      FEATURE_ELIGIBILITY_DEFAULTS.programs,
    );
  });

  test("the assignment-only facilitator capabilities still resolve as granted today", () => {
    // Guards against a future vocabulary addition silently denying everyone:
    // every declared key must have a defined level for an unconfigured row.
    for (const capability of ALL_FACILITATOR_KEYS) {
      const level = resolveAssignmentCapabilityLevel(
        assignment(PROGRAM_ACTIVE, {}),
        capability,
        {},
      );
      expect(typeof level).toBe("number");
      expect(level).toBeGreaterThanOrEqual(1);
    }
  });
});

/**
 * RESILIENCE: the optional profile-override column.
 *
 * `v2_program_staff.access_profile_id` arrives with migration 041 and is only a
 * REFINEMENT of the tick list (JSON overrides, then the assignment's profile,
 * then the program default). Before the column exists, a query that NAMES it
 * fails as a whole — which took the whole assignment derivation down, and with it
 * every gated request waiting on the migration batch.
 *
 * The read is therefore tolerant: try with the column, and if the column is what
 * is missing, retry once without it and remember that for the process. These
 * tests pin both halves — the fallback works, and it does not cost a failed query
 * on every call.
 */
describe("a database without the profile-override column still works", () => {
  const MISSING = 'column "access_profile_id" does not exist';

  beforeEach(() => {
    resetAssignmentProfileColumnCache();
  });

  test("the lookup error is recognised (and only for the right shape)", () => {
    expect(isMissingColumnError(new Error(MISSING))).toBe(true);
    expect(isMissingColumnError(new Error("no such column: access_profile_id"))).toBe(true);
    // Unrelated failures must keep propagating.
    expect(isMissingColumnError(new Error("connection terminated"))).toBe(false);
    expect(isMissingColumnError(new Error('column "other_col" does not exist'))).toBe(false);
  });

  test("the derivation falls back and still returns the assignment", async () => {
    const db = require("@/lib/db").default;
    let namingCalls = 0;
    db.execute.mockImplementation(async ({ sql }) => {
      // The real failure is NAMING the column (`ps.access_profile_id`). The
      // fallback's `NULL AS access_profile_id` is only an alias and is fine, so
      // the mock must distinguish the two the way Postgres does.
      if (String(sql).includes("ps.access_profile_id")) {
        namingCalls += 1;
        throw new Error(MISSING);
      }
      if (String(sql).includes("FROM v2_program_staff")) {
        return {
          rows: [
            {
              program_id: OPEN_END_ID,
              role_key: "facilitator",
              permissions: JSON.stringify({ "attendance.record": 2 }),
              access_profile_id: null,
              end_date: OPEN_END,
              status: "Active",
              is_archived: 0,
            },
          ],
        };
      }
      return { rows: [] };
    });

    const { rows } = await listActiveProgramAssignments(CID);

    // The assignment survives; only the profile override is unavailable.
    expect(rows).toHaveLength(1);
    expect(rows[0].access_profile_id).toBeNull();
    const { desired } = deriveFacilitatorDesiredCaps(rows, {});
    expect(desired["facilitator.attendance.record"].level).toBe(2);
    // Asked once, learned, never asked again in this process.
    expect(namingCalls).toBe(1);

    const second = await listActiveProgramAssignments(CID);
    expect(second.rows).toHaveLength(1);
    expect(namingCalls).toBe(1);

    db.execute.mockImplementation(async () => ({ rows: [] }));
  });
});
