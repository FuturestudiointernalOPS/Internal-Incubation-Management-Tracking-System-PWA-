/**
 * THE VENTURE DIRECTORY ADMITS PEOPLE BY RELATIONSHIP, NOT BY BADGE.
 *
 * The defect this locks shut: the list of Ventures gated on the badge the
 * account carries, and that list of badges omitted "member" — the BASELINE
 * identity every account starts from. A person whose only relation to a Venture
 * is a membership (the normal case: joining must not mutate the baseline, see
 * the I6C acceptance matrix) was therefore shown a "my Ventures" door by the
 * sidebar — which derives it from the relationship — and refused the moment they
 * opened it. A team member of a Venture was refused in exactly the same way.
 *
 * These tests pin the four things that make the fix true:
 *
 *   1. The DOOR asks the guard for any signed-in person: no badge list.
 *   2. A neutral badge (member / team) that BELONGS to a Venture receives it.
 *   3. The identifier in the address can only NARROW a global role's view —
 *      asking for someone else's list never widens a non-global one.
 *   4. The delegated staff predicate is untouched: assignments, not memberships.
 *
 * The guard itself is stubbed (this file is about which question the route asks
 * it, not about how sessions are read), so the wrapper is the REAL one.
 */
const mockList = jest.fn(async () => ({ rows: [{ venture_id: "VNT-1" }] }));

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn() },
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(),
  requireAuth: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/lib/authorization", () => ({
  requireAuthorization: jest.fn().mockResolvedValue(null),
  getAuthorizationContext: jest.fn().mockResolvedValue({ isSuperAdmin: true }),
  authorize: jest.fn().mockReturnValue(true),
}));

jest.mock("@/lib/authorization/scope", () => ({
  resolveVentureScopeId: jest.fn(async (id) => id),
  isWithinScope: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/models/ventureWorkspace", () => ({
  __esModule: true,
  listVenturesWithCounts: (...args) => mockList(...args),
  recordVentureUpdatedTimeline: jest.fn(),
}));

import { getSession, requireAuth } from "@/lib/auth";

const request = (query = "") =>
  new Request(`http://localhost:3000/api/ventures${query}`);

const callRoute = async (query = "") => {
  const { GET } = await import("@/app/api/ventures/route");
  return GET(request(query));
};

beforeEach(() => {
  jest.clearAllMocks();
  requireAuth.mockResolvedValue(null); // the guard admits
  mockList.mockResolvedValue({ rows: [{ venture_id: "VNT-1" }] });
});

describe("the door", () => {
  test("asks the guard for any signed-in person, never a list of badges", async () => {
    getSession.mockResolvedValue({ cid: "USR_M", role: "member" });

    await callRoute();

    // A badge list here is what refused a baseline "member" holding a Venture.
    expect(requireAuth).toHaveBeenCalledWith();
  });
});

describe("a neutral badge that BELONGS to a Venture", () => {
  test("receives it, scoped to its own membership", async () => {
    getSession.mockResolvedValue({ cid: "USR_FOUNDER", role: "member" });

    const res = await callRoute();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.ventures).toEqual([{ venture_id: "VNT-1" }]);
    expect(mockList).toHaveBeenCalledWith({
      effectiveContactId: "USR_FOUNDER",
      assignedStaffId: null,
      status: null,
      search: null,
    });
  });

  test("a team member of a Venture is treated the same way", async () => {
    getSession.mockResolvedValue({ cid: "USR_TEAM", role: "team" });

    const res = await callRoute();

    expect(res.status).toBe(200);
    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({ effectiveContactId: "USR_TEAM", assignedStaffId: null }),
    );
  });

  test("cannot widen its view by naming someone else in the address", async () => {
    getSession.mockResolvedValue({ cid: "USR_FOUNDER", role: "member" });

    await callRoute("?contact_id=USR_SOMEONE_ELSE");

    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({ effectiveContactId: "USR_FOUNDER" }),
    );
  });
});

describe("the scoping never fails open", () => {
  test("a route that cannot establish who is asking refuses instead of listing", async () => {
    getSession.mockResolvedValue(null);

    const res = await callRoute();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe("errors.authRequired");
    expect(mockList).not.toHaveBeenCalled();
  });
});

describe("the predicates that were already settled stay settled", () => {
  test("delegated staff and program managers keep reading ASSIGNMENTS", async () => {
    for (const role of ["staff", "program_manager"]) {
      jest.clearAllMocks();
      requireAuth.mockResolvedValue(null);
      getSession.mockResolvedValue({ cid: `USR_${role}`, role });

      await callRoute("?contact_id=USR_SOMEONE_ELSE");

      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({ effectiveContactId: "USR_SOMEONE_ELSE", assignedStaffId: `USR_${role}` }),
      );
    }
  });

  test("a global role keeps the whole directory, and the address only narrows it", async () => {
    getSession.mockResolvedValue({ cid: "sa-1", role: "super_admin" });

    await callRoute("?contact_id=USR_X");

    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({ effectiveContactId: "USR_X", assignedStaffId: null }),
    );
  });
});
