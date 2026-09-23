/**
 * PUT /api/pm/programs/[id]/manager — the repair action behind the readiness
 * report.
 *
 * A program with no manager recorded can never be matched by the program scope
 * rule, so enforcing that rule before repairing the data would make the program
 * unreachable to everyone but the portfolio identity. This route records the
 * relationship and reconciles the assignment-derived access of BOTH sides:
 * the new manager receives it, the previous manager's relationship-derived
 * grants are withdrawn.
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [] })) },
  initDb: jest.fn(async () => true),
}));

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(async () => ({ cid: "USR_ACTOR", role: "staff" })),
}));

jest.mock("@/lib/authorization", () => ({
  requireAuthorization: jest.fn(async () => null),
}));

jest.mock("@/lib/authorization/scope", () => ({
  isWithinScope: jest.fn(async () => true),
}));

jest.mock("@/models/programs", () => ({
  getProgramManager: jest.fn(),
  setProgramManager: jest.fn(async () => ({ rows: [] })),
}));

jest.mock("@/models/authorization", () => ({
  getContactNameAndRole: jest.fn(async () => ({ rows: [{ name: "New PM", role: "staff" }] })),
}));

jest.mock("@/models/authorization/contextGrants", () => ({
  syncContextGrantsForUser: jest.fn(async () => ({ applied: [], revoked: [] })),
}));

const { requireAuthorization } = require("@/lib/authorization");
const { isWithinScope } = require("@/lib/authorization/scope");
const { getProgramManager, setProgramManager } = require("@/models/programs");
const { getContactNameAndRole } = require("@/models/authorization");
const { syncContextGrantsForUser } = require("@/models/authorization/contextGrants");
const { PUT } = require("@/app/api/pm/programs/[id]/manager/route");

const denied = () => new Response("{}", { status: 403 });

const req = (body) =>
  new Request("http://localhost/api/pm/programs/P1/manager", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const ctx = (id = "P1") => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  jest.clearAllMocks();
  requireAuthorization.mockResolvedValue(null);
  isWithinScope.mockResolvedValue(true);
  getContactNameAndRole.mockResolvedValue({ rows: [{ name: "New PM", role: "staff" }] });
  syncContextGrantsForUser.mockResolvedValue({ applied: [], revoked: [] });
});

describe("authorization", () => {
  test("requires programs.edit — changing who runs a program is a program write", async () => {

    getProgramManager.mockResolvedValue({
      rows: [{ id: "P1", name: "Cohort 1", assigned_pm_id: null }],
    });
    await PUT(req({ manager_cid: "USR_NEW" }), ctx());
    expect(requireAuthorization).toHaveBeenCalledWith("programs", "edit");
  });

  test("a denial is returned and nothing is recorded", async () => {
    requireAuthorization.mockResolvedValueOnce(denied());
    const res = await PUT(req({ manager_cid: "USR_NEW" }), ctx());

    expect(res.status).toBe(403);
    expect(getProgramManager).not.toHaveBeenCalled();
    expect(setProgramManager).not.toHaveBeenCalled();
  });
});

describe("validation", () => {
  test("manager_cid is required", async () => {
    const res = await PUT(req({}), ctx());
    expect(res.status).toBe(400);
    expect(setProgramManager).not.toHaveBeenCalled();
  });

  test("an unknown program is a 404", async () => {
    getProgramManager.mockResolvedValue({ rows: [] });
    const res = await PUT(req({ manager_cid: "USR_NEW" }), ctx());
    expect(res.status).toBe(404);
  });

  test("an unknown manager is a 404 — a dangling assignment resolves to nobody", async () => {
    getProgramManager.mockResolvedValue({
      rows: [{ id: "P1", name: "Cohort 1", assigned_pm_id: null }],
    });
    getContactNameAndRole.mockResolvedValueOnce({ rows: [] });

    const res = await PUT(req({ manager_cid: "USR_MISSING" }), ctx());
    expect(res.status).toBe(404);
    expect(setProgramManager).not.toHaveBeenCalled();
  });
});

describe("recording the relationship", () => {
  test("assigning a manager reconciles the NEW manager's access", async () => {
    getProgramManager.mockResolvedValue({
      rows: [{ id: "P1", name: "Cohort 1", assigned_pm_id: null }],
    });
    syncContextGrantsForUser.mockResolvedValue({
      applied: ["programs.view", "programs.edit"],
      revoked: [],
    });

    const res = await PUT(req({ manager_cid: "USR_NEW" }), ctx());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(setProgramManager).toHaveBeenCalledWith("P1", "USR_NEW");
    // The assignment-derived grant follows the relationship.
    expect(syncContextGrantsForUser).toHaveBeenCalledWith("USR_NEW", {
      context: "program",
      roleKey: "program_manager",
    });
    expect(body.reconciled).toEqual([
      { cid: "USR_NEW", applied: ["programs.view", "programs.edit"], revoked: [] },
    ]);
  });

  test("replacing a manager reconciles BOTH — the previous one loses what this program justified", async () => {
    getProgramManager.mockResolvedValue({
      rows: [{ id: "P1", name: "Cohort 1", assigned_pm_id: "USR_OLD" }],
    });
    syncContextGrantsForUser
      .mockResolvedValueOnce({ applied: ["programs.edit"], revoked: [] })
      .mockResolvedValueOnce({ applied: [], revoked: ["programs.edit"] });

    const res = await PUT(req({ manager_cid: "USR_NEW" }), ctx());
    const body = await res.json();

    const cids = syncContextGrantsForUser.mock.calls.map((call) => call[0]);
    expect(cids).toEqual(["USR_NEW", "USR_OLD"]);
    expect(body.previous).toEqual({ cid: "USR_OLD" });
    expect(body.reconciled[1]).toEqual({
      cid: "USR_OLD",
      applied: [],
      revoked: ["programs.edit"],
    });
  });

  test("clearing the manager withdraws the previous manager's access", async () => {
    getProgramManager.mockResolvedValue({
      rows: [{ id: "P1", name: "Cohort 1", assigned_pm_id: "USR_OLD" }],
    });

    await PUT(req({ manager_cid: null }), ctx());

    expect(setProgramManager).toHaveBeenCalledWith("P1", null);
    expect(syncContextGrantsForUser).toHaveBeenCalledTimes(1);
    expect(syncContextGrantsForUser).toHaveBeenCalledWith(
      "USR_OLD",
      expect.anything(),
    );
  });

  test("re-recording the same manager is a no-op — no write, no reconcile", async () => {
    getProgramManager.mockResolvedValue({
      rows: [{ id: "P1", name: "Cohort 1", assigned_pm_id: "USR_SAME" }],
    });

    const res = await PUT(req({ manager_cid: "USR_SAME" }), ctx());
    const body = await res.json();

    expect(body.unchanged).toBe(true);
    expect(setProgramManager).not.toHaveBeenCalled();
    expect(syncContextGrantsForUser).not.toHaveBeenCalled();
  });

  test("a reconcile failure does not lose the recorded relationship", async () => {
    getProgramManager.mockResolvedValue({
      rows: [{ id: "P1", name: "Cohort 1", assigned_pm_id: null }],
    });
    syncContextGrantsForUser.mockRejectedValueOnce(new Error("db down"));

    const res = await PUT(req({ manager_cid: "USR_NEW" }), ctx());
    const body = await res.json();

    // The assignment is the source of truth: it is recorded, and the next
    // connect (or the scheduled sweep) re-derives from it.
    expect(res.status).toBe(200);
    expect(setProgramManager).toHaveBeenCalledWith("P1", "USR_NEW");
    expect(body.reconciled).toEqual([]);
  });
});

/**
 * THE REPAIR PATH MUST NOT DEADLOCK.
 *
 * The scope rule matches a person to a program through the manager
 * relationship, so a program with NO manager recorded cannot be matched — by
 * definition nobody is staffed on it. If this route were scoped, the one action
 * that repairs such a program would be refused by the rule it is repairing.
 *
 * Two ways in, therefore: staffed on the program (the ordinary case), or holding
 * the authority to configure access — which is what changing a manager IS, since
 * it decides who receives the assignment-derived grants. A staff member with only
 * programs.edit still cannot touch a program they are not staffed on.
 */
describe("the repair path has two ways in", () => {
  test("staffed on the program → allowed without the console authority", async () => {
    isWithinScope.mockResolvedValueOnce(true);
    getProgramManager.mockResolvedValue({
      rows: [{ id: "P1", name: "Cohort 1", assigned_pm_id: null }],
    });

    const res = await PUT(req({ manager_cid: "USR_NEW" }), ctx());

    expect(res.status).toBe(200);
    expect(isWithinScope).toHaveBeenCalledWith(
      "program_staffed",
      "USR_ACTOR",
      "P1",
      expect.anything(),
    );
    // The console authority is never consulted when they are staffed.
    expect(requireAuthorization).not.toHaveBeenCalledWith(
      "permissions",
      "assign_capabilities",
    );
  });

  test("NOT staffed but holding the console authority → allowed (the unmanaged program)", async () => {
    isWithinScope.mockResolvedValueOnce(false);
    requireAuthorization.mockResolvedValue(null); // both capabilities held
    getProgramManager.mockResolvedValue({
      rows: [{ id: "P1", name: "Cohort 1", assigned_pm_id: null }],
    });

    const res = await PUT(req({ manager_cid: "USR_NEW" }), ctx());

    expect(res.status).toBe(200);
    expect(requireAuthorization).toHaveBeenCalledWith(
      "permissions",
      "assign_capabilities",
    );
    expect(setProgramManager).toHaveBeenCalledWith("P1", "USR_NEW");
  });

  test("NOT staffed and without the console authority → refused, nothing recorded", async () => {
    isWithinScope.mockResolvedValueOnce(false);
    requireAuthorization.mockImplementation(async (module) =>
      module === "permissions" ? new Response("{}", { status: 403 }) : null,
    );

    const res = await PUT(req({ manager_cid: "USR_NEW" }), ctx());

    expect(res.status).toBe(403);
    expect(setProgramManager).not.toHaveBeenCalled();
    expect(getProgramManager).not.toHaveBeenCalled();
  });

  test("Super Admin skips the scope check entirely", async () => {
    const { getSession } = require("@/lib/auth");
    getSession.mockResolvedValue({ cid: "USR_SA", role: "super_admin" });
    getProgramManager.mockResolvedValue({
      rows: [{ id: "P1", name: "Cohort 1", assigned_pm_id: null }],
    });

    const res = await PUT(req({ manager_cid: "USR_NEW" }), ctx());

    expect(res.status).toBe(200);
    expect(isWithinScope).not.toHaveBeenCalled();
  });
});
