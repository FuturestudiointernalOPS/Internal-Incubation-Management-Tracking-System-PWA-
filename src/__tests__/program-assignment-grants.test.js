/**
 * ASSIGNMENT-DERIVED PROGRAM ACCESS — regression contract.
 *
 * A program facilitator and a program manager hold their access because of
 * an assignment they have on a PARTICULAR program, and only while that
 * program runs. This suite locks the four properties that make that true:
 *
 *   1. CONSISTENCY — the grant is DERIVED from the assignment. A facilitator
 *      grant is the union of the per-program tick levels (a capability ticked
 *      off in every program disappears; one ticked in a single program
 *      survives) because the per-program gate decides WHERE it applies.
 *   2. DURATION — the grant carries the latest program end date as its expiry,
 *      and an ended program justifies nothing at all.
 *   3. NON-REGRESSION — an entry the tick list never carried resolves to
 *      "granted", which is what today's behaviour amounts to. Reading it as
 *      denied would strip access from every facilitator already in production.
 *   4. REMOVABILITY — an administrator's explicit block removes the capability
 *      even though the relationship keeps re-applying it, because blocks are
 *      applied AFTER the merge.
 *
 * The fake database and the fixtures live in
 * ./helpers/programAssignmentGrants.
 *
 * Siblings: program-assignment-grants.planning.test.js (the change plan and
 * the eligibility ceiling) and program-assignment-grants.resilience.test.js
 * (a database without the profile-override column).
 */

const mockGrants = require("./helpers/programAssignmentGrants");

jest.mock("@/lib/db", () => mockGrants.dbMock);
jest.mock("@/services/authorization/context", () => mockGrants.authorizationContextMock);

const {
  isProgramEnded,
} = require("@/models/authorization/programAssignmentReads");
const {
  deriveAssignmentsExpiry,
  deriveFacilitatorDesiredCaps,
  resolveAssignmentCapabilityLevel,
  UNCONFIGURED_LEVEL,
} = require("@/services/authorization/programAssignments");
const {
  syncContextGrantsForUser,
  contextGrantSentinel,
} = require("@/services/authorization/contextGrants");
const { mergeEffectiveCapabilities } = jest.requireActual(
  "@/services/authorization/context",
);

const {
  mockState,
  resetState,
  assignment,
  ours,
  CID,
  OPEN_END,
  PROGRAM_ACTIVE,
  PROGRAM_OPEN_ENDED,
} = require("./helpers/programAssignmentGrants");

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
    // Phase H — the program_manager profile is open to the staff baseline only.
    mockState.contactRole = "staff";
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
