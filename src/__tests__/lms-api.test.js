/**
 * LMS API tests (Phase 2 — course authoring) against the shared fake LMS DB
 * (see ./helpers/fakeLmsDb.js). The REAL services + routes run end-to-end:
 * authorization gating, validation, status transitions, YouTube normalization,
 * safe-delete guards.
 *
 * Covers ticket §31 (authorization) and §35 (CRUD, sections, lessons, YouTube,
 * assessments, questions, publishing).
 */

const { createFakeDb } = require("./helpers/fakeLmsDb");
const mockFake = createFakeDb();

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: mockFake.execute, transaction: mockFake.transaction },
  initDb: jest.fn(async () => {}),
}));

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(async () => ({ cid: "U-ADMIN", name: "Admin", role: "super_admin" })),
}));

jest.mock("@/lib/authorization", () => ({
  requireAuthorization: jest.fn(async () => null),
}));

const { requireAuthorization } = require("@/lib/authorization");

// ─── Route modules under test ──────────────────────────────────────────────
const { GET: coursesGET, POST: coursesPOST } = require("@/app/api/lms/courses/route");
const {
  GET: courseGET,
  PUT: coursePUT,
  DELETE: courseDELETE,
} = require("@/app/api/lms/courses/[id]/route");
const { POST: publishPOST } = require("@/app/api/lms/courses/[id]/publish/route");
const { POST: archivePOST } = require("@/app/api/lms/courses/[id]/archive/route");
const { POST: sectionsPOST } = require("@/app/api/lms/courses/[id]/sections/route");
const {
  PUT: sectionPUT,
  DELETE: sectionDELETE,
} = require("@/app/api/lms/sections/[id]/route");
const { POST: lessonsPOST } = require("@/app/api/lms/sections/[id]/lessons/route");
const { PUT: lessonPUT, DELETE: lessonDELETE } = require("@/app/api/lms/lessons/[id]/route");
const { POST: assessmentsPOST } = require("@/app/api/lms/courses/[id]/assessments/route");
const { PUT: assessmentPUT } = require("@/app/api/lms/assessments/[id]/route");
const { POST: questionsPOST } = require("@/app/api/lms/assessments/[id]/questions/route");

const jsonReq = (body) =>
  new Request("http://localhost/api/lms/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const readJson = async (res) => res.json();

beforeEach(() => {
  mockFake.reset();
  requireAuthorization.mockResolvedValue(null);
});

describe("Courses — create/list/update/delete", () => {
  test("POST creates a draft course with the session as creator", async () => {
    const res = await coursesPOST(jsonReq({ title: "Customer Discovery" }));
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.success).toBe(true);
    expect(data.course.status).toBe("draft");
    expect(data.course.title).toBe("Customer Discovery");

    const insert = mockFake.executed.find((q) => /insert into lms_courses/i.test(q.sql));
    expect(insert).toBeDefined();
    expect(insert.args).toContain("U-ADMIN");
    expect(insert.args).toContain("public");
    expect(insert.args).toContain(true); // is_free
  });

  test("POST without a title returns 400 and never inserts", async () => {
    const res = await coursesPOST(jsonReq({}));
    expect(res.status).toBe(400);
    expect(mockFake.executed.some((q) => /insert into lms_courses/i.test(q.sql))).toBe(false);
  });

  test("POST with a paid price persists price metadata", async () => {
    const res = await coursesPOST(
      jsonReq({ title: "Paid Course", is_free: false, price: 49.99 }),
    );
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.course.is_free).toBe(false);
    const insert = mockFake.executed.find((q) => /insert into lms_courses/i.test(q.sql));
    expect(insert.args).toContain(49.99);
  });

  test("POST with an invalid price returns 400", async () => {
    const res = await coursesPOST(jsonReq({ title: "X", is_free: false, price: -5 }));
    expect(res.status).toBe(400);
  });

  test("GET lists courses", async () => {
    mockFake.seed("lms_courses", [
      { id: "C-1", title: "A", status: "draft", is_free: true, visibility: "public", updated_at: "2026-08-27T00:00:00Z" },
      { id: "C-2", title: "B", status: "published", is_free: true, visibility: "public", updated_at: "2026-08-27T00:00:00Z" },
    ]);
    const res = await coursesGET(new Request("http://localhost/api/lms/courses"));
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.courses).toHaveLength(2);
  });

  test("PUT updates course metadata", async () => {
    mockFake.seed("lms_courses", [
      { id: "C-1", title: "A", status: "draft", is_free: true, visibility: "public", updated_at: "2026-08-27T00:00:00Z" },
    ]);
    const res = await coursePUT(jsonReq({ title: "Renamed" }), { params: { id: "C-1" } });
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.course.title).toBe("Renamed");
  });

  test("DELETE refuses published courses", async () => {
    mockFake.seed("lms_courses", [
      { id: "C-1", title: "A", status: "published", is_free: true, visibility: "public", updated_at: "2026-08-27T00:00:00Z" },
    ]);
    const res = await courseDELETE(jsonReq({}), { params: { id: "C-1" } });
    expect(res.status).toBe(409);
  });

  test("DELETE refuses draft courses with enrollments", async () => {
    mockFake.seed("lms_courses", [
      { id: "C-1", title: "A", status: "draft", is_free: true, visibility: "public", updated_at: "2026-08-27T00:00:00Z" },
    ]);
    mockFake.seed("lms_enrollments", [{ id: "E-1", course_id: "C-1", user_cid: "U-1" }]);
    const res = await courseDELETE(jsonReq({}), { params: { id: "C-1" } });
    expect(res.status).toBe(409);
  });

  test("DELETE removes an empty draft course", async () => {
    mockFake.seed("lms_courses", [
      { id: "C-1", title: "A", status: "draft", is_free: true, visibility: "public", updated_at: "2026-08-27T00:00:00Z" },
    ]);
    const res = await courseDELETE(jsonReq({}), { params: { id: "C-1" } });
    expect(res.status).toBe(200);
    expect(mockFake.executed.some((q) => /delete from lms_courses/i.test(q.sql))).toBe(true);
  });

  test("GET returns the full structure", async () => {
    mockFake.seed("lms_courses", [
      { id: "C-1", title: "A", status: "draft", is_free: true, visibility: "public", updated_at: "2026-08-27T00:00:00Z" },
    ]);
    mockFake.seed("lms_course_sections", [{ id: "S-1", course_id: "C-1", title: "Intro", position: 0 }]);
    mockFake.seed("lms_lessons", [
      { id: "L-1", section_id: "S-1", title: "L1", content_type: "video", youtube_video_id: "dQw4w9WgXcQ", position: 0 },
    ]);
    mockFake.seed("lms_assessments", [
      { id: "A-1", course_id: "C-1", section_id: "S-1", title: "Quiz", position: 0 },
      { id: "A-2", course_id: "C-1", section_id: null, title: "Final", position: 1 },
    ]);
    mockFake.seed("lms_assessment_questions", [
      { id: "Q-1", assessment_id: "A-1", question: "Q?", question_type: "multiple_choice", position: 0 },
    ]);
    const res = await courseGET(new Request("http://localhost/api/lms/test"), { params: { id: "C-1" } });
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.course.sections).toHaveLength(1);
    expect(data.course.sections[0].lessons).toHaveLength(1);
    expect(data.course.sections[0].assessment.id).toBe("A-1");
    expect(data.course.sections[0].assessment.questions).toHaveLength(1);
    expect(data.course.courseAssessments).toHaveLength(1);
    expect(data.course.courseAssessments[0].questions).toHaveLength(0);
  });
});

describe("Publishing", () => {
  const draftCourse = { id: "C-1", title: "A", status: "draft", is_free: true, visibility: "public", updated_at: "2026-08-27T00:00:00Z" };
  const validSection = { id: "S-1", course_id: "C-1", title: "Intro", position: 0 };
  const validLesson = { id: "L-1", section_id: "S-1", title: "L1", content_type: "video", youtube_video_id: "dQw4w9WgXcQ", position: 0 };

  test("a draft with content publishes", async () => {
    mockFake.seed("lms_courses", [draftCourse]);
    mockFake.seed("lms_course_sections", [validSection]);
    mockFake.seed("lms_lessons", [validLesson]);
    const res = await publishPOST(jsonReq({}), { params: { id: "C-1" } });
    expect(res.status).toBe(200);
    const update = mockFake.executed.find((q) => /update lms_courses.*status = 'published'/i.test(q.sql));
    expect(update).toBeDefined();
  });

  test("an empty course cannot publish — 422 with field-level details", async () => {
    mockFake.seed("lms_courses", [draftCourse]);
    const res = await publishPOST(jsonReq({}), { params: { id: "C-1" } });
    expect(res.status).toBe(422);
    const data = await readJson(res);
    expect(data.details).toBeDefined();
    const keys = data.details.map((d) => d.key);
    expect(keys).toContain("lms.errors.noSections");
    expect(keys).toContain("lms.errors.noLessons");
  });

  test("a lesson without a video cannot publish", async () => {
    mockFake.seed("lms_courses", [draftCourse]);
    mockFake.seed("lms_course_sections", [validSection]);
    mockFake.seed("lms_lessons", [{ ...validLesson, youtube_video_id: null }]);
    const res = await publishPOST(jsonReq({}), { params: { id: "C-1" } });
    expect(res.status).toBe(422);
    const data = await readJson(res);
    expect(data.details.map((d) => d.key)).toContain("lms.errors.lessonVideoRequired");
  });

  test("archived courses cannot be published", async () => {
    mockFake.seed("lms_courses", [{ ...draftCourse, status: "archived" }]);
    const res = await publishPOST(jsonReq({}), { params: { id: "C-1" } });
    expect(res.status).toBe(409);
  });

  test("archiving a published course succeeds; archiving a draft is refused", async () => {
    mockFake.seed("lms_courses", [{ ...draftCourse, status: "published" }]);
    const ok = await archivePOST(jsonReq({}), { params: { id: "C-1" } });
    expect(ok.status).toBe(200);

    mockFake.seed("lms_courses", [{ ...draftCourse, id: "C-2" }]);
    const refused = await archivePOST(jsonReq({}), { params: { id: "C-2" } });
    expect(refused.status).toBe(409);
  });
});

describe("Sections", () => {
  test("POST creates a section at the next position", async () => {
    mockFake.seed("lms_courses", [{ id: "C-1", title: "A", status: "draft", is_free: true, visibility: "public" }]);
    const res = await sectionsPOST(jsonReq({ title: "Intro" }), { params: { id: "C-1" } });
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.section.course_id).toBe("C-1");
    expect(data.section.position).toBe(0);
  });

  test("PUT moves a section down (transaction swap)", async () => {
    mockFake.seed("lms_course_sections", [
      { id: "S-1", course_id: "C-1", title: "A", position: 0 },
      { id: "S-2", course_id: "C-1", title: "B", position: 1 },
    ]);
    const res = await sectionPUT(jsonReq({ action: "move", direction: "down" }), { params: { id: "S-1" } });
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.moved).toBe(true);
    const s1 = mockFake.state.lms_course_sections.find((s) => s.id === "S-1");
    const s2 = mockFake.state.lms_course_sections.find((s) => s.id === "S-2");
    expect(s1.position).toBe(1);
    expect(s2.position).toBe(0);
  });

  test("DELETE refuses when a lesson in the section has progress", async () => {
    mockFake.seed("lms_course_sections", [{ id: "S-1", course_id: "C-1", title: "A", position: 0 }]);
    mockFake.seed("lms_lessons", [{ id: "L-1", section_id: "S-1", title: "L", position: 0 }]);
    mockFake.seed("lms_lesson_progress", [{ id: "P-1", lesson_id: "L-1", enrollment_id: "E-1" }]);
    const res = await sectionDELETE(jsonReq({}), { params: { id: "S-1" } });
    expect(res.status).toBe(409);
  });

  test("DELETE removes an empty section", async () => {
    mockFake.seed("lms_course_sections", [{ id: "S-1", course_id: "C-1", title: "A", position: 0 }]);
    const res = await sectionDELETE(jsonReq({}), { params: { id: "S-1" } });
    expect(res.status).toBe(200);
  });
});

describe("Lessons & YouTube", () => {
  test("POST normalizes a YouTube URL into the video ID", async () => {
    mockFake.seed("lms_course_sections", [{ id: "S-1", course_id: "C-1", title: "A", position: 0 }]);
    const res = await lessonsPOST(
      jsonReq({ title: "L1", youtubeVideoId: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }),
      { params: { id: "S-1" } },
    );
    expect(res.status).toBe(200);
    const insert = mockFake.executed.find((q) => /insert into lms_lessons/i.test(q.sql));
    expect(insert).toBeDefined();
    expect(insert.args).toContain("dQw4w9WgXcQ");
  });

  test("POST with an invalid YouTube value returns 400", async () => {
    mockFake.seed("lms_course_sections", [{ id: "S-1", course_id: "C-1", title: "A", position: 0 }]);
    const res = await lessonsPOST(
      jsonReq({ title: "L1", youtubeVideoId: "https://vimeo.com/123" }),
      { params: { id: "S-1" } },
    );
    expect(res.status).toBe(400);
    expect(mockFake.executed.some((q) => /insert into lms_lessons/i.test(q.sql))).toBe(false);
  });

  test("POST requires a lesson title", async () => {
    mockFake.seed("lms_course_sections", [{ id: "S-1", course_id: "C-1", title: "A", position: 0 }]);
    const res = await lessonsPOST(jsonReq({ title: "" }), { params: { id: "S-1" } });
    expect(res.status).toBe(400);
  });

  test("PUT updates lesson fields", async () => {
    mockFake.seed("lms_lessons", [
      { id: "L-1", section_id: "S-1", title: "Old", content_type: "video", youtube_video_id: null, is_required: true, position: 0 },
    ]);
    const res = await lessonPUT(
      jsonReq({ title: "New", isRequired: false, youtubeVideoId: "https://youtu.be/aaaaaaaaaaa" }),
      { params: { id: "L-1" } },
    );
    expect(res.status).toBe(200);
    const lesson = mockFake.state.lms_lessons.find((l) => l.id === "L-1");
    expect(lesson.title).toBe("New");
    expect(lesson.is_required).toBe(false);
    expect(lesson.youtube_video_id).toBe("aaaaaaaaaaa");
  });

  test("DELETE refuses a lesson with progress", async () => {
    mockFake.seed("lms_lessons", [{ id: "L-1", section_id: "S-1", title: "L", content_type: "video", position: 0 }]);
    mockFake.seed("lms_lesson_progress", [{ id: "P-1", lesson_id: "L-1", enrollment_id: "E-1" }]);
    const res = await lessonDELETE(jsonReq({}), { params: { id: "L-1" } });
    expect(res.status).toBe(409);
  });
});

describe("Assessments & questions", () => {
  test("POST creates a course-level assessment when sectionId is null", async () => {
    mockFake.seed("lms_courses", [{ id: "C-1", title: "A", status: "draft", is_free: true, visibility: "public" }]);
    const res = await assessmentsPOST(
      jsonReq({ title: "Final", sectionId: null, passMark: 70 }),
      { params: { id: "C-1" } },
    );
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.assessment.section_id).toBeNull();
    expect(data.assessment.pass_mark).toBe(70);
  });

  test("POST rejects a section that belongs to another course", async () => {
    mockFake.seed("lms_courses", [{ id: "C-1", title: "A", status: "draft", is_free: true, visibility: "public" }]);
    mockFake.seed("lms_course_sections", [{ id: "S-9", course_id: "OTHER", title: "X", position: 0 }]);
    const res = await assessmentsPOST(
      jsonReq({ title: "Final", sectionId: "S-9" }),
      { params: { id: "C-1" } },
    );
    expect(res.status).toBe(400);
  });

  test("POST creates a valid multiple-choice question", async () => {
    mockFake.seed("lms_assessments", [{ id: "A-1", course_id: "C-1", section_id: null, title: "Quiz", position: 0 }]);
    const res = await questionsPOST(
      jsonReq({
        question: "Pick one",
        questionType: "multiple_choice",
        options: [
          { key: "A", text: "One" },
          { key: "B", text: "Two" },
        ],
        correctAnswer: ["B"],
      }),
      { params: { id: "A-1" } },
    );
    expect(res.status).toBe(200);
    const insert = mockFake.executed.find((q) => /insert into lms_assessment_questions/i.test(q.sql));
    expect(insert).toBeDefined();
    expect(insert.args).toContain("multiple_choice");
  });

  test("POST rejects a multiple-choice question with fewer than two options", async () => {
    mockFake.seed("lms_assessments", [{ id: "A-1", course_id: "C-1", section_id: null, title: "Quiz", position: 0 }]);
    const res = await questionsPOST(
      jsonReq({
        question: "Pick one",
        questionType: "multiple_choice",
        options: [{ key: "A", text: "Only" }],
        correctAnswer: ["A"],
      }),
      { params: { id: "A-1" } },
    );
    expect(res.status).toBe(400);
  });

  test("POST rejects a true/false question without a correct answer", async () => {
    mockFake.seed("lms_assessments", [{ id: "A-1", course_id: "C-1", section_id: null, title: "Quiz", position: 0 }]);
    const res = await questionsPOST(
      jsonReq({ question: "True?", questionType: "true_false", correctAnswer: [] }),
      { params: { id: "A-1" } },
    );
    expect(res.status).toBe(400);
  });

  test("PUT updates assessment pass mark", async () => {
    mockFake.seed("lms_assessments", [{ id: "A-1", course_id: "C-1", section_id: null, title: "Quiz", pass_mark: null, position: 0 }]);
    const res = await assessmentPUT(jsonReq({ passMark: 80 }), { params: { id: "A-1" } });
    expect(res.status).toBe(200);
    const assessment = mockFake.state.lms_assessments.find((a) => a.id === "A-1");
    expect(assessment.pass_mark).toBe(80);
  });
});

describe("Authorization (ticket §31)", () => {
  test("unauthorized users cannot create courses (403, no mutation)", async () => {
    requireAuthorization.mockResolvedValueOnce({ status: 403 });
    const res = await coursesPOST(jsonReq({ title: "Nope" }));
    expect(res.status).toBe(403);
    expect(mockFake.executed.some((q) => /insert into lms_courses/i.test(q.sql))).toBe(false);
  });

  test("unauthorized users cannot publish (403)", async () => {
    requireAuthorization.mockResolvedValueOnce({ status: 403 });
    const res = await publishPOST(jsonReq({}), { params: { id: "C-1" } });
    expect(res.status).toBe(403);
    expect(mockFake.executed.length).toBe(0);
  });

  test("unauthorized users cannot list courses (403)", async () => {
    requireAuthorization.mockResolvedValueOnce({ status: 403 });
    const res = await coursesGET(new Request("http://localhost/api/lms/courses"));
    expect(res.status).toBe(403);
  });

  test("unauthorized users cannot create sections (403)", async () => {
    requireAuthorization.mockResolvedValueOnce({ status: 403 });
    const res = await sectionsPOST(jsonReq({ title: "X" }), { params: { id: "C-1" } });
    expect(res.status).toBe(403);
  });
});
