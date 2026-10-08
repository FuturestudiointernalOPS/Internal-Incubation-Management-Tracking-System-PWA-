/**
 * GET /api/ventures/[id]/work-items — the Project Management read (Phase 1).
 *
 * Locks the route's contract:
 *   1. It is gated on `ventures.view` THROUGH THE SCOPE-AWARE helper, so a
 *      Venture Manager sees their own work and nobody else's.
 *   2. Nothing that resolves to no Venture is answered with a 200.
 *   3. The payload is the service's, unreshaped — the controller owns transport,
 *      not meaning.
 *   4. IT IS READ-ONLY. Phase 1 ships no writer, and this test fails the moment
 *      one is added to this module without that being a deliberate decision.
 */
let mockAccess = { session: { cid: "C1", role: "super_admin" } };
jest.mock("@/lib/ventureScopedAccess", () => ({
  requireVentureScopedAccess: jest.fn(async () => mockAccess),
}));

let mockDbId = "db-1";
jest.mock("@/lib/ventureOwnership", () => ({
  resolveVentureDbId: jest.fn(async () => mockDbId),
}));

jest.mock("@/lib/db", () => ({ initDb: jest.fn(async () => ({})) }));

const SERVICE_RESULT = {
  items: [{ id: "activity:1", kind: "activity", title: "Validate demand", bucket: "upcoming" }],
  options: { owners: ["Amina"], supporting: ["David"], journeys: [], milestones: [], statuses: [], kinds: [] },
  summary: { total: 1, today: 0, upcoming: 1, overdue: 0, completed: 0 },
  today: "2026-10-06",
};
jest.mock("@/services/workItems", () => ({
  buildWorkItems: jest.fn(async () => SERVICE_RESULT),
}));

const { requireVentureScopedAccess } = require("@/lib/ventureScopedAccess");
const { buildWorkItems } = require("@/services/workItems");

function callRoute(id = "VNT-KORAHCK") {
  const route = require("@/app/api/ventures/[id]/work-items/route");
  return route.GET(new Request(`http://localhost/api/ventures/${id}/work-items`), {
    params: Promise.resolve({ id }),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAccess = { session: { cid: "C1", role: "super_admin" } };
  mockDbId = "db-1";
});

describe("the gate", () => {
  test("asks for ventures.view through the scope-aware helper", async () => {
    await callRoute();

    expect(requireVentureScopedAccess).toHaveBeenCalledWith({
      ventureId: "VNT-KORAHCK",
      module: "ventures",
      capability: "view",
    });
  });

  test("returns the helper's refusal untouched when the caller may not read", async () => {
    const refusal = { status: 403, body: { error: "errors.insufficientPermissions" } };
    mockAccess = {
      error: {
        status: 403,
        json: async () => refusal.body,
      },
    };

    const response = await callRoute();

    expect(response.status).toBe(403);
    expect(buildWorkItems).not.toHaveBeenCalled();
  });

  test("404s an address that resolves to no Venture, without reading work", async () => {
    mockDbId = null;

    const response = await callRoute("VNT-NOPE");

    expect(response.status).toBe(404);
    expect(buildWorkItems).not.toHaveBeenCalled();
  });
});

describe("the payload", () => {
  test("returns the service's items, options, summary and today", async () => {
    const response = await callRoute();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, ...SERVICE_RESULT });
  });

  test("reads the Venture by BOTH its id forms, so legacy rows are found too", async () => {
    await callRoute("VNT-KORAHCK");

    expect(buildWorkItems).toHaveBeenCalledWith({ dbId: "db-1", ventureCode: "VNT-KORAHCK" });
  });
});

describe("Phase 1 is read-only", () => {
  test("the module exposes GET and no writer", () => {
    const route = require("@/app/api/ventures/[id]/work-items/route");

    expect(typeof route.GET).toBe("function");
    for (const writer of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect(route[writer]).toBeUndefined();
    }
  });
});
