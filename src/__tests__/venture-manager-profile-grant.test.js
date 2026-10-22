/**
 * Making someone the Venture's Lead Manager must also grant the CAPABILITY.
 *
 * THE DEFECT THIS LOCKS SHUT (found on production, real person)
 *
 * The assignment grants SCOPE — "this Venture is yours" — but `ventures.view`
 * comes from the `venture_manager` PROFILE, and nothing opened that profile when
 * an assignment was created. So a freshly appointed manager held a Venture she was
 * not allowed to open: the gate answered "insufficient permissions" and only Super
 * Admin (which bypasses both capability and scope) could see it. The reconcile that
 * opens and closes those profile periods already existed — it was simply never
 * called from the assignment path.
 */

const mockSyncContextGrants = jest.fn();
jest.mock("@/services/authorization/contextGrantReconcile", () => ({
  syncContextGrantsForUser: (...args) => mockSyncContextGrants(...args),
}));

const mockInvalidateAccess = jest.fn();
jest.mock("@/services/ventures/accessFacts", () => ({
  invalidateVentureAccess: (...args) => mockInvalidateAccess(...args),
}));

const mockInsertAssignment = jest.fn();
const mockRemoveAssignmentRow = jest.fn();
const mockSelectAssignmentRow = jest.fn();
const mockSelectResponsibilityByCode = jest.fn();

jest.mock("@/models/venturePermissionStore", () => ({
  insertAssignment: (...args) => mockInsertAssignment(...args),
  removeAssignmentRow: (...args) => mockRemoveAssignmentRow(...args),
  selectAssignmentRow: (...args) => mockSelectAssignmentRow(...args),
  selectResponsibilityByCode: (...args) => mockSelectResponsibilityByCode(...args),
  // Not exercised by these paths; present so the module surface matches.
  updatePermissionMatrixCorrection: jest.fn(),
  countPermissionMatrixRows: jest.fn(),
  insertResponsibility: jest.fn(),
  insertScopeType: jest.fn(),
  insertMatrixCellSeed: jest.fn(),
  selectResponsibilities: jest.fn(),
  selectActiveScopeTypes: jest.fn(),
  selectMatrixForResponsibility: jest.fn(),
  upsertMatrixCell: jest.fn(),
  selectAssignments: jest.fn(),
  selectActiveAssignmentsForContact: jest.fn(),
  selectMatrixCell: jest.fn(),
  selectAnyActiveAssignment: jest.fn(),
}));

const { createAssignment, removeAssignment } = require("@/services/ventures/permissions");

/** The couple the reconcile keys on — the venture context, manager role. */
const VENTURE_MANAGER = { context: "venture", roleKey: "venture_manager" };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
  mockSelectResponsibilityByCode.mockResolvedValue({ rows: [{ is_active: true }] });
  mockInsertAssignment.mockResolvedValue({ lastInsertRowid: 11 });
  mockRemoveAssignmentRow.mockResolvedValue({ rows: [] });
  mockSelectAssignmentRow.mockResolvedValue({
    rows: [{ staff_contact_id: "C1", responsibility_code: "lead_manager" }],
  });
  mockSyncContextGrants.mockResolvedValue({ success: true });
});

describe("appointing a Venture Lead Manager", () => {
  test("opens the Venture Manager profile for that person", async () => {
    await createAssignment({
      ventureId: "VNT-1",
      staffContactId: "C1",
      responsibilityCode: "lead_manager",
    });

    expect(mockInsertAssignment).toHaveBeenCalled();
    expect(mockSyncContextGrants).toHaveBeenCalledWith("C1", VENTURE_MANAGER);
  });

  test("any other responsibility leaves the profile alone", async () => {
    await createAssignment({
      ventureId: "VNT-1",
      staffContactId: "C1",
      responsibilityCode: "coach",
    });

    expect(mockInsertAssignment).toHaveBeenCalled();
    expect(mockSyncContextGrants).not.toHaveBeenCalled();
  });

  test("a profile-sync failure never rolls back the appointment", async () => {
    mockSyncContextGrants.mockRejectedValue(new Error("authz resolver down"));

    const result = await createAssignment({
      ventureId: "VNT-1",
      staffContactId: "C1",
      responsibilityCode: "lead_manager",
    });

    expect(result).toEqual({ success: true, id: 11 });
  });
});

describe("removing a Lead Manager assignment", () => {
  test("reads the row first, then reconciles the profile", async () => {
    await removeAssignment({ id: 7 });

    expect(mockSelectAssignmentRow).toHaveBeenCalledWith(7);
    expect(mockRemoveAssignmentRow).toHaveBeenCalledWith(7);
    expect(mockSyncContextGrants).toHaveBeenCalledWith("C1", VENTURE_MANAGER);
  });

  test("a non-manager assignment does not touch the profile", async () => {
    mockSelectAssignmentRow.mockResolvedValue({
      rows: [{ staff_contact_id: "C1", responsibility_code: "coach" }],
    });

    await removeAssignment({ id: 8 });

    expect(mockRemoveAssignmentRow).toHaveBeenCalledWith(8);
    expect(mockSyncContextGrants).not.toHaveBeenCalled();
  });

  test("an unreadable row still removes the assignment", async () => {
    mockSelectAssignmentRow.mockRejectedValue(new Error("read failed"));

    const result = await removeAssignment({ id: 9 });

    expect(result).toEqual({ success: true });
    expect(mockRemoveAssignmentRow).toHaveBeenCalledWith(9);
  });
});
