/**
 * LMS learner experience tests (Phase 3) against the shared fake LMS DB.
 *
 * Covers ticket §45:
 *   - authentication (unauthenticated users cannot access learner APIs)
 *   - course access (enrolled ok, non-enrolled denied, no ID manipulation)
 *   - progress (idempotent completion, server-side persistence, course +
 *     section progress, completion state transition)
 *   - assessment content is never exposed to learners (no questions/answers)
 *   - admin enrollment enabler (lms.enroll authorization)
 */

const { createFakeDb } = require("./helpers/fakeLmsDb");
const mockFake = createFakeDb();

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: mockFake.execute, transaction: mockFake.transaction },
  initDb: jest.fn(async () => {}),
}));

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(async () => ({ cid: "U-LEARNER", name: "Learner", role: "participant" })),
  requireAuth: jest.fn(async () => null),
}));

jest.mock("@/lib/authorization", () => ({
  requireAuthorization: jest.fn(async () => null),
}));

const { requireAuth } = require("@/lib/auth");
const { requireAuthorization } = require("@/lib/authorization");

const {
  computeCourseProgress,
  findContinueLesson,
} = require("@/lib/lms/learning");
const {
  getLearnerCourses,
  getLearnerCourse,
  completeLesson,
  enrollLearner,
  listEnrollments,
} = require("@/lib/lms/learning");

const { GET: myLearningGET } = require("@/app/api/lms/my-learning/route");
const { GET: learnGET } = require("@/app/api/lms/courses/[id]/learn/route");
const { POST: completePOST } = require("@/app/api/lms/lessons/[id]/complete/route");
const { POST: enrollPOST } = require("@/app/api/lms/enrollments/route");
const { GET: enrollmentsGET } = require("@/app/api/lms/courses/[id]/enrollments/route");

const jsonReq = (body) =>
  new Request("http://localhost/api/lms/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const readJson = async (res) => res.json();

beforeEach(() => {
  mockFake.reset();
  requireAuth.mockResolvedValue(null);
  requireAuthorization.mockResolvedValue(null);
});

// ─── Fixtures ──────────────────────────────────────────────────────────────
const PUBLISHED = {
  id: "C-1",
  title: "Customer Discovery",
  description: "Learn customer discovery.",
  status: "published",
  is_free: true,
  visibility: "public",
  updated_at: "2026-08-27T00:00:00Z",
};
const SECTION_1 = { id: "S-1", course_id: "C-1", title: "Introduction", position: 0 };
const SECTION_2 = { id: "S-2", course_id: "C-1", title: "Interviews", position: 1 };
const LESSON_1 = {
  id: "L-1",
  section_id: "S-1",
  title: "What is Customer Discovery?",
  content_type: "video",
  youtube_video_id: "dQw4w9WgXcQ",
  is_required: true,
  position: 0,
};
const LESSON_2 = {
  id: "L-2",
  section_id: "S-1",
  title: "Why it matters",
  content_type: "video",
  youtube_video_id: "aaaaaaaaaaa",
  is_required: true,
  position: 1,
};
const LESSON_OPTIONAL = {
  id: "L-3",
  section_id: "S-2",
  title: "Optional extra",
  content_type: "video",
  youtube_video_id: "bbbbbbbbbbb",
  is_required: false,
  position: 0,
};
const LESSON_3 = {
  id: "L-4",
  section_id: "S-2",
  title: "Third required",
  content_type: "video",
  youtube_video_id: "ccccccccccc",
  is_required: true,
  position: 1,
};

function seedPublishedCourse() {
  mockFake.seed("lms_courses", [PUBLISHED]);
  mockFake.seed("lms_course_sections", [SECTION_1, SECTION_2]);
  mockFake.seed("lms_lessons", [LESSON_1, LESSON_2, LESSON_OPTIONAL]);
}

function seedEnrollment(userCid = "U-LEARNER") {
  mockFake.seed("lms_enrollments", [
    { id: "E-1", course_id: "C-1", user_cid: userCid, source: "admin", status: "active" },
  ]);
}

// ─── Pure progress logic ───────────────────────────────────────────────────

describe("computeCourseProgress (ticket §15)", () => {
  test("empty course → 0%, not started, not complete", () => {
    const p = computeCourseProgress([], {});
    expect(p).toMatchObject({ percent: 0, status: "not_started", complete: false });
  });

  test("required-based percentage with rounding", () => {
    const p = computeCourseProgress(
      [{ lessons: [LESSON_1, LESSON_2, LESSON_OPTIONAL] }],
      { "L-1": "completed" },
    );
    expect(p.percent).toBe(50); // 1 of 2 required
    expect(p.status).toBe("in_progress");
    expect(p.completedLessons).toBe(1);
    expect(p.totalLessons).toBe(3);
  });

  test("optional lessons never block completion", () => {
    const p = computeCourseProgress(
      [{ lessons: [LESSON_1, LESSON_2, LESSON_OPTIONAL] }],
      { "L-1": "completed", "L-2": "completed" },
    );
    expect(p.complete).toBe(true);
    expect(p.percent).toBe(100);
    expect(p.status).toBe("completed");
  });

  test("all-optional course completes only when every lesson is done", () => {
    const optional = [{ ...LESSON_1, is_required: false }];
    expect(computeCourseProgress([{ lessons: optional }], {}).complete).toBe(false);
    expect(
      computeCourseProgress([{ lessons: optional }], { "L-1": "completed" }).complete,
    ).toBe(true);
  });

  test("percentage rounds deterministically", () => {
    const p = computeCourseProgress(
      [{ lessons: [LESSON_1, LESSON_2, LESSON_3, LESSON_OPTIONAL] }],
      { "L-1": "completed" },
    );
    // 1 of 3 required = 33.33 → 33
    expect(p.percent).toBe(33);
  });
});

describe("findContinueLesson (resume logic, ticket §23-24)", () => {
  const sections = [{ ...SECTION_1, lessons: [LESSON_1, LESSON_2] }];

  test("never started → first lesson", () => {
    expect(findContinueLesson(sections, {})).toEqual(
      expect.objectContaining({ lessonId: "L-1" }),
    );
  });

  test("partially completed → first incomplete lesson", () => {
    expect(findContinueLesson(sections, { "L-1": "completed" })).toEqual(
      expect.objectContaining({ lessonId: "L-2" }),
    );
  });

  test("all completed → null (course complete)", () => {
    expect(findContinueLesson(sections, { "L-1": "completed", "L-2": "completed" })).toBeNull();
  });
});

// ─── Service: learner access ───────────────────────────────────────────────

describe("getLearnerCourses (My Learning)", () => {
  test("returns nothing when unenrolled", async () => {
    mockFake.seed("lms_courses", [PUBLISHED]);
    expect(await getLearnerCourses("U-NOBODY")).toEqual([]);
  });

  test("returns enrolled courses with computed progress + resume point", async () => {
    seedPublishedCourse();
    seedEnrollment();
    mockFake.seed("lms_lesson_progress", [
      { id: "P-1", enrollment_id: "E-1", lesson_id: "L-1", status: "completed" },
    ]);

    const courses = await getLearnerCourses("U-LEARNER");
    expect(courses).toHaveLength(1);
    expect(courses[0].course.title).toBe("Customer Discovery");
    expect(courses[0].progress.percent).toBe(50); // 1 of 2 required
    expect(courses[0].continueLesson.lessonId).toBe("L-2");
  });

  test("never shows courses the user is not enrolled in", async () => {
    seedPublishedCourse();
    mockFake.seed("lms_enrollments", [
      { id: "E-9", course_id: "C-1", user_cid: "U-OTHER", source: "admin", status: "active" },
    ]);
    const courses = await getLearnerCourses("U-LEARNER");
    expect(courses).toHaveLength(0);
  });
});

describe("getLearnerCourse (course access, ticket §25)", () => {
  test("non-enrolled learner is denied even knowing the course ID", async () => {
    seedPublishedCourse();
    await expect(getLearnerCourse("C-1", "U-NOBODY")).rejects.toMatchObject({
      message: "lms.errors.notEnrolled",
      status: 403,
    });
  });

  test("a learner enrolled in another course cannot read this course", async () => {
    seedPublishedCourse();
    mockFake.seed("lms_enrollments", [
      { id: "E-2", course_id: "OTHER", user_cid: "U-LEARNER", source: "admin", status: "active" },
    ]);
    await expect(getLearnerCourse("C-1", "U-LEARNER")).rejects.toMatchObject({
      status: 403,
    });
  });

  test("draft courses are never exposed to learners", async () => {
    mockFake.seed("lms_courses", [{ ...PUBLISHED, status: "draft" }]);
    seedEnrollment();
    await expect(getLearnerCourse("C-1", "U-LEARNER")).rejects.toMatchObject({ status: 403 });
  });

  test("enrolled learner gets structure, ordering and progress — no question data", async () => {
    seedPublishedCourse();
    seedEnrollment();
    mockFake.seed("lms_assessments", [
      { id: "A-1", course_id: "C-1", section_id: "S-1", title: "Quiz", position: 0 },
    ]);
    mockFake.seed("lms_assessment_questions", [
      { id: "Q-1", assessment_id: "A-1", question: "Secret?", question_type: "multiple_choice", correct_answer: "[\"B\"]", position: 0 },
    ]);
    mockFake.seed("lms_lesson_progress", [
      { id: "P-1", enrollment_id: "E-1", lesson_id: "L-1", status: "completed" },
    ]);

    const course = await getLearnerCourse("C-1", "U-LEARNER");
    expect(course.course.title).toBe("Customer Discovery");
    expect(course.sections).toHaveLength(2);
    expect(course.sections[0].lessons).toHaveLength(2);
    // Ordering preserved (position order).
    expect(course.sections[0].lessons.map((l) => l.id)).toEqual(["L-1", "L-2"]);
    // Lesson states: completed / current (resume) / not started.
    expect(course.sections[0].lessons[0].state).toBe("completed");
    expect(course.sections[0].lessons[1].state).toBe("current");
    expect(course.sections[1].lessons[0].state).toBe("not_started");
    // Progress: 1 of 2 required → 50%.
    expect(course.progress.percent).toBe(50);
    expect(course.progress.completedLessons).toBe(1);
    expect(course.continueLesson.lessonId).toBe("L-2");
    // Section progress.
    expect(course.sections[0].progress).toEqual({ completed: 1, total: 2 });
    // Assessments exist but NEVER leak questions/answers.
    expect(course.sections[0].assessment.title).toBe("Quiz");
    expect(course.sections[0].assessment.questions).toBeUndefined();
    expect(JSON.stringify(course)).not.toContain("Secret?");
    expect(JSON.stringify(course)).not.toContain("correct_answer");
  });

  test("archived courses remain accessible to enrolled learners", async () => {
    mockFake.seed("lms_courses", [{ ...PUBLISHED, status: "archived" }]);
    seedEnrollment();
    const course = await getLearnerCourse("C-1", "U-LEARNER");
    expect(course.course.status).toBe("archived");
  });
});

// ─── Service: progress mutation (ticket §26-27) ────────────────────────────

describe("completeLesson", () => {
  test("a learner cannot complete lessons without an enrollment", async () => {
    seedPublishedCourse();
    await expect(completeLesson("L-1", "U-NOBODY")).rejects.toMatchObject({ status: 403 });
  });

  test("a learner cannot complete lessons of a course they are not enrolled in", async () => {
    seedPublishedCourse();
    mockFake.seed("lms_enrollments", [
      { id: "E-2", course_id: "OTHER", user_cid: "U-LEARNER", source: "admin", status: "active" },
    ]);
    await expect(completeLesson("L-1", "U-LEARNER")).rejects.toMatchObject({ status: 403 });
  });

  test("completion is idempotent — no duplicate progress rows", async () => {
    seedPublishedCourse();
    seedEnrollment();
    await completeLesson("L-1", "U-LEARNER");
    await completeLesson("L-1", "U-LEARNER");
    const rows = mockFake.state.lms_lesson_progress.filter(
      (p) => String(p.enrollment_id) === "E-1" && String(p.lesson_id) === "L-1",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("completed");
  });

  test("progress persists server-side and updates course progress", async () => {
    seedPublishedCourse();
    seedEnrollment();
    const result = await completeLesson("L-1", "U-LEARNER");
    expect(result.courseProgress.percent).toBe(50);
    expect(result.courseProgress.complete).toBe(false);

    const second = await completeLesson("L-2", "U-LEARNER");
    expect(second.courseProgress.percent).toBe(100);
    expect(second.courseProgress.complete).toBe(true);
    expect(second.courseCompleted).toBe(true);
  });

  test("completing all required lessons marks the enrollment completed", async () => {
    seedPublishedCourse();
    seedEnrollment();
    await completeLesson("L-1", "U-LEARNER");
    expect(mockFake.state.lms_enrollments[0].status).toBe("active");

    await completeLesson("L-2", "U-LEARNER");
    expect(mockFake.state.lms_enrollments[0].status).toBe("completed");
    expect(mockFake.state.lms_enrollments[0].completed_at).toBeTruthy();
  });
});

// ─── Admin enrollment enabler ──────────────────────────────────────────────

describe("enrollLearner / listEnrollments", () => {
  test("enrolls by cid and by email (idempotent)", async () => {
    seedPublishedCourse();
    mockFake.seed("contacts", [{ cid: "U-ALICE", name: "Alice", email: "alice@future.studio" }]);

    await enrollLearner({ courseId: "C-1", userCid: "U-ALICE", source: "admin" });
    await enrollLearner({ courseId: "C-1", userEmail: "alice@future.studio", source: "admin" });

    const rows = mockFake.state.lms_enrollments.filter((e) => String(e.course_id) === "C-1");
    expect(rows).toHaveLength(1); // ON CONFLICT DO NOTHING
  });

  test("unknown email → user not found", async () => {
    seedPublishedCourse();
    await expect(
      enrollLearner({ courseId: "C-1", userEmail: "ghost@nowhere.studio" }),
    ).rejects.toMatchObject({ status: 404 });
  });

  test("listEnrollments joins learner names", async () => {
    seedPublishedCourse();
    mockFake.seed("lms_enrollments", [
      { id: "E-1", course_id: "C-1", user_cid: "U-ALICE", source: "admin", status: "active" },
    ]);
    mockFake.seed("contacts", [{ cid: "U-ALICE", name: "Alice", email: "alice@future.studio" }]);
    const rows = await listEnrollments("C-1");
    expect(rows).toHaveLength(1);
    expect(rows[0].learner.name).toBe("Alice");
  });
});

// ─── Routes (ticket §45 authentication + access) ───────────────────────────

describe("Learner API routes", () => {
  test("unauthenticated users get 401 from my-learning", async () => {
    requireAuth.mockResolvedValueOnce({ status: 401 });
    const res = await myLearningGET();
    expect(res.status).toBe(401);
  });

  test("unauthenticated users get 401 from lesson completion", async () => {
    requireAuth.mockResolvedValueOnce({ status: 401 });
    const res = await completePOST(jsonReq({}), { params: { id: "L-1" } });
    expect(res.status).toBe(401);
  });

  test("non-enrolled learner gets 403 from the learn endpoint", async () => {
    seedPublishedCourse();
    const res = await learnGET(new Request("http://localhost/x"), { params: { id: "C-1" } });
    expect(res.status).toBe(403);
  });

  test("enrolled learner loads the course", async () => {
    seedPublishedCourse();
    seedEnrollment();
    const res = await learnGET(new Request("http://localhost/x"), { params: { id: "C-1" } });
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.sections[0].lessons).toHaveLength(2);
  });

  test("double completion through the API keeps a single progress row", async () => {
    seedPublishedCourse();
    seedEnrollment();
    const first = await completePOST(jsonReq({}), { params: { id: "L-1" } });
    expect(first.status).toBe(200);
    const second = await completePOST(jsonReq({}), { params: { id: "L-1" } });
    expect(second.status).toBe(200);
    const rows = mockFake.state.lms_lesson_progress.filter(
      (p) => String(p.enrollment_id) === "E-1" && String(p.lesson_id) === "L-1",
    );
    expect(rows).toHaveLength(1);
  });

  test("admin enrollment requires lms.enroll capability", async () => {
    seedPublishedCourse();
    requireAuthorization.mockResolvedValueOnce({ status: 403 });
    const res = await enrollPOST(
      jsonReq({ courseId: "C-1", userCid: "U-ALICE" }),
    );
    expect(res.status).toBe(403);
    expect(mockFake.state.lms_enrollments).toHaveLength(0);
  });

  test("authorized admin can enroll and list learners", async () => {
    seedPublishedCourse();
    const res = await enrollPOST(jsonReq({ courseId: "C-1", userCid: "U-ALICE" }));
    expect(res.status).toBe(200);
    const list = await enrollmentsGET(new Request("http://localhost/x"), { params: { id: "C-1" } });
    expect(list.status).toBe(200);
    const data = await readJson(list);
    expect(data.enrollments).toHaveLength(1);
  });
});
