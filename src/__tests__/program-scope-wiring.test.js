/**
 * PROGRAM SCOPE WIRING — the guard, through a REAL route handler.
 *
 * The guard has its own unit suite; what can still break silently is the WIRING:
 * a route that never calls it, or calls it with the wrong wave, or calls it after
 * the write. This drives the actual handlers so the wiring is proven, in both
 * directions and for both shapes of route:
 *
 *   - a programme id taken straight from the body (KPI create)
 *   - a programme id LOOKED UP from the record first (KPI delete, which receives
 *     only a KPI id)
 *
 * And the property that makes the whole thing shippable is asserted first:
 * with the wave OFF the handler behaves exactly as it did before, so the
 * enforcement cannot go live by accident.
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [] })) },
  initDb: jest.fn(async () => true),
}));

jest.mock("@/lib/auth", () => ({
  requireAuth: jest.fn(async () => null),
  getSession: jest.fn(async () => ({ cid: "USR_STAFF", role: "staff", email: "s@x.test" })),
}));

jest.mock("@/lib/audit", () => ({
  logAuditEvent: jest.fn(async () => true),
}));

jest.mock("@/lib/authorization", () => ({
  getAuthorizationContext: jest.fn(async () => ({ isSuperAdmin: false })),
  requireAuthorization: jest.fn(async () => null),
}));

jest.mock("@/lib/authorization/scope", () => ({
  isWithinScope: jest.fn(async () => true),
}));

jest.mock("@/models/authorization/programScopeStrictness", () => ({
  isWaveStrict: jest.fn(async () => false),
}));

jest.mock("@/models/platformConfig", () => ({
  insertKpi: jest.fn(async () => ({ rows: [{ id: 1 }] })),
  updateKpi: jest.fn(async () => ({ rows: [] })),
  deleteKpi: jest.fn(async () => ({ rows: [] })),
  getV2KpiProgramId: jest.fn(async () => ({ rows: [{ program_id: "P1" }] })),
}));

const { isWithinScope } = require("@/lib/authorization/scope");
const { isWaveStrict } = require("@/models/authorization/programScopeStrictness");
const { insertKpi, deleteKpi, getV2KpiProgramId } = require("@/models/platformConfig");
const kpis = require("@/app/api/kpis/route");

const post = (body) =>
  new Request("http://localhost/api/kpis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const del = (body) =>
  new Request("http://localhost/api/kpis", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  jest.clearAllMocks();
  isWaveStrict.mockResolvedValue(false);
  isWithinScope.mockResolvedValue(true);
  getV2KpiProgramId.mockResolvedValue({ rows: [{ program_id: "P1" }] });
});

describe("with the wave OFF the route is unchanged", () => {
  test("creating a KPI writes, exactly as before the guard existed", async () => {
    const res = await kpis.POST(post({ program_id: "P1", title: "Reach", target_value: 10 }));

    expect(res.status).toBe(200);
    expect(insertKpi).toHaveBeenCalledWith("P1", "Reach", 10);
    // Scope is not even consulted while the wave is off.
    expect(isWithinScope).not.toHaveBeenCalled();
  });

  test("deleting a KPI writes", async () => {
    const res = await kpis.DELETE(del({ id: 7 }));

    expect(res.status).toBe(200);
    expect(deleteKpi).toHaveBeenCalledWith(7);
  });
});

describe("with the wave ON the route is scoped", () => {
  beforeEach(() => isWaveStrict.mockResolvedValue(true));

  test("creating a KPI in a programme you are not staffed on is refused, and nothing is written", async () => {
    isWithinScope.mockResolvedValueOnce(false);
    const res = await kpis.POST(post({ program_id: "P-OTHER", title: "Reach", target_value: 10 }));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(res.headers.get("X-Authz-Decision")).toBe("out-of-scope");
    expect(body.missing).toEqual({ scope: "program_staffed" });
    expect(insertKpi).not.toHaveBeenCalled();
  });

  test("creating a KPI in your own programme still works", async () => {
    isWithinScope.mockResolvedValueOnce(true);
    const res = await kpis.POST(post({ program_id: "P1", title: "Reach", target_value: 10 }));

    expect(res.status).toBe(200);
    expect(isWithinScope).toHaveBeenCalledWith(
      "program_staffed",
      "USR_STAFF",
      "P1",
      { email: "s@x.test" },
    );
    expect(insertKpi).toHaveBeenCalled();
  });

  test("deleting a KPI resolves its programme FIRST and refuses when that is out of scope", async () => {
    isWithinScope.mockResolvedValueOnce(false);
    const res = await kpis.DELETE(del({ id: 7 }));

    expect(res.status).toBe(403);
    // The owning programme had to be read for the check to be possible at all...
    expect(getV2KpiProgramId).toHaveBeenCalledWith(7);
    // ...and the write is refused rather than guessed at.
    expect(isWithinScope).toHaveBeenCalledWith(
      "program_staffed",
      "USR_STAFF",
      "P1",
      { email: "s@x.test" },
    );
    expect(deleteKpi).not.toHaveBeenCalled();
  });

  test("a KPI whose programme cannot be resolved is refused, never allowed", async () => {
    getV2KpiProgramId.mockResolvedValueOnce({ rows: [] });
    const res = await kpis.DELETE(del({ id: 7 }));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(res.headers.get("X-Authz-Decision")).toBe("unresolvable");
    expect(body.missing.reason).toBe("program-unresolvable");
    expect(deleteKpi).not.toHaveBeenCalled();
  });

  test("Super Admin is never scoped", async () => {
    const { getAuthorizationContext } = require("@/lib/authorization");
    getAuthorizationContext.mockResolvedValueOnce({ isSuperAdmin: true });
    isWithinScope.mockResolvedValueOnce(false);

    const res = await kpis.POST(post({ program_id: "P-OTHER", title: "Reach", target_value: 10 }));

    expect(res.status).toBe(200);
    expect(insertKpi).toHaveBeenCalled();
  });
});
