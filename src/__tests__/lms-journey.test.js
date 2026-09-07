/**
 * LMS CRM journey trace tests (Phase 7) against the shared fake LMS DB.
 *
 * Covers getLearnerJourney (src/lib/lms/journey.js) and
 * GET /api/contacts/[cid]/learning — the surface that powers the CRM
 * "Learning" tab. Guarantees:
 *   - the CRM sees ONLY LMS-authoritative values (progress, completion,
 *     certificates) and never recalculates anything;
 *   - internal details (youtube ids, verification tokens, enrollment ids,
 *     user_cids) never leak into the person record;
 *   - an active enrollment is never issued a certificate lazily, while a
 *     pre-Phase-5 completed enrollment receives one on first read;
 *   - the route is gated server-side by contacts.view.
 */

const { createFakeDb } = require("./helpers/fakeLmsDb");
const mockFake = createFakeDb();

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: mockFake.execute, transaction: mockFake.transaction },
  initDb: jest.fn(async () => {}),
}));

jest.mock("@/lib/authorization", () => ({
  requireAuthorization: jest.fn(async () => null),
}));

const { requireAuthorization } = require("@/lib/authorization");

const { getLearnerJourney } = require("@/lib/lms/journey");
const { GET: learningGET } = require("@/app/api/contacts/[cid]/learning/route");

const readJson = async (res) => res.json();

beforeEach(() => {
  mockFake.reset();
  requireAuthorization.mockResolvedValue(null);
});

// ─── Fixtures ──────────────────────────────────────────────────────────────
const COURSE = {
  id: "C-1",
  title: "Customer Discovery",
  description: "Learn how to identify and interview your target customers.",
  thumbnail_url: null,
  status: "published",
  is_free: true,
  visibility: "public",
  created_by: "U-ADMIN",
  created_at: "2026-08-27T00:00:00Z",
  updated_at: "2026-08-27T00:00:00Z",
};
const SECTION = { id: "S-1", course_id: "C-1", title: "Foundations", position: 0 };
const LESSON_1 = {
  id: "L-1",
  section_id: "S-1",
  title: "What is customer discovery?",
  content_type: "video",
  youtube_video_id: "aaaaaaaaaaa",
  is_required: true,
  position: 0,
};
const LESSON_2 = {
  id: "L-2",
  section_id: "S-1",
  title: "Interview basics",
  content_type: "video",
  youtube_video_id: "bbbbbbbbbbb",
  is_required: true,
  position: 1,
};
const ENROLLMENT_ACTIVE = {
  id: "E-1",
  course_id: "C-1",
  user_cid: "U-LEARNER",
  source: "admin",
  status: "active",
  enrolled_at: "2026-08-28T00:00:00Z",
  completed_at: null,
};

function seedCourseStructure() {
  mockFake.seed("lms_courses", [COURSE]);
  mockFake.seed("lms_course_sections", [SECTION]);
  mockFake.seed("lms_lessons", [LESSON_1, LESSON_2]);
}

function seedEnrollment(overrides = {}) {
  mockFake.seed("lms_enrollments", [{ ...ENROLLMENT_ACTIVE, ...overrides }]);
}

function seedLessonProgress(lessonIds) {
  mockFake.seed(
    "lms_lesson_progress",
    lessonIds.map((lessonId, i) => ({
      id: `P-${i + 1}`,
      enrollment_id: "E-1",
      lesson_id: lessonId,
      status: "completed",
      completed_at: "2026-08-30T00:00:00Z",
    })),
  );
}

function seedCertificate() {
  mockFake.seed("lms_certificates", [
    {
      id: "CRT-1",
      certificate_number: "CERT-2026-000001",
      verification_token: "vt-secret-000000000000",
      enrollment_id: "E-1",
      course_id: "C-1",
      user_cid: "U-LEARNER",
      learner_name: "Jane Learner",
      course_title: "Customer Discovery",
      issued_at: "2026-08-31T00:00:00Z",
      status: "valid",
    },
  ]);
}

// ─── Service: getLearnerJourney ─────────────────────────────────────────────

describe("getLearnerJourney (CRM trace mapping)", () => {
  test("a person with no LMS history gets the stable empty shape", async () => {
    const journey = await getLearnerJourney("U-NOBODY");
    expect(journey).toEqual({ courses: [], certificates: [], purchases: [] });
  });

  test("an enrolled course maps only the CRM-safe fields + LMS progress", async () => {
    seedCourseStructure();
    seedEnrollment();
    seedLessonProgress(["L-1"]); // 1 of 2 required lessons → 50%

    const journey = await getLearnerJourney("U-LEARNER");
    expect(journey).toEqual({
      courses: [
        {
          course: { id: "C-1", title: "Customer Discovery", thumbnail_url: null, status: "published" },
          enrollment: {
            source: "admin",
            status: "active",
            enrolled_at: "2026-08-28T00:00:00Z",
            completed_at: null,
          },
          progress: { percent: 50, status: "in_progress", completedLessons: 1, totalLessons: 2 },
          certificate: null,
        },
      ],
      certificates: [],
      purchases: [],
    });

    // The person record never carries internal/video/identity details.
    const serialized = JSON.stringify(journey);
    expect(serialized).not.toContain("youtube_video_id");
    expect(serialized).not.toContain("E-1"); // enrollment id
    expect(serialized).not.toContain("U-LEARNER"); // user_cid
  });

  test("an active enrollment is never issued a certificate lazily", async () => {
    seedCourseStructure();
    seedEnrollment(); // status: active
    seedLessonProgress(["L-1"]); // still in progress — not complete

    const journey = await getLearnerJourney("U-LEARNER");
    expect(journey.courses[0].certificate).toBeNull();
    expect(journey.courses[0].enrollment.status).toBe("active");
    expect(journey.certificates).toEqual([]);
    expect(mockFake.state.lms_certificates).toHaveLength(0);
  });

  test("a completed enrollment surfaces its certificate on both surfaces", async () => {
    seedCourseStructure();
    seedEnrollment({ status: "completed", completed_at: "2026-08-30T00:00:00Z" });
    seedLessonProgress(["L-1", "L-2"]);
    seedCertificate();

    const journey = await getLearnerJourney("U-LEARNER");
    expect(journey.courses[0].enrollment.status).toBe("completed");
    expect(journey.courses[0].progress.status).toBe("completed");
    expect(journey.courses[0].certificate).toEqual({
      certificate_number: "CERT-2026-000001",
      status: "valid",
      issued_at: "2026-08-31T00:00:00Z",
    });
    expect(journey.certificates).toEqual([
      {
        certificate_number: "CERT-2026-000001",
        course_title: "Customer Discovery",
        learner_name: "Jane Learner",
        status: "valid",
        issued_at: "2026-08-31T00:00:00Z",
      },
    ]);
    expect(journey.purchases).toEqual([]);

    // Verification token and raw identity never leak into the trace.
    const serialized = JSON.stringify(journey);
    expect(serialized).not.toContain("vt-secret-000000000000");
    expect(serialized).not.toContain("U-LEARNER");
    expect(serialized).not.toContain("youtube_video_id");
  });

  test("a pre-Phase-5 completed enrollment receives its certificate on first read", async () => {
    seedCourseStructure();
    seedEnrollment({ status: "completed", completed_at: "2026-08-30T00:00:00Z" });
    seedLessonProgress(["L-1", "L-2"]);
    mockFake.seed("contacts", [{ cid: "U-LEARNER", name: "Jane Learner" }]);

    const journey = await getLearnerJourney("U-LEARNER");
    expect(journey.courses[0].certificate).toMatchObject({
      certificate_number: "CERT-2026-000001",
      status: "valid",
    });
    expect(journey.certificates).toHaveLength(1);
    expect(journey.certificates[0]).toMatchObject({
      certificate_number: "CERT-2026-000001",
      learner_name: "Jane Learner", // snapshot from contacts, not the client
      course_title: "Customer Discovery",
      status: "valid",
    });
    expect(
      mockFake.executed.some((q) => /insert into lms_certificates/i.test(q.sql)),
    ).toBe(true);
  });
});

// ─── Route: GET /api/contacts/[cid]/learning ────────────────────────────────

describe("GET /api/contacts/[cid]/learning (route)", () => {
  test("requires contacts.view — 403 with no DB access when missing", async () => {
    requireAuthorization.mockResolvedValueOnce({ status: 403 });
    const res = await learningGET(new Request("http://localhost/x"), {
      params: { cid: "U-LEARNER" },
    });
    expect(res.status).toBe(403);
    expect(mockFake.executed.length).toBe(0);
  });

  test("returns the mapped journey for an authorized viewer", async () => {
    seedCourseStructure();
    seedEnrollment();
    seedLessonProgress(["L-1"]);

    const res = await learningGET(new Request("http://localhost/x"), {
      params: { cid: "U-LEARNER" },
    });
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.success).toBe(true);
    expect(data.learning.courses).toHaveLength(1);
    expect(data.learning.courses[0].progress.percent).toBe(50);
    expect(data.learning.certificates).toEqual([]);
    expect(data.learning.purchases).toEqual([]);
  });

  test("a person without enrollments still gets a 200 empty journey", async () => {
    const res = await learningGET(new Request("http://localhost/x"), {
      params: { cid: "U-NOBODY" },
    });
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.learning).toEqual({ courses: [], certificates: [], purchases: [] });
  });

  test("400 when the cid is missing", async () => {
    const res = await learningGET(new Request("http://localhost/x"), { params: {} });
    expect(res.status).toBe(400);
    const data = await readJson(res);
    expect(data.error).toBe("cid is required");
  });
});
