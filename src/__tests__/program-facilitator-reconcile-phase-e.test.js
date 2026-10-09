/**
 * PHASE E — program assignment wiring (docs/ROADMAP_ROLES_PROFILES_ACCESS.md §7
 * step 6).
 *
 * A program-manager change already reconciles; these tests pin the FACILITATOR
 * side: adding / editing / removing a program-staff assignment re-derives that
 * person's program access immediately, and the small helper that does it maps
 * the reconcile result (and failure) honestly.
 */

jest.mock("@/services/authorization/contextGrantReconcile", () => ({
  syncContextGrantsForUser: jest.fn(),
}));

jest.mock("@/models/programMembership", () => ({
  deleteV2ProgramStaffAssignmentById: jest.fn(async () => ({ rows: [] })),
  endV2MirroredProgramContactRole: jest.fn(async () => ({ rows: [] })),
  findParticipantFacilitatorConflict: jest.fn(async () => ({ rows: [] })),
  getContactEmailForRoleConflict: jest.fn(async () => ({ rows: [{ email: "fac@x.test" }] })),
  getProgramStaffTargetForScopeCheck: jest.fn(async () => ({ rows: [] })),
  getV2ContactCidForProgramRoleCleanup: jest.fn(async () => ({ rows: [{ cid: "C1" }] })),
  getV2ContactCidForProgramRoleMirror: jest.fn(async () => ({ rows: [{ cid: "C1" }] })),
  getV2ProgramStaffAssignmentForDelete: jest.fn(async () => ({ rows: [] })),
  getV2ProgramStaffAssignmentWithPermissions: jest.fn(async () => ({ rows: [] })),
  insertGeneralizedProgramAssignmentV2: jest.fn(async () => ({ rows: [] })),
  insertV2FacilitatorTimelineEvent: jest.fn(async () => ({ rows: [] })),
  insertV2MirroredProgramContactRole: jest.fn(async () => ({ rows: [] })),
  listV2ProgramStaffAssignments: jest.fn(async () => ({ rows: [] })),
  updateV2MirroredProgramContactRole: jest.fn(async () => ({ rowsAffected: 1 })),
  updateV2ProgramStaffAssignment: jest.fn(async () => ({ rows: [] })),
  upsertV2ProgramStaffAssignment: jest.fn(async () => ({ rows: [{ id: 1 }] })),
}));

jest.mock("@/models/authorization/accessQueries", () => ({
  isAssignedPmForProgram: jest.fn(async () => false),
}));

jest.mock("@/lib/facilitator-permissions", () => ({
  buildFullFacilitatorPermissions: jest.fn(() => ({})),
}));

const { syncContextGrantsForUser } = require("@/services/authorization/contextGrantReconcile");
const models = require("@/models/programMembership");
const {
  reconcileFacilitatorAccessForUser,
} = require("@/services/authorization/contextGrantProgramAccess");
const {
  upsertProgramStaffAssignment,
  updateProgramStaffAssignment,
  removeProgramStaffAssignment,
} = require("@/services/programs/programStaff");

const ADMIN = { role: "super_admin", cid: "ADMIN" };

beforeEach(() => {
  jest.clearAllMocks();
  models.getV2ContactCidForProgramRoleMirror.mockResolvedValue({ rows: [{ cid: "C1" }] });
  models.getV2ContactCidForProgramRoleCleanup.mockResolvedValue({ rows: [{ cid: "C1" }] });
  models.upsertV2ProgramStaffAssignment.mockResolvedValue({ rows: [{ id: 1 }] });
  models.updateV2MirroredProgramContactRole.mockResolvedValue({ rowsAffected: 1 });
  syncContextGrantsForUser.mockResolvedValue({ applied: ["a.b"], revoked: [], profileRoleGap: null });
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ── 1. The helper ────────────────────────────────────────────────────────────

describe("reconcileFacilitatorAccessForUser", () => {
  test("refuses without a cid", async () => {
    await expect(reconcileFacilitatorAccessForUser(null)).resolves.toEqual({
      success: false,
      error: "cid is required",
    });
  });

  test("asks for the FACILITATOR couple and maps the result", async () => {
    const result = await reconcileFacilitatorAccessForUser("C1", { email: "fac@x.test" });

    expect(syncContextGrantsForUser).toHaveBeenCalledWith("C1", {
      context: "program",
      roleKey: "facilitator",
      email: "fac@x.test",
    });
    expect(result).toMatchObject({ success: true, applied: ["a.b"] });
  });

  test("reports a failure instead of throwing", async () => {
    syncContextGrantsForUser.mockRejectedValueOnce(new Error("db down"));
    const result = await reconcileFacilitatorAccessForUser("C1");
    expect(result).toEqual({ success: false, error: "db down" });
  });
});

// ── 2. The program-staff writes trigger it ───────────────────────────────────

describe("program staff writes reconcile the facilitator immediately", () => {
  test("adding an assignment reconciles the resolved contact", async () => {
    await upsertProgramStaffAssignment(
      { program_id: "P1", staff_id: "fac@x.test", role: "facilitator", permissions: {} },
      ADMIN,
    );

    expect(syncContextGrantsForUser).toHaveBeenCalledWith("C1", {
      context: "program",
      roleKey: "facilitator",
      email: "fac@x.test",
    });
  });

  test("editing an assignment reconciles the row's holder", async () => {
    models.getV2ProgramStaffAssignmentWithPermissions.mockResolvedValueOnce({
      rows: [{ staff_id: "fac@x.test", program_id: "P1", role: "facilitator", permissions: {} }],
    });

    await updateProgramStaffAssignment({ id: 1, role: "facilitator" }, ADMIN);

    expect(syncContextGrantsForUser).toHaveBeenCalledWith(
      "C1",
      expect.objectContaining({ context: "program", roleKey: "facilitator" }),
    );
  });

  test("removing an assignment reconciles the withdrawn relationship", async () => {
    models.getV2ProgramStaffAssignmentForDelete.mockResolvedValueOnce({
      rows: [{ staff_id: "fac@x.test", program_id: "P1" }],
    });

    await removeProgramStaffAssignment(1, ADMIN);

    expect(models.deleteV2ProgramStaffAssignmentById).toHaveBeenCalledWith(1);
    expect(syncContextGrantsForUser).toHaveBeenCalledWith(
      "C1",
      expect.objectContaining({ context: "program", roleKey: "facilitator" }),
    );
  });

  test("a reconcile failure never fails the recorded assignment", async () => {
    syncContextGrantsForUser.mockRejectedValueOnce(new Error("reconcile exploded"));

    await expect(
      upsertProgramStaffAssignment(
        { program_id: "P1", staff_id: "fac@x.test", role: "facilitator", permissions: {} },
        ADMIN,
      ),
    ).resolves.toBe(1);
    // The write still happened.
    expect(models.upsertV2ProgramStaffAssignment).toHaveBeenCalled();
  });
});
