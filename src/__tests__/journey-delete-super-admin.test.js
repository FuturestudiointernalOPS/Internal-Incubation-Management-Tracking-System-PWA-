/**
 * POST /api/ventures/[id]/journey/delete — SUPER ADMIN ONLY.
 *
 * Permanent deletion of a journey (and the milestones/tasks under it) is never
 * delegated: a delegated assignment may archive and restore, but not destroy.
 * These pin both halves of that rule:
 *
 *   1. the route asks the policy for the super-admin-only action `"delete"` —
 *      NOT the softer `"manage"` a Lead Manager also holds;
 *   2. a Lead Manager the policy refuses gets a 403 that points at archive,
 *      and nothing is touched (not even the journey table self-heal);
 *   3. members keep the 404 — the plan engine stays invisible to them;
 *   4. the Super Admin's delete still deletes.
 */

const mockSession = { current: { cid: "sa-1", role: "super_admin" } };
jest.mock("@/server/auth/session", () => ({
  getSession: jest.fn(async () => mockSession.current),
}));

const mockPlans = {
  resolvePlanAccess: jest.fn(),
  allowsPlanAction: jest.fn(),
};
jest.mock("@/services/ventures/operatingPlans", () => ({
  resolvePlanAccess: jest.fn((...a) => mockPlans.resolvePlanAccess(...a)),
  allowsPlanAction: jest.fn((...a) => mockPlans.allowsPlanAction(...a)),
}));

const mockJourney = {
  ensureJourneyTable: jest.fn(),
  resolveVentureInternalId: jest.fn(),
  listJourneyStages: jest.fn(),
  deleteJourneyStages: jest.fn(),
};
jest.mock("@/services/ventures/journey", () => ({
  ensureJourneyTable: jest.fn((...a) => mockJourney.ensureJourneyTable(...a)),
  resolveVentureInternalId: jest.fn((...a) => mockJourney.resolveVentureInternalId(...a)),
  listJourneyStages: jest.fn((...a) => mockJourney.listJourneyStages(...a)),
  deleteJourneyStages: jest.fn((...a) => mockJourney.deleteJourneyStages(...a)),
}));

const { POST } = require("@/app/api/ventures/[id]/journey/delete/route");
const { allowsPlanAction } = require("@/services/ventures/operatingPlans");

const ctx = { params: Promise.resolve({ id: "VNT-1" }) };
const req = (body) =>
  new Request("http://localhost/api/ventures/VNT-1/journey/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

/** A Lead Manager: manage = true, delete = false — exactly the policy's answer. */
const asLeadManager = () => {
  mockSession.current = { cid: "lm-1", role: "staff" };
  mockPlans.resolvePlanAccess.mockResolvedValue({
    ok: true,
    global: false,
    code: "VNT-1",
    assignments: [{ responsibility_code: "lead_manager", scope_type: "venture_wide" }],
  });
  mockPlans.allowsPlanAction.mockImplementation(async (_access, action) => action !== "delete");
};

const asSuperAdmin = () => {
  mockSession.current = { cid: "sa-1", role: "super_admin" };
  mockPlans.resolvePlanAccess.mockResolvedValue({ ok: true, global: true, code: "VNT-1", assignments: [] });
  mockPlans.allowsPlanAction.mockResolvedValue(true);
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSession.current = { cid: "sa-1", role: "super_admin" };
  mockJourney.ensureJourneyTable.mockResolvedValue(undefined);
  mockJourney.resolveVentureInternalId.mockResolvedValue("db-1");
  mockJourney.listJourneyStages.mockResolvedValue([]);
  mockJourney.deleteJourneyStages.mockResolvedValue({ deleted: [{ id: "s1", title: "Journey One" }], blocked: [] });
});

describe("the gate", () => {
  test("asks the policy for the super-admin-only action, once", async () => {
    asSuperAdmin();

    await POST(req({ ids: ["s1"] }), ctx);

    expect(allowsPlanAction).toHaveBeenCalledTimes(1);
    expect(allowsPlanAction.mock.calls[0][1]).toBe("delete");
  });

  test("a Lead Manager may manage — and is still refused the delete, told to archive", async () => {
    asLeadManager();

    const res = await POST(req({ ids: ["s1"] }), ctx);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/super admin/i);
    expect(body.error).toMatch(/archive/i);
    // Nothing was touched — not even the journey table self-heal.
    expect(mockJourney.ensureJourneyTable).not.toHaveBeenCalled();
    expect(mockJourney.deleteJourneyStages).not.toHaveBeenCalled();
  });

  test("a member with no plan access keeps the 404 — the engine stays invisible", async () => {
    mockSession.current = { cid: "f-1", role: "founder" };
    mockPlans.resolvePlanAccess.mockResolvedValue({ ok: false });
    mockPlans.allowsPlanAction.mockResolvedValue(false);

    const res = await POST(req({ ids: ["s1"] }), ctx);

    expect(res.status).toBe(404);
    expect(allowsPlanAction).not.toHaveBeenCalled();
    expect(mockJourney.deleteJourneyStages).not.toHaveBeenCalled();
  });
});

describe("the Super Admin's delete", () => {
  test("deletes the selected journeys and returns the fresh stage list", async () => {
    asSuperAdmin();

    const res = await POST(req({ ids: ["s1"] }), ctx);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.deleted).toHaveLength(1);
    expect(mockJourney.deleteJourneyStages).toHaveBeenCalledWith({ dbId: "db-1", stageIds: ["s1"] });
  });

  test("an empty selection is a 400 and deletes nothing", async () => {
    asSuperAdmin();

    const res = await POST(req({ ids: [] }), ctx);

    expect(res.status).toBe(400);
    expect(mockJourney.deleteJourneyStages).not.toHaveBeenCalled();
  });
});
