/**
 * Characterisation tests for /api/facilitator-reviews after the split into
 * `@/services/operations/facilitatorReviews`.
 *
 * They pin the submit assembly (the fixed value order), the respond-to-changes
 * branch and the PM-decision ownership rule. The model layer is mocked.
 */

const mockFacilitation = {
  listFacilitatorReviews: jest.fn(async () => ({ rows: [] })),
  ensureFacilitatorReviewColumn: jest.fn(async () => {}),
  findChangesRequestedReview: jest.fn(async () => ({ rows: [] })),
  resetReviewForResubmission: jest.fn(async () => ({})),
  createFacilitatorReview: jest.fn(async () => ({ rows: [{ id: 42 }] })),
  getReviewProgramId: jest.fn(async () => ({ rows: [] })),
  getProgramAssignedPmId: jest.fn(async () => ({ rows: [] })),
  decideFacilitatorReview: jest.fn(async () => ({})),
};

jest.mock("@/models/facilitation", () => mockFacilitation);
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [] })) },
  initDb: jest.fn(async () => true),
}));

const mockSession = { cid: "U-FAC", name: "Fac One", role: "facilitator" };
jest.mock("@/server/auth/guards", () => ({
  requireAuth: jest.fn(async () => null),
}));
jest.mock("@/server/auth/session", () => ({
  getSession: jest.fn(async () => mockSession),
}));
jest.mock("@/server/authz/guards", () => ({
  requireAssignmentAccess: jest.fn(async () => null),
}));
jest.mock("@/server/authz/capabilities", () => ({
  hasProgramManagementAccess: jest.fn((role) =>
    ["super_admin", "program_manager"].includes(role),
  ),
}));

const { POST, PUT, GET } = require("@/app/api/facilitator-reviews/route");

const jsonReq = (method, body) =>
  new Request("http://localhost/api/facilitator-reviews", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockSession.cid = "U-FAC";
  mockSession.name = "Fac One";
  mockSession.role = "facilitator";
  mockFacilitation.findChangesRequestedReview.mockResolvedValue({ rows: [] });
  mockFacilitation.createFacilitatorReview.mockResolvedValue({ rows: [{ id: 42 }] });
});

describe("POST /api/facilitator-reviews", () => {
  test("program_id is required (400)", async () => {
    const res = await POST(jsonReq("POST", { week_number: 3 }));
    expect(res.status).toBe(400);
    expect(mockFacilitation.createFacilitatorReview).not.toHaveBeenCalled();
  });

  test("the submitted values are assembled in their fixed order", async () => {
    const res = await POST(
      jsonReq("POST", {
        program_id: "P1",
        week_number: 3,
        overall_rating: "good",
        went_well: "great",
        additional_notes: "note",
      }),
    );
    expect(res.status).toBe(200);
    const [arg] = mockFacilitation.createFacilitatorReview.mock.calls[0];
    expect(arg).toMatchObject({
      program_id: "P1",
      facilitatorCid: "U-FAC",
      weekNumber: 3,
    });
    // 16 values, legacy free-form then structured; went_well is the 10th.
    expect(arg.values).toHaveLength(16);
    expect(arg.values[9]).toBe("great");
    expect(arg.values[15]).toBe("note");
  });

  test("a changes-requested review is updated in place, not duplicated", async () => {
    mockFacilitation.findChangesRequestedReview.mockResolvedValue({ rows: [{ id: 8 }] });
    const res = await POST(
      jsonReq("POST", { program_id: "P1", week_number: 3, went_well: "again" }),
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.reviewId).toBe(8);
    expect(mockFacilitation.resetReviewForResubmission).toHaveBeenCalledWith(
      8,
      expect.any(Array),
    );
    expect(mockFacilitation.createFacilitatorReview).not.toHaveBeenCalled();
  });
});

describe("PUT /api/facilitator-reviews", () => {
  test("a PM cannot decide a review for a program they do not manage (403)", async () => {
    mockSession.role = "program_manager";
    mockSession.cid = "PM-1";
    mockFacilitation.getReviewProgramId.mockResolvedValue({ rows: [{ program_id: "P9" }] });
    mockFacilitation.getProgramAssignedPmId.mockResolvedValue({ rows: [{ assigned_pm_id: "PM-2" }] });

    const res = await PUT(jsonReq("PUT", { id: 5, pm_decision: "approved" }));
    expect(res.status).toBe(403);
    expect(mockFacilitation.decideFacilitatorReview).not.toHaveBeenCalled();
  });

  test("a PM decides their own program's review", async () => {
    mockSession.role = "program_manager";
    mockSession.cid = "PM-1";
    mockFacilitation.getReviewProgramId.mockResolvedValue({ rows: [{ program_id: "P9" }] });
    mockFacilitation.getProgramAssignedPmId.mockResolvedValue({ rows: [{ assigned_pm_id: "PM-1" }] });

    const res = await PUT(jsonReq("PUT", { id: 5, pm_decision: "approved" }));
    expect(res.status).toBe(200);
    expect(mockFacilitation.decideFacilitatorReview).toHaveBeenCalledWith(
      expect.objectContaining({ id: 5, decidedBy: "PM-1" }),
    );
  });

  test("id is required (400)", async () => {
    const res = await PUT(jsonReq("PUT", { pm_decision: "approved" }));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/facilitator-reviews", () => {
  test("a non-management session reads only its own reviews", async () => {
    await GET(new Request("http://localhost/api/facilitator-reviews"));
    expect(mockFacilitation.listFacilitatorReviews).toHaveBeenCalledWith(
      expect.objectContaining({ onlyOwn: true, ownCid: "U-FAC" }),
    );
  });
});
