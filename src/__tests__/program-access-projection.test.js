/**
 * LOT 7.3 — the program workspace shows the SERVER's write decision.
 *
 * The projection asked the unified decision (`decide`, D-3) — the same one the
 * write routes enforce — and the screen renders that answer. These tests lock
 * the composition (which questions, in which order) and the fail-closed rule on
 * the screen side.
 */

jest.mock("@/services/authorization/scopedAccess", () => ({
  decide: jest.fn(),
}));

const { decide } = require("@/services/authorization/scopedAccess");
const {
  projectProgramAccess,
} = require("@/services/authorization/programAccessProjection");
const {
  selectProgramAccess,
} = require("@/components/pm/programs/programWorkspaceSelectors");

const allow = { allowed: true, status: 200, errorKey: null, reason: "granted" };

beforeEach(() => {
  jest.clearAllMocks();
});

describe("projectProgramAccess — the decision, not a second rule", () => {
  test("asks the program perimeter for programs.edit", async () => {
    decide.mockResolvedValue(allow);
    await projectProgramAccess("P-1");

    expect(decide).toHaveBeenCalledWith({
      module: "programs",
      capability: "edit",
      resource: "program",
      contextId: "P-1",
    });
  });

  test("publish is asked at its own level, only after edit is granted", async () => {
    decide
      .mockResolvedValueOnce(allow)
      .mockResolvedValueOnce({
        allowed: false,
        status: 403,
        errorKey: "errors.insufficientPermissions",
        reason: "insufficient_level",
      });

    const access = await projectProgramAccess("P-1");

    expect(decide).toHaveBeenNthCalledWith(2, {
      module: "programs",
      capability: "publish",
      minLevel: 4,
      resource: "program",
      contextId: "P-1",
    });
    expect(access).toEqual({ edit: true, publish: false, reason: "granted" });
  });

  test("a refused editor is never asked about publishing", async () => {
    decide.mockResolvedValueOnce({
      allowed: false,
      status: 403,
      errorKey: "errors.insufficientPermissions",
      reason: "out_of_scope",
    });

    const access = await projectProgramAccess("P-1");

    expect(decide).toHaveBeenCalledTimes(1);
    expect(access).toEqual({ edit: false, publish: false, reason: "out_of_scope" });
  });
});

describe("selectProgramAccess — the screen cannot outrun the server", () => {
  const user = { cid: "U-1", role: "staff" };
  const assignedProgram = { assigned_pm_id: "U-1" };

  test("a granted decision opens the write affordances", () => {
    const access = selectProgramAccess({
      program: assignedProgram,
      programTeamMembers: [],
      user,
      serverAccess: { edit: true, publish: false, reason: "granted" },
    });
    expect(access.canEdit).toBe(true);
    expect(access.canContribute).toBe(true);
  });

  test("a refused decision closes them, even for the assigned manager", () => {
    const access = selectProgramAccess({
      program: assignedProgram,
      programTeamMembers: [{ cid: "U-1" }],
      user,
      serverAccess: { edit: false, publish: false, reason: "out_of_scope" },
    });
    expect(access.canEdit).toBe(false);
    expect(access.canContribute).toBe(false);
  });

  test("no server answer yet means read-only", () => {
    const access = selectProgramAccess({
      program: assignedProgram,
      programTeamMembers: [{ cid: "U-1" }],
      user,
      serverAccess: null,
    });
    expect(access.canEdit).toBe(false);
  });
});
