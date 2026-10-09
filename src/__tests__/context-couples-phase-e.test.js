/**
 * PHASE E — the newly activated context/profile couples
 * (docs/ROADMAP_ROLES_PROFILES_ACCESS.md §7, product decision D5: all but
 * venture:team_member).
 *
 * Two surfaces:
 *   1. the JUSTIFICATION — each couple resolves its relationship to source ids
 *      and reuses the Context Roles registry mapping for the capabilities;
 *   2. the SWEEP population — each couple has its own "everyone holding it" read,
 *      so a periodic pass evaluates the right people.
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    execute: jest.fn(async (query) => {
      const sql = typeof query === "string" ? query : query?.sql || "";
      const args = typeof query === "string" ? [] : query?.args || [];
      if (sql.includes("FROM profiles")) {
        const contexts = {
          investor: "investor",
          learner: "lms",
          venture_manager: "venture",
          founder: "venture",
          participant: "program",
          facilitator: "program",
          program_manager: "program",
        };
        const key = String(args[0]);
        return {
          rows: contexts[key]
            ? [{ key, context: contexts[key], allowed_roles: "[]", is_active: 1 }]
            : [],
        };
      }
      return { rows: [] };
    }),
  },
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
  listFounderRelationshipCids: jest.fn(async () => ({ rows: [] })),
  listInvestorRelationshipCids: jest.fn(async () => ({ rows: [] })),
  listLearnerRelationshipCids: jest.fn(async () => ({ rows: [] })),
  listVentureManagerCids: jest.fn(async () => ({ rows: [] })),
  listContextAppliedGrantCids: jest.fn(async () => ({ rows: [] })),
}));

jest.mock("@/models/authorization/contextRoleProfiles", () => ({
  getContextRoleProfile: jest.fn(async (context, roleKey) => ({
    rows: [
      { id: 1, context, role_key: roleKey, profile_key: "founder", is_active: 1, profile_name: `${roleKey} template` },
    ],
  })),
}));

jest.mock("@/models/authorization/programAssignmentReads", () => ({
  listActiveProgramAssignments: jest.fn(async () => ({ rows: [] })),
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

const CID = "C-1";

beforeEach(() => {
  jest.clearAllMocks();
  store.getProfileCapabilityRows.mockResolvedValue({
    rows: [{ module: "x", capability: "view", access_level: 1 }],
  });
  store.listActiveInvestorProfiles.mockResolvedValue({ rows: [] });
  store.listActiveLearnerCourses.mockResolvedValue({ rows: [] });
  store.listActiveVentureManagerVentures.mockResolvedValue([]);
  store.listInvestorRelationshipCids.mockResolvedValue({ rows: [] });
  store.listLearnerRelationshipCids.mockResolvedValue({ rows: [] });
  store.listVentureManagerCids.mockResolvedValue({ rows: [] });
  store.listContextAppliedGrantCids.mockResolvedValue({ rows: [] });
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ── 1. The profile key each couple maps to ───────────────────────────────────

describe("profileKeyForContextRole — the new couples speak in profile keys", () => {
  test("investor, learner and venture_manager map to their catalogue profile", async () => {
    await expect(profileKeyForContextRole("investor", "investor")).resolves.toBe("investor");
    await expect(profileKeyForContextRole("lms", "learner")).resolves.toBe("learner");
    await expect(profileKeyForContextRole("venture", "venture_manager")).resolves.toBe("venture_manager");
  });
});

// ── 2. Justification ─────────────────────────────────────────────────────────

describe("resolveContextJustification — the Phase E couples", () => {
  test("investor: an investor profile justifies the tutor caps", async () => {
    store.listActiveInvestorProfiles.mockResolvedValue({ rows: [{ investor_id: "INV-1" }] });
    const result = await resolveContextJustification(CID, { context: "investor", roleKey: "investor" });
    expect(result.sourceIds).toEqual(["INV-1"]);
    expect(result.managesExpiry).toBe(false);
    expect(Object.keys(result.desired)).toEqual(["x.view"]);
  });

  test("investor: no profile is an honest empty relationship", async () => {
    const result = await resolveContextJustification(CID, { context: "investor", roleKey: "investor" });
    expect(result).toMatchObject({ sourceIds: [], reason: "no active relationship", desired: {} });
  });

  test("learner: every enrolled course is a source id", async () => {
    store.listActiveLearnerCourses.mockResolvedValue({ rows: [{ course_id: "CRS-1" }, { course_id: "CRS-2" }] });
    const result = await resolveContextJustification(CID, { context: "lms", roleKey: "learner" });
    expect(result.sourceIds).toEqual(["CRS-1", "CRS-2"]);
    expect(result.managesExpiry).toBe(false);
  });

  test("venture_manager: the lead-managed ventures are the source ids", async () => {
    store.listActiveVentureManagerVentures.mockResolvedValue(["VNT-1"]);
    const result = await resolveContextJustification(CID, { context: "venture", roleKey: "venture_manager" });
    expect(result.sourceIds).toEqual(["VNT-1"]);
  });

  test("a couple this build does not support is still null, never silently empty", async () => {
    expect(await resolveContextJustification(CID, { context: "venture", roleKey: "team_member" })).toBeNull();
  });
});

// ── 3. Sweep population ──────────────────────────────────────────────────────

describe("syncAllContextGrants — each new couple has its own population", () => {
  const expectSweepUsesRead = async (spec, readMock, row) => {
    readMock.mockResolvedValue({ rows: [row] });
    const report = await syncAllContextGrants(spec);
    expect(report.success).toBe(true);
    expect(report.evaluated).toBe(1);
    expect(syncContextGrantsForUser).toHaveBeenCalledWith(row.cid, spec);
  };

  test("investor evaluates every investor", async () => {
    await expectSweepUsesRead(
      { context: "investor", roleKey: "investor" },
      store.listInvestorRelationshipCids,
      { cid: "C-INV" },
    );
  });

  test("learner evaluates every enrolled person", async () => {
    await expectSweepUsesRead(
      { context: "lms", roleKey: "learner" },
      store.listLearnerRelationshipCids,
      { cid: "C-LRN" },
    );
  });

  test("venture_manager evaluates every lead manager", async () => {
    await expectSweepUsesRead(
      { context: "venture", roleKey: "venture_manager" },
      store.listVentureManagerCids,
      { cid: "C-VM" },
    );
  });
});
