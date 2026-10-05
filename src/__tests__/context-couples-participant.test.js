/**
 * PROGRAM PARTICIPANT — the automatic attribution couple
 * (docs/ROADMAP_ROLES_PROFILES_ACCESS.md §7, product request extending D5).
 *
 * A program enrollment (`participant_programs`) is the justifying relationship:
 * it opens a `participant` profile card and derives the participant grant from
 * the Context Roles registry mapping, exactly like the other couples. Three
 * surfaces:
 *   1. the PROFILE KEY the couple speaks;
 *   2. the JUSTIFICATION — enrollment ids in, registry capabilities out;
 *   3. the SWEEP POPULATION — every enrolled person, from its own read;
 *   4. the store's statement shapes.
 */

const mockDbExecute = jest.fn(async () => ({ rows: [] }));

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: (...args) => mockDbExecute(...args) },
  initDb: jest.fn(async () => {}),
}));

jest.mock("@/models/authorization/contextGrantsStore", () => ({
  ensureContextAppliedGrantsSchema: jest.fn(async () => {}),
  getProfileCapabilityRows: jest.fn(async () => ({
    rows: [{ module: "x", capability: "view", access_level: 1 }],
  })),
  listActiveFounderVentures: jest.fn(async () => []),
  listActiveInvestorProfiles: jest.fn(async () => ({ rows: [] })),
  listActiveLearnerCourses: jest.fn(async () => ({ rows: [] })),
  listActiveVentureManagerVentures: jest.fn(async () => []),
  listActiveParticipantPrograms: jest.fn(async () => ({ rows: [] })),
  listFounderRelationshipCids: jest.fn(async () => ({ rows: [] })),
  listInvestorRelationshipCids: jest.fn(async () => ({ rows: [] })),
  listLearnerRelationshipCids: jest.fn(async () => ({ rows: [] })),
  listVentureManagerCids: jest.fn(async () => ({ rows: [] })),
  listParticipantRelationshipCids: jest.fn(async () => ({ rows: [] })),
  listContextAppliedGrantCids: jest.fn(async () => ({ rows: [] })),
}));

jest.mock("@/models/authorization/contextRoleProfiles", () => ({
  getContextRoleProfile: jest.fn(async (context, roleKey) => ({
    rows: [
      {
        id: 1,
        context,
        role_key: roleKey,
        profile_id: 7,
        is_active: 1,
        profile_name: `${roleKey} template`,
      },
    ],
  })),
}));

jest.mock("@/models/authorization/programAssignmentReads", () => ({
  listActiveProgramAssignments: jest.fn(async () => ({ rows: [] })),
  listProgramAssignmentContacts: jest.fn(async () => []),
  loadAssignmentLookups: jest.fn(async () => ({})),
}));

jest.mock("@/services/authorization/contextGrantReconcile", () => ({
  syncContextGrantsForUser: jest.fn(async () => ({ success: true, applied: [], revoked: [] })),
}));

const store = require("@/models/authorization/contextGrantsStore");
const { syncContextGrantsForUser } = require("@/services/authorization/contextGrantReconcile");
const { resolveContextJustification } = require("@/services/authorization/contextGrantJustification");
const { syncAllContextGrants } = require("@/services/authorization/contextGrantSweep");
const { profileKeyForContextRole } = require("@/services/authorization/profileCatalog");

const CID = "C-PARTICIPANT";

const sqlOf = (call) => {
  const first = call[0];
  return typeof first === "string" ? first : String(first?.sql || "");
};

beforeEach(() => {
  jest.clearAllMocks();
  mockDbExecute.mockResolvedValue({ rows: [] });
  store.getProfileCapabilityRows.mockResolvedValue({
    rows: [{ module: "x", capability: "view", access_level: 1 }],
  });
  store.listActiveParticipantPrograms.mockResolvedValue({ rows: [] });
  store.listParticipantRelationshipCids.mockResolvedValue({ rows: [] });
  store.listContextAppliedGrantCids.mockResolvedValue({ rows: [] });
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ── 1. The profile key ───────────────────────────────────────────────────────

describe("profileKeyForContextRole — participant", () => {
  test("maps the program/participant couple to the participant profile", () => {
    expect(profileKeyForContextRole("program", "participant")).toBe("participant");
  });
});

// ── 2. Justification ─────────────────────────────────────────────────────────

describe("resolveContextJustification — program participant", () => {
  test("each enrollment is a source id, and the registry maps the pair", async () => {
    store.listActiveParticipantPrograms.mockResolvedValue({
      rows: [{ program_id: "P-1" }, { program_id: "P-2" }],
    });

    const result = await resolveContextJustification(CID, {
      context: "program",
      roleKey: "participant",
    });

    expect(result.sourceIds).toEqual(["P-1", "P-2"]);
    // No expiry: the enrollment row itself is the end.
    expect(result.managesExpiry).toBe(false);
    expect(Object.keys(result.desired)).toEqual(["x.view"]);
  });

  test("no enrollment is an honest empty relationship, never a silent revoke", async () => {
    const result = await resolveContextJustification(CID, {
      context: "program",
      roleKey: "participant",
    });
    expect(result).toMatchObject({
      sourceIds: [],
      reason: "no active relationship",
      desired: {},
    });
  });
});

// ── 3. Sweep population ──────────────────────────────────────────────────────

describe("syncAllContextGrants — the participant population", () => {
  test("evaluates every enrolled person from its own read", async () => {
    store.listParticipantRelationshipCids.mockResolvedValue({ rows: [{ cid: "C-PART" }] });

    const report = await syncAllContextGrants({ context: "program", roleKey: "participant" });

    expect(report.success).toBe(true);
    expect(report.evaluated).toBe(1);
    expect(syncContextGrantsForUser).toHaveBeenCalledWith("C-PART", {
      context: "program",
      roleKey: "participant",
    });
    // The program-staff read is NOT used for participants.
    const assignments = require("@/models/authorization/programAssignmentReads");
    expect(assignments.listProgramAssignmentContacts).not.toHaveBeenCalled();
  });
});

// ── 4. Store statement shapes ────────────────────────────────────────────────

describe("participant reads — statement shapes", () => {
  const actualStore = () => jest.requireActual("@/models/authorization/contextGrantsStore");

  test("listActiveParticipantPrograms reads the enrollments by participant", async () => {
    mockDbExecute.mockClear();
    await actualStore().listActiveParticipantPrograms("C-1");
    const sql = sqlOf(mockDbExecute.mock.calls[0]);
    expect(sql).toMatch(/FROM participant_programs/i);
    expect(sql).toMatch(/participant_id = \?/i);
  });

  test("listParticipantRelationshipCids reads the distinct enrolled people", async () => {
    mockDbExecute.mockClear();
    await actualStore().listParticipantRelationshipCids();
    const sql = sqlOf(mockDbExecute.mock.calls[0]);
    expect(sql).toMatch(/DISTINCT participant_id/i);
    expect(sql).toMatch(/FROM participant_programs/i);
  });
});
