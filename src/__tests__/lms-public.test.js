/**
 * LMS PUBLIC CATALOGUE — Phase 7 tests
 *
 * Public website ↔ ImpactOS boundary: only PUBLISHED + public courses are
 * exposed, the marketing surface never leaks internal ids / YouTube ids /
 * assessment answers, free enrollment works without payment, paid courses are
 * rejected until a verified payment exists, and the whole flow is idempotent.
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

const { GET: catalogGET } = require("@/app/api/public/courses/route");
const { GET: detailGET, POST: detailPOST } = require("@/app/api/public/courses/[slug]/route");

const readJson = async (res) => res.json();

function seedCourse(overrides = {}) {
  mockFake.seed("lms_courses", [
    {
      id: overrides.id || "crs-1",
      slug: overrides.slug || "customer-discovery",
      title: overrides.title || "Customer Discovery Fundamentals",
      description: "Learn how to identify and interview your target customers.",
      thumbnail_url: null,
      status: overrides.status || "published",
      visibility: overrides.visibility || "public",
      is_free: overrides.is_free !== undefined ? overrides.is_free : true,
      price: overrides.price != null ? overrides.price : null,
      created_by: "U-ADMIN",
    },
  ]);
  return overrides.id || "crs-1";
}

function seedStructure(courseId) {
  mockFake.seed("lms_course_sections", [{ id: `sec-${courseId}`, course_id: courseId, title: "Section 1", position: 0 }]);
  mockFake.seed("lms_lessons", [
    { id: `les-${courseId}-1`, section_id: `sec-${courseId}`, title: "Introduction Video", position: 0, is_required: true, content_type: "video", duration_minutes: 5 },
    { id: `les-${courseId}-2`, section_id: `sec-${courseId}`, title: "What is Customer Discovery?", position: 1, is_required: true, content_type: "video", duration_minutes: 8 },
  ]);
}

beforeEach(() => {
  mockFake.reset();
});

describe("public course catalogue", () => {
  test("exposes only published + public courses", async () => {
    seedCourse({ id: "crs-pub", slug: "pub" });
    seedCourse({ id: "crs-draft", slug: "draft", status: "draft" });
    seedCourse({ id: "crs-arch", slug: "arch", status: "archived" });
    seedCourse({ id: "crs-priv", slug: "priv", visibility: "private" });

    const res = await catalogGET();
    const data = await readJson(res);
    expect(data.success).toBe(true);
    expect(data.courses.map((c) => c.slug)).toEqual(["pub"]);
  });

  test("catalog payload never leaks internal ids or youtube ids", async () => {
    seedCourse();
    seedStructure("crs-1");
    const res = await catalogGET();
    const data = await readJson(res);
    const c = data.courses[0];
    expect(c.slug).toBe("customer-discovery");
    expect(c.id).toBeUndefined();
    expect(JSON.stringify(c)).not.toContain("youtube");
    expect(c.lessons).toBe(2);
    expect(c.sections).toBe(1);
    expect(c.duration_minutes).toBe(13);
    expect(c.is_free).toBe(true);
    expect(c.price).toBeNull();
  });
});

describe("public course detail", () => {
  test("returns marketing-safe detail + structure (no video ids, no answers)", async () => {
    seedCourse();
    seedStructure("crs-1");
    mockFake.seed("lms_assessments", [{ id: "asm-1", course_id: "crs-1", title: "Assessment", is_required: true }]);
    mockFake.seed("lms_assessment_questions", [
      { id: "q-1", assessment_id: "asm-1", question: "Q", correct_answer: '["A"]' },
    ]);

    const res = await detailGET(new Request("http://localhost/api/public/courses/x"), { params: { slug: "customer-discovery" } });
    const data = await readJson(res);
    expect(data.success).toBe(true);
    expect(data.course.slug).toBe("customer-discovery");
    expect(data.course.id).toBeUndefined();
    expect(JSON.stringify(data)).not.toContain("youtube_video_id");
    expect(JSON.stringify(data)).not.toContain("correct_answer");
    expect(JSON.stringify(data)).not.toContain("video_id");
    expect(data.structure.sections[0].lessons.length).toBe(2);
    expect(data.structure.assessments).toBe(1);
  });

  test("draft courses are not publicly visible (404)", async () => {
    seedCourse({ status: "draft", slug: "secret-draft" });
    const res = await detailGET(new Request("http://localhost/api/public/courses/x"), { params: { slug: "secret-draft" } });
    expect(res.status).toBe(404);
  });
});

describe("public enrollment", () => {
  test("free course enrolls an authenticated user (source self, idempotent)", async () => {
    seedCourse();
    const params = { slug: "customer-discovery" };
    const first = await detailPOST(new Request("http://localhost/api/public/courses/x", { method: "POST" }), { params });
    const data1 = await readJson(first);
    expect(data1.success).toBe(true);
    expect(data1.courseId).toBe("crs-1");
    expect(data1.alreadyEnrolled).toBe(false);

    const second = await detailPOST(new Request("http://localhost/api/public/courses/x", { method: "POST" }), { params });
    const data2 = await readJson(second);
    expect(data2.alreadyEnrolled).toBe(true);
    expect(mockFake.state.lms_enrollments.length).toBe(1);
    expect(mockFake.state.lms_enrollments[0].source).toBe("self");
  });

  test("paid course refuses enrollment until verified payment exists", async () => {
    seedCourse({ is_free: false, price: 25000 });
    const res = await detailPOST(new Request("http://localhost/api/public/courses/x", { method: "POST" }), {
      params: { slug: "customer-discovery" },
    });
    expect(res.status).toBe(402);
    expect(mockFake.state.lms_enrollments.length).toBe(0);
  });

  test("cannot enroll in a draft course", async () => {
    seedCourse({ status: "draft", slug: "secret-draft" });
    const res = await detailPOST(new Request("http://localhost/api/public/courses/x", { method: "POST" }), {
      params: { slug: "secret-draft" },
    });
    expect(res.status).toBe(404);
    expect(mockFake.state.lms_enrollments.length).toBe(0);
  });
});
