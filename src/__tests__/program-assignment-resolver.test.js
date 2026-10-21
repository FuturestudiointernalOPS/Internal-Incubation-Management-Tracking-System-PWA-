/**
 * Lot 3.3 — ONE assignment calculation.
 *
 * The facilitator guard and the scoped decision used to answer "what is this
 * person's standing in this program?" with different rules. This suite freezes
 * the single answer: staff table first (optionally narrowed to one role), then
 * the generalized contact-role layer.
 */

jest.mock("@/models/authorization/contextAssignmentReads", () => ({
  getProgramStaffAssignmentRows: jest.fn(async () => []),
}));
jest.mock("@/models/authorization/accessQueries", () => ({
  getProgramAssignment: jest.fn(async () => null),
}));

const { getProgramStaffAssignmentRows } = require("@/models/authorization/contextAssignmentReads");
const { getProgramAssignment } = require("@/models/authorization/accessQueries");
const { resolveProgramAssignment } = require("@/services/authorization/programAssignment");

const STAFF_ROW = { id: 1, program_id: "P1", staff_id: "USR_1", role: "facilitator" };
const GENERALIZED = { id: 9, program_id: "P1", staff_id: "USR_1", role: "coach" };

beforeEach(() => {
  jest.clearAllMocks();
  getProgramStaffAssignmentRows.mockResolvedValue([]);
  getProgramAssignment.mockResolvedValue(null);
});

describe("resolveProgramAssignment — one answer, one order", () => {
  test("a staff row wins and is reported as such", async () => {
    getProgramStaffAssignmentRows.mockResolvedValue([STAFF_ROW]);

    const resolved = await resolveProgramAssignment({
      programId: "P1",
      userCid: "USR_1",
      userEmail: "u@x.test",
    });

    expect(resolved).toEqual({ source: "v2_program_staff", assignment: STAFF_ROW });
    expect(getProgramAssignment).not.toHaveBeenCalled();
  });

  test("a role-specific question only accepts that role", async () => {
    await resolveProgramAssignment({
      programId: "P1",
      userCid: "USR_1",
      role: "facilitator",
    });

    expect(getProgramStaffAssignmentRows).toHaveBeenCalledWith("P1", "USR_1", null, "facilitator");
  });

  test("the generalized layer answers when the staff table has no row", async () => {
    getProgramAssignment.mockResolvedValue(GENERALIZED);

    const resolved = await resolveProgramAssignment({ programId: "P1", userCid: "USR_1" });

    expect(resolved).toEqual({ source: "contact_roles", assignment: GENERALIZED });
  });

  test("no row and no generalized assignment → null (never a fabricated pass)", async () => {
    await expect(resolveProgramAssignment({ programId: "P1", userCid: "USR_1" })).resolves.toBeNull();
  });

  test("an unusable question is null without touching the database", async () => {
    await expect(resolveProgramAssignment({ programId: "", userCid: "USR_1" })).resolves.toBeNull();
    await expect(resolveProgramAssignment({ programId: "P1", userCid: "" })).resolves.toBeNull();

    expect(getProgramStaffAssignmentRows).not.toHaveBeenCalled();
    expect(getProgramAssignment).not.toHaveBeenCalled();
  });
});
