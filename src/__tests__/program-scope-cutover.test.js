/**
 * PROGRAM SCOPE CUTOVER — the switch guard and the template-split action.
 *
 * Two promises that finish steps 3-6:
 *
 *   1. TURNING A WAVE ON IS BLOCKED WHILE IT IS UNSAFE. The readiness report
 *      computes the rule's two failure modes (programmes nobody manages, people
 *      left with no programme). The switch refuses while either is non-zero and
 *      returns the blockers — so "read the report first" is enforced rather than
 *      hoped for. It is not a lock: an explicit override proceeds and is audited.
 *      Turning a wave OFF is never blocked.
 *
 *   2. THE TEMPLATE SPLIT IS A DELIBERATE, AUDITED ACTION that refuses to
 *      overwrite a default an administrator chose, and reports what it took
 *      away rather than only that it succeeded.
 */

jest.mock("@/lib/authorization", () => ({
  requireAuthorization: jest.fn(async () => null),
}));

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(async () => ({ cid: "USR_SA", name: "Super Admin" })),
  logPermissionAudit: jest.fn(async () => true),
}));

jest.mock("@/models/authorization/programScopeStrictness", () => ({
  PROGRAM_SCOPE_WAVES: ["content", "enrollment", "groups"],
  getProgramScopeWaves: jest.fn(async () => ({
    content: false,
    enrollment: false,
    groups: false,
  })),
  setProgramScopeWave: jest.fn(async (wave, enabled) => ({
    success: true,
    waves: { content: wave === "content" ? enabled : false, enrollment: false, groups: false },
  })),
}));

jest.mock("@/models/authorization/programScopeReadiness", () => ({
  buildProgramScopeReadiness: jest.fn(async () => ({
    success: true,
    unmanaged: [{ id: "P1", name: "Cohort 1", status: "Active", endDate: null }],
    holders: [],
    removals: [
      { module: "ventures", capability: "edit", profile: "Program Manager", why: "x", holders: 4 },
      { module: "contacts", capability: "create", profile: "Program Manager", why: "y", holders: 4 },
    ],
    portfolioTemplates: [],
    summary: { unmanaged: 3, losesEverything: 2, holders: 4 },
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
  getProgramScopeWaves,
  setProgramScopeWave,
} = require("@/models/authorization/programScopeStrictness");
const {
  buildProgramScopeReadiness,
} = require("@/models/authorization/programScopeReadiness");
const {
  repointProgramManagerDefaultToPortfolio,
} = require("@/models/authorization/programAssignmentBackfill");

const strictnessRoute = require("@/app/api/engineering/permissions/program-scope-strictness/route");
const portfolioRoute = require("@/app/api/engineering/permissions/program-portfolio-default/route");

const denied = () => new Response("{}", { status: 403 });
const put = (body) =>
  new Request("http://localhost/api/x", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });

/** A readiness payload whose two blockers are both zero (safe to enable). */
function safeReadiness() {
  buildProgramScopeReadiness.mockResolvedValueOnce({
    success: true,
    unmanaged: [],
    holders: [],
    removals: [],
    portfolioTemplates: [],
    summary: { unmanaged: 0, losesEverything: 0, holders: 0 },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  requireAuthorization.mockResolvedValue(null);
  getProgramScopeWaves.mockResolvedValue({ content: false, enrollment: false, groups: false });
  setProgramScopeWave.mockImplementation(async (wave, enabled) => ({
    success: true,
    waves: { content: wave === "content" ? enabled : false, enrollment: false, groups: false },
  }));
  buildProgramScopeReadiness.mockResolvedValue({
    success: true,
    unmanaged: [{ id: "P1", name: "Cohort 1", status: "Active", endDate: null }],
    holders: [],
    removals: [
      { module: "ventures", capability: "edit", profile: "Program Manager", why: "x", holders: 4 },
      { module: "contacts", capability: "create", profile: "Program Manager", why: "y", holders: 4 },
    ],
    portfolioTemplates: [],
    summary: { unmanaged: 3, losesEverything: 2, holders: 4 },
  });
  repointProgramManagerDefaultToPortfolio.mockResolvedValue({
    success: true,
    changed: true,
    from: "Program Manager",
    to: "Program Manager (Portfolio)",
  });
});

describe("the rollout switch — validation and authority", () => {
  test("reading the switch state requires the matrix read", async () => {
    await strictnessRoute.GET();
    expect(requireAuthorization).toHaveBeenCalledWith("permissions", "view_matrix");
  });

  test("writing the switch requires the capability assignment authority", async () => {
    await strictnessRoute.PUT(put({ wave: "content", enabled: true }));
    expect(requireAuthorization).toHaveBeenCalledWith("permissions", "assign_capabilities");
  });

  test("a denial writes nothing", async () => {
    requireAuthorization.mockResolvedValueOnce(denied());
    const res = await strictnessRoute.PUT(put({ wave: "content", enabled: true }));

    expect(res.status).toBe(403);
    expect(setProgramScopeWave).not.toHaveBeenCalled();
  });

  test("an unknown wave or a non-boolean is a 400 with no write", async () => {
    expect((await strictnessRoute.PUT(put({ wave: "nope", enabled: true }))).status).toBe(400);
    expect((await strictnessRoute.PUT(put({ wave: "content", enabled: "yes" }))).status).toBe(400);
    expect(setProgramScopeWave).not.toHaveBeenCalled();
  });
});

describe("the switch refuses to remove access while it is unsafe", () => {
  test("enabling is REFUSED (409) while blockers remain, and names them", async () => {
    const res = await strictnessRoute.PUT(put({ wave: "content", enabled: true }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.reason).toBe("not-safe-to-enable");
    expect(body.blockers).toEqual({ unmanaged: 3, losesEverything: 2 });
    // The worklist travels with the refusal so the caller can render it.
    expect(body.unmanaged).toHaveLength(1);
    expect(setProgramScopeWave).not.toHaveBeenCalled();
  });

  test("an explicit override proceeds", async () => {
    const res = await strictnessRoute.PUT(
      put({ wave: "content", enabled: true, override: true }),
    );

    expect(res.status).toBe(200);
    expect(setProgramScopeWave).toHaveBeenCalledWith("content", true);
    // ...and the override is on the record.
    expect(logPermissionAudit).toHaveBeenCalledWith(
      expect.objectContaining({ details: expect.stringContaining("safety override") }),
    );
  });

  test("TURNING OFF is never blocked", async () => {
    getProgramScopeWaves.mockResolvedValueOnce({ content: true, enrollment: false, groups: false });
    const res = await strictnessRoute.PUT(put({ wave: "content", enabled: false }));

    expect(res.status).toBe(200);
    expect(setProgramScopeWave).toHaveBeenCalledWith("content", false);
    // The blockers were not even computed: this direction restores access.
    expect(buildProgramScopeReadiness).not.toHaveBeenCalled();
  });

  test("a safe wave enables without an override", async () => {
    safeReadiness();
    const res = await strictnessRoute.PUT(put({ wave: "content", enabled: true }));

    expect(res.status).toBe(200);
    expect(setProgramScopeWave).toHaveBeenCalledWith("content", true);
  });

  test("the change is audited with both sides", async () => {
    safeReadiness();
    await strictnessRoute.PUT(put({ wave: "content", enabled: true }));

    expect(logPermissionAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "program_scope_changed",
        previousValue: "false",
        newValue: "true",
        targetName: "program scope: content",
      }),
    );
  });
});

describe("the template split — a deliberate, reversible action", () => {
  test("reading the impact changes nothing", async () => {
    const res = await portfolioRoute.GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.impact.peopleAffected).toBe(4);
    expect(body.impact.removals).toHaveLength(2);
    expect(repointProgramManagerDefaultToPortfolio).not.toHaveBeenCalled();
  });

  test("the write requires the capability assignment authority", async () => {
    await portfolioRoute.PUT();
    expect(requireAuthorization).toHaveBeenCalledWith("permissions", "assign_capabilities");
  });

  test("a denial repoints nothing", async () => {
    requireAuthorization.mockResolvedValueOnce(denied());
    expect((await portfolioRoute.PUT()).status).toBe(403);
    expect(repointProgramManagerDefaultToPortfolio).not.toHaveBeenCalled();
  });

  test("a customized default is refused, with the current profile reported", async () => {
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
});
