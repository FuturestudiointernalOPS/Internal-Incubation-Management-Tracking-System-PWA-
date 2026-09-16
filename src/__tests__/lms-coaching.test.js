/**
 * LMS COACHING REQUESTS — Phase 8 tests
 *
 * The learner→staff coaching request workflow raised from the participant LMS
 * view (before / during / after a course) and answered by program staff.
 *
 * Runs the REAL services + routes against the shared fake LMS DB.
 */

const { createFakeDb } = require("./helpers/fakeLmsDb");
const mockFake = createFakeDb();

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: mockFake.execute, transaction: mockFake.transaction },
  initDb: jest.fn(async () => {}),
}));

jest.mock("@/lib/auth", () => ({
  requireAuth: jest.fn(async () => null),
  getSession: jest.fn(async () => ({ cid: "U-LEARNER", name: "Learner", role: "participant" })),
}));

jest.mock("@/lib/authorization", () => ({
  requireAuthorization: jest.fn(async () => null),
}));

const { requireAuthorization } = require("@/lib/authorization");
const { getSession } = require("@/lib/auth");

const {
  createCoachingRequest,
  listMyCoachingRequests,
  listCoachingRequests,
  updateCoachingRequest,
  cancelCoachingRequest,
} = require("@/lib/lms/coaching");

const { GET: coachingGET, POST: coachingPOST } = require("@/app/api/lms/coaching-requests/route");
const { DELETE: coachingDELETE } = require("@/app/api/lms/coaching-requests/[id]/route");

const jsonReq = (body, url = "http://localhost/api/lms/test") =>
  new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const readJson = async (res) => res.json();

const PROGRAM = "P-2026-001";
const COURSE = "crs-1";
const LEARNER = "U-LEARNER";

function seedProgram() {
  mockFake.seed("v2_programs", [
    { id: PROGRAM, name: "Advanced Venture Creation Track", assigned_pm_id: "U-PM" },
  ]);
}

function seedCourse(overrides = {}) {
  mockFake.seed("lms_courses", [
    {
      id: COURSE,
      title: "Customer Discovery Fundamentals",
      status: "published",
      visibility: "public",
      is_free: true,
      ...overrides,
    },
  ]);
}

function seedEnrollment(overrides = {}) {
  mockFake.seed("lms_enrollments", [
    {
      id: "enr-1",
      course_id: COURSE,
      user_cid: LEARNER,
      source: "program",
      status: "active",
      program_id: PROGRAM,
      ...overrides,
    },
  ]);
}

function seedLesson() {
  mockFake.seed("lms_course_sections", [{ id: "sec-1", course_id: COURSE, title: "Intro", position: 0 }]);
  mockFake.seed("lms_lessons", [
    { id: "les-1", section_id: "sec-1", title: "Why discovery matters", position: 0, is_required: true },
  ]);
}

beforeEach(() => {
  mockFake.reset();
  jest.clearAllMocks();
  requireAuthorization.mockResolvedValue(null);
  getSession.mockResolvedValue({ cid: LEARNER, name: "Learner", role: "participant" });
});

// ─── Coaching requests ─────────────────────────────────────────────────────

describe("lms coaching requests — service", () => {
  test("a course id is required", async () => {
    await expect(createCoachingRequest({ cid: LEARNER, timing: "before" })).rejects.toThrow(
      "lms.errors.courseIdRequired",
    );
  });

  test("the course must exist", async () => {
    await expect(
      createCoachingRequest({ cid: LEARNER, courseId: "nope", timing: "before" }),
    ).rejects.toThrow("lms.errors.courseNotFound");
  });

  test("a non-enrolled learner cannot request coaching", async () => {
    seedCourse();
    await expect(
      createCoachingRequest({ cid: LEARNER, courseId: COURSE, timing: "before" }),
    ).rejects.toThrow("lms.errors.notEnrolled");
  });

  test("an invalid timing is rejected", async () => {
    seedCourse();
    seedEnrollment();
    await expect(
      createCoachingRequest({ cid: LEARNER, courseId: COURSE, timing: "whenever" }),
    ).rejects.toThrow("lms.errors.invalidCoachingTiming");
  });

  test("a lesson from another course cannot be attached", async () => {
    seedCourse();
    seedEnrollment();
    seedLesson();
    mockFake.seed("lms_courses", [{ id: "crs-2", title: "Other", status: "published" }]);
    mockFake.seed("lms_course_sections", [{ id: "sec-2", course_id: "crs-2", title: "Other", position: 0 }]);
    mockFake.seed("lms_lessons", [{ id: "les-2", section_id: "sec-2", title: "Elsewhere", position: 0 }]);
    await expect(
      createCoachingRequest({ cid: LEARNER, courseId: COURSE, lessonId: "les-2", timing: "during" }),
    ).rejects.toThrow("lms.errors.lessonNotFound");
  });

  test("creates a pending request, resolves the program and notifies staff", async () => {
    seedProgram();
    seedCourse();
    seedEnrollment();
    seedLesson();
    mockFake.seed("v2_program_staff", [{ id: 1, program_id: PROGRAM, staff_id: "U-COACH" }]);

    const result = await createCoachingRequest({
      cid: LEARNER,
      courseId: COURSE,
      lessonId: "les-1",
      timing: "during",
      topic: "Pricing",
      message: "I'm stuck on the interview script.",
    });

    expect(result.duplicate).toBe(false);
    expect(result.request.status).toBe("pending");
    expect(result.request.program_id).toBe(PROGRAM);
    expect(result.request.timing).toBe("during");
    expect(result.request.lesson_id).toBe("les-1");

    // Assigned PM + program staff are notified, the learner is not.
    const recipients = mockFake.state.v2_notifications.map((n) => String(n.recipient_id)).sort();
    expect(recipients).toEqual(["U-COACH", "U-PM"]);
  });

  test("a second ask returns the open request instead of duplicating it", async () => {
    seedProgram();
    seedCourse();
    seedEnrollment();
    await createCoachingRequest({ cid: LEARNER, courseId: COURSE, timing: "before" });
    const again = await createCoachingRequest({ cid: LEARNER, courseId: COURSE, timing: "after" });
    expect(again.duplicate).toBe(true);
    expect(again.request.timing).toBe("before"); // the original request is untouched
    expect(mockFake.state.lms_coaching_requests).toHaveLength(1);
  });

  test("the learner sees their own requests with a withdrawal option", async () => {
    seedProgram();
    seedCourse();
    seedEnrollment();
    await createCoachingRequest({ cid: LEARNER, courseId: COURSE, timing: "before" });
    const mine = await listMyCoachingRequests(LEARNER);
    expect(mine).toHaveLength(1);
    expect(mine[0].can_cancel).toBe(true);
    expect(mine[0].course_title).toBe("Customer Discovery Fundamentals");
  });

  test("the program queue is labelled with learner and course", async () => {
    seedProgram();
    seedCourse();
    seedEnrollment();
    mockFake.seed("contacts", [{ cid: LEARNER, name: "Awa Diop", email: "awa@x.test" }]);
    await createCoachingRequest({ cid: LEARNER, courseId: COURSE, timing: "after" });

    const queue = await listCoachingRequests({ programId: PROGRAM });
    expect(queue).toHaveLength(1);
    expect(queue[0].learner_name).toBe("Awa Diop");
    expect(queue[0].course_title).toBe("Customer Discovery Fundamentals");
  });

  test("the queue requires a program id", async () => {
    await expect(listCoachingRequests({})).rejects.toThrow("lms.errors.programIdRequired");
  });

  test("a staff decision is recorded and the learner informed", async () => {
    seedProgram();
    seedCourse();
    seedEnrollment();
    const { request } = await createCoachingRequest({ cid: LEARNER, courseId: COURSE, timing: "during" });
    const before = mockFake.state.v2_notifications.length;

    const updated = await updateCoachingRequest(request.id, {
      status: "accepted",
      responseNote: "Let's meet Friday.",
      handledBy: "U-PM",
    });
    expect(updated.status).toBe("accepted");
    expect(updated.response_note).toBe("Let's meet Friday.");
    expect(updated.handled_by).toBe("U-PM");
    expect(updated.handled_at).toBeTruthy();
    expect(mockFake.state.v2_notifications.length).toBe(before + 1);
    expect(String(mockFake.state.v2_notifications.at(-1).recipient_id)).toBe(LEARNER);
  });

  test("an unknown status is rejected", async () => {
    seedProgram();
    seedCourse();
    seedEnrollment();
    const { request } = await createCoachingRequest({ cid: LEARNER, courseId: COURSE, timing: "during" });
    await expect(updateCoachingRequest(request.id, { status: "maybe" })).rejects.toThrow(
      "lms.errors.invalidCoachingStatus",
    );
  });

  test("only the owner can withdraw, and only while it is open", async () => {
    seedProgram();
    seedCourse();
    seedEnrollment();
    const { request } = await createCoachingRequest({ cid: LEARNER, courseId: COURSE, timing: "during" });

    await expect(cancelCoachingRequest(request.id, "U-SOMEONE")).rejects.toThrow(
      "lms.errors.noCoachingAccess",
    );
    const cancelled = await cancelCoachingRequest(request.id, LEARNER);
    expect(cancelled.status).toBe("cancelled");
    await expect(cancelCoachingRequest(request.id, LEARNER)).rejects.toThrow(
      "lms.errors.coachingAlreadyHandled",
    );
  });
});

describe("lms coaching requests — routes", () => {
  test("POST creates the learner's request", async () => {
    seedProgram();
    seedCourse();
    seedEnrollment();
    const res = await coachingPOST(
      jsonReq({ course_id: COURSE, timing: "after", topic: "Next steps" }),
    );
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.request.course_id).toBe(COURSE);
    expect(data.request.user_cid).toBe(LEARNER);
  });

  test("GET without a program id returns the caller's own requests", async () => {
    seedProgram();
    seedCourse();
    seedEnrollment();
    await createCoachingRequest({ cid: LEARNER, courseId: COURSE, timing: "before" });
    const res = await coachingGET(new Request("http://localhost/api/lms/coaching-requests"));
    const data = await readJson(res);
    expect(data.requests).toHaveLength(1);
  });

  test("GET with a program id is gated by lms.view", async () => {
    seedProgram();
    seedCourse();
    seedEnrollment();
    await createCoachingRequest({ cid: LEARNER, courseId: COURSE, timing: "before" });

    const res = await coachingGET(
      new Request(`http://localhost/api/lms/coaching-requests?program_id=${PROGRAM}`),
    );
    const data = await readJson(res);
    expect(data.success).toBe(true);
    expect(data.requests).toHaveLength(1);
    expect(requireAuthorization).toHaveBeenCalledWith("lms", "view");
  });

  test("DELETE withdraws an owned request", async () => {
    seedProgram();
    seedCourse();
    seedEnrollment();
    const { request } = await createCoachingRequest({ cid: LEARNER, courseId: COURSE, timing: "before" });
    const res = await coachingDELETE(jsonReq({}), {
      params: Promise.resolve({ id: request.id }),
    });
    const data = await readJson(res);
    expect(data.request.status).toBe("cancelled");
  });
});
