/**
 * THE TEMPLATE SPLIT — a deliberate, audited, reversible action.
 *
 * Creating the trimmed portfolio template changes nobody. Pointing the
 * programme-manager role default AT it is what removes `ventures.edit` and
 * `contacts.create` from everyone who resolves through their identity — a job
 * that belongs to the venture and CRM responsibilities. So it must be an action
 * somebody takes on purpose, with the impact in front of them, and it must say
 * what it removed rather than only that it succeeded.
 *
 * Locked here:
 *   - reading the impact writes nothing;
 *   - the write needs the capability-assignment authority;
 *   - a default an administrator set by hand is REFUSED, not overwritten;
 *   - success reports what was taken away and how many people it affected;
 *   - the change is audited with both templates;
 *   - re-running it is a no-op that reports why.
 *
 * (The rollout switch this file used to cover is gone: the program scope rule is
 * enforced unconditionally, so there is no switch to test. Coverage is held to
 * account by program-scope-coverage.test.js and the guard by
 * program-scoped-access.test.js.)
 */

jest.mock("@/lib/authorization", () => ({
  requireAuthorization: jest.fn(async () => null),
}));

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(async () => ({ cid: "USR_SA", name: "Super Admin" })),
  logPermissionAudit: jest.fn(async () => true),
}));

jest.mock("@/models/authorization/programScopeReadiness", () => ({
  buildProgramScopeReadiness: jest.fn(async () => ({
    success: true,
    unmanaged: [],
    holders: [],
    removals: [
      { module: "ventures", capability: "edit", profile: "Program Manager", why: "x", holders: 4 },
      { module: "contacts", capability: "create", profile: "Program Manager", why: "y", holders: 4 },
    ],
    portfolioTemplates: [],
    coverage: [],
    summary: { unmanaged: 0, losesEverything: 0, holders: 4 },
  })),
}));

jest.mock("@/models/authorization/programAssignmentBackfill", () => ({
  repointProgramManagerDefaultToPortfolio: jest.fn(async () => ({
    success: true,
    changed: true,
    from: "Program Manager",
    to: "Program Manager (Portfolio)",
  })),
}));

const { requireAuthorization } = require("@/lib/authorization");
const { logPermissionAudit } = require("@/lib/auth");
const {
  buildProgramScopeReadiness,
} = require("@/models/authorization/programScopeReadiness");
const {
  repointProgramManagerDefaultToPortfolio,
} = require("@/models/authorization/programAssignmentBackfill");

const portfolioRoute = require("@/app/api/engineering/permissions/program-portfolio-default/route");

const denied = () => new Response("{}", { status: 403 });

beforeEach(() => {
  jest.clearAllMocks();
  requireAuthorization.mockResolvedValue(null);
  repointProgramManagerDefaultToPortfolio.mockResolvedValue({
    success: true,
    changed: true,
    from: "Program Manager",
    to: "Program Manager (Portfolio)",
  });
});

describe("reading the impact", () => {
  test("the read requires the matrix read capability and changes nothing", async () => {
    const res = await portfolioRoute.GET();
    const body = await res.json();

    expect(requireAuthorization).toHaveBeenCalledWith("permissions", "view_matrix");
    expect(res.status).toBe(200);
    expect(body.impact.peopleAffected).toBe(4);
    expect(body.impact.removals).toHaveLength(2);
    expect(repointProgramManagerDefaultToPortfolio).not.toHaveBeenCalled();
  });
});

describe("the write", () => {
  test("requires the capability assignment authority", async () => {
    await portfolioRoute.PUT();
    expect(requireAuthorization).toHaveBeenCalledWith("permissions", "assign_capabilities");
  });

  test("a denial repoints nothing", async () => {
    requireAuthorization.mockResolvedValueOnce(denied());
    expect((await portfolioRoute.PUT()).status).toBe(403);
    expect(repointProgramManagerDefaultToPortfolio).not.toHaveBeenCalled();
  });

  test("a hand-set default is REFUSED, with the current profile reported", async () => {
    repointProgramManagerDefaultToPortfolio.mockResolvedValueOnce({
      success: false,
      changed: false,
      error: "role-default-customized",
      currentProfileId: 42,
    });

    const res = await portfolioRoute.PUT();
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.reason).toBe("role-default-customized");
    expect(body.currentProfileId).toBe(42);
    expect(logPermissionAudit).not.toHaveBeenCalled();
  });

  test("success reports what it TOOK AWAY, not only that it worked", async () => {
    const res = await portfolioRoute.PUT();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.changed).toBe(true);
    expect(body.to).toBe("Program Manager (Portfolio)");
    expect(body.removed.sort()).toEqual(["contacts.create", "ventures.edit"]);
    expect(body.peopleAffected).toBe(4);
  });

  test("the repoint is audited with previous and new templates", async () => {
    await portfolioRoute.PUT();

    expect(logPermissionAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "access_profile_changed",
        previousValue: "Program Manager",
        newValue: "Program Manager (Portfolio)",
      }),
    );
  });

  test("re-running it is a no-op that reports why", async () => {
    repointProgramManagerDefaultToPortfolio.mockResolvedValueOnce({
      success: true,
      changed: false,
      reason: "already-repointed",
      to: "Program Manager (Portfolio)",
    });

    const body = await (await portfolioRoute.PUT()).json();
    expect(body.changed).toBe(false);
    expect(body.reason).toBe("already-repointed");
    // Nothing changed, so nothing is claimed in the audit trail.
    expect(logPermissionAudit).not.toHaveBeenCalled();
  });

  test("the impact is read BEFORE the write, so the report describes the effect", async () => {
    await portfolioRoute.PUT();
    expect(buildProgramScopeReadiness).toHaveBeenCalledTimes(1);
  });
});
