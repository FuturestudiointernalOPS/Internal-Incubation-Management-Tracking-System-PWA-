/**
 * LMS PROGRAM REQUIREMENTS — Phase 6 tests
 *
 * Program ↔ LMS integration: attaching courses to a program, required/optional
 * semantics, auto-enrollment on attach + on program enrollment, participant
 * learning view (LMS-authoritative progress), and route authorization.
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
  getSession: jest.fn(async () => ({ cid: "U-ADMIN", name: "Admin", role: "super_admin" })),
}));

jest.mock("@/lib/authorization", () => ({
  requireAuthorization: jest.fn(async () => null),
}));

const {
  attachCourseToProgram,
  getProgramRequirements,
  updateProgramRequirement,
  detachCourseFromProgram,
  ensureProgramEnrollments,
  getProgramLearningForParticipant,
} = require("@/lib/lms/programRequirements");

const { GET, POST } = require("@/app/api/lms/program-requirements/route");
const {
  PUT,
  DELETE,
} = require("@/app/api/lms/program-requirements/[id]/route");

const jsonReq = (body) =>
  new Request("http://localhost/api/lms/program-requirements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

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

function seedProgram(id = "P-2026-001") {
  mockFake.seed("v2_programs", [{ id, name: "Advanced Venture Creation Track" }]);
  return id;
}

function seedParticipant(cid) {
  mockFake.seed("contacts", [{ cid, name: `Learner ${cid}`, email: `${cid}@x.test` }]);
  return cid;
}

beforeEach(() => {
  mockFake.reset();
});

describe("lms program requirements — service", () => {
  test("attach validates the program exists", async () => {
    seedCourse();
    await expect(
      attachCourseToProgram({ programId: "P-MISSING", courseId: "crs-1" }),
    ).rejects.toThrow("lms.errors.programNotFound");
  });

  test("attach validates the course exists", async () => {
    seedProgram();
    await expect(
      attachCourseToProgram({ programId: "P-2026-001", courseId: "nope" }),
    ).rejects.toThrow("lms.errors.courseNotFound");
  });

  test("attach reuses the existing course (no duplicate course row)", async () => {
    seedCourse();
    seedProgram();
    const req = await attachCourseToProgram({
      programId: "P-2026-001",
      courseId: "crs-1",
      weekNumber: 2,
      isRequired: true,
    });
    expect(req.course_id).toBe("crs-1");
    expect(req.week_number).toBe(2);
    expect(req.is_required).toBe(true);
    // Course table still has exactly one course — the course is an LMS entity,
    // never copied per program.
    expect(mockFake.state.lms_courses.length).toBe(1);
    // The same course can be attached to a second program.
    seedProgram("P-2026-002");
    const req2 = await attachCourseToProgram({
      programId: "P-2026-002",
      courseId: "crs-1",
    });
    expect(req2.course_id).toBe("crs-1");
    expect(mockFake.state.lms_courses.length).toBe(1);
  });

  test("attach is idempotent (unique program+course)", async () => {
    seedCourse();
    seedProgram();
    await attachCourseToProgram({ programId: "P-2026-001", courseId: "crs-1" });
    await attachCourseToProgram({ programId: "P-2026-001", courseId: "crs-1" });
    const requirements = await getProgramRequirements("P-2026-001");
    expect(requirements.length).toBe(1);
  });

  test("list returns attached course info", async () => {
    seedCourse({ id: "crs-1", title: "Customer Discovery" });
    seedCourse({ id: "crs-2", title: "Market Validation" });
    seedProgram();
    await attachCourseToProgram({ programId: "P-2026-001", courseId: "crs-1", weekNumber: 2 });
    await attachCourseToProgram({ programId: "P-2026-001", courseId: "crs-2", weekNumber: 3 });
    const reqs = await getProgramRequirements("P-2026-001");
    expect(reqs.map((r) => r.course.title)).toEqual([
      "Customer Discovery",
      "Market Validation",
    ]);
    // Week filter
    const week2 = await getProgramRequirements("P-2026-001", { weekNumber: 2 });
    expect(week2.map((r) => r.course.title)).toEqual(["Customer Discovery"]);
  });

  test("update toggles required/optional", async () => {
    seedCourse();
    seedProgram();
    const req = await attachCourseToProgram({
      programId: "P-2026-001",
      courseId: "crs-1",
      isRequired: true,
    });
    const updated = await updateProgramRequirement(req.id, { is_required: false });
    expect(updated.is_required).toBe(false);
    expect(updated.title).toBe(req.title);
  });

  test("detach removes the requirement but keeps enrollments", async () => {
    seedCourse();
    seedProgram();
    seedParticipant("U-P1");
    const req = await attachCourseToProgram({
      programId: "P-2026-001",
      courseId: "crs-1",
    });
    await ensureProgramEnrollments("P-2026-001", ["U-P1"]);
    expect(mockFake.state.lms_enrollments.length).toBe(1);
    await detachCourseFromProgram(req.id);
    expect(mockFake.state.lms_program_requirements.length).toBe(0);
    // Existing learner access is NOT silently revoked.
    expect(mockFake.state.lms_enrollments.length).toBe(1);
  });
});

describe("lms program requirements — auto enrollment", () => {
  test("enrolls participants into PUBLISHED required courses only", async () => {
    seedCourse({ id: "crs-pub", status: "published" });
    seedCourse({ id: "crs-draft", status: "draft" });
    seedProgram();
    await attachCourseToProgram({ programId: "P-2026-001", courseId: "crs-pub" });
    await attachCourseToProgram({ programId: "P-2026-001", courseId: "crs-draft" });
    const res = await ensureProgramEnrollments("P-2026-001", ["U-P1", "U-P2"]);
    expect(res.enrolled).toBeGreaterThan(0);
    const enrolled = mockFake.state.lms_enrollments;
    expect(enrolled.filter((e) => String(e.course_id) === "crs-draft").length).toBe(0);
    expect(enrolled.filter((e) => String(e.course_id) === "crs-pub").length).toBe(2);
    // source + program_id recorded
    expect(enrolled[0].source).toBe("program");
    expect(enrolled[0].program_id).toBe("P-2026-001");
    // Idempotent — running again does not duplicate
    await ensureProgramEnrollments("P-2026-001", ["U-P1", "U-P2"]);
    expect(mockFake.state.lms_enrollments.length).toBe(2);
  });

  test("archived courses do not auto-enroll new learners", async () => {
    seedCourse({ id: "crs-arch", status: "archived" });
    seedProgram();
    await attachCourseToProgram({ programId: "P-2026-001", courseId: "crs-arch" });
    await ensureProgramEnrollments("P-2026-001", ["U-P1"]);
    expect(mockFake.state.lms_enrollments.length).toBe(0);
  });
});

describe("lms program requirements — participant learning view", () => {
  function seedCourseWithLesson(courseId, lessonId, isRequired = true) {
    seedCourse({ id: courseId });
    mockFake.seed("lms_course_sections", [{ id: `sec-${courseId}`, course_id: courseId, title: "Section 1", position: 0 }]);
    mockFake.seed("lms_lessons", [
      { id: lessonId, section_id: `sec-${courseId}`, title: "Lesson", position: 0, is_required: isRequired, content_type: "video" },
    ]);
  }

  test("progress is read from the LMS (no second counter)", async () => {
    seedCourseWithLesson("crs-1", "les-1");
    seedProgram();
    seedParticipant("U-P1");
    await attachCourseToProgram({ programId: "P-2026-001", courseId: "crs-1", weekNumber: 1 });
    await ensureProgramEnrollments("P-2026-001", ["U-P1"]);

    const before = await getProgramLearningForParticipant("P-2026-001", "U-P1");
    expect(before[0].progress.percent).toBe(0);
    expect(before[0].progress.status).toBe("not_started");
    expect(before[0].progress.continueLesson.lessonId).toBe("les-1");

    // Mark the lesson complete through the REAL completion path — the Program
    // view must reflect the LMS state.
    const { completeLesson } = require("@/lib/lms/learning");
    await completeLesson("les-1", "U-P1");

    const after = await getProgramLearningForParticipant("P-2026-001", "U-P1");
    expect(after[0].progress.percent).toBe(100);
    expect(after[0].progress.status).toBe("completed");
    expect(after[0].progress.continueLesson).toBeNull();
  });

  test("unpublished courses are reported as unavailable", async () => {
    seedCourse({ id: "crs-draft", status: "draft" });
    seedProgram();
    seedParticipant("U-P1");
    await attachCourseToProgram({ programId: "P-2026-001", courseId: "crs-draft" });
    const items = await getProgramLearningForParticipant("P-2026-001", "U-P1");
    expect(items[0].progress.status).toBe("unavailable");
  });

  test("learners have independent progress (cohort reuse)", async () => {
    seedCourseWithLesson("crs-1", "les-1");
    seedProgram();
    seedParticipant("U-P1");
    seedParticipant("U-P2");
    await attachCourseToProgram({ programId: "P-2026-001", courseId: "crs-1" });
    await ensureProgramEnrollments("P-2026-001", ["U-P1", "U-P2"]);

    const { completeLesson } = require("@/lib/lms/learning");
    await completeLesson("les-1", "U-P1");

    const p1 = await getProgramLearningForParticipant("P-2026-001", "U-P1");
    const p2 = await getProgramLearningForParticipant("P-2026-001", "U-P2");
    expect(p1[0].progress.percent).toBe(100);
    expect(p2[0].progress.percent).toBe(0);
  });

  test("PM summary counts enrolled + completed per course (from LMS only)", async () => {
    seedCourseWithLesson("crs-1", "les-1");
    seedProgram();
    seedParticipant("U-P1");
    seedParticipant("U-P2");
    mockFake.seed("participant_programs", [
      { participant_id: "U-P1", program_id: "P-2026-001" },
      { participant_id: "U-P2", program_id: "P-2026-001" },
    ]);
    await attachCourseToProgram({ programId: "P-2026-001", courseId: "crs-1" });
    await ensureProgramEnrollments("P-2026-001", ["U-P1", "U-P2"]);

    const { completeLesson } = require("@/lib/lms/learning");
    await completeLesson("les-1", "U-P1");

    const { getProgramLearningSummary } = require("@/lib/lms/programRequirements");
    const summary = await getProgramLearningSummary("P-2026-001");
    expect(summary).toHaveLength(1);
    expect(summary[0].enrolled).toBe(2);
    expect(summary[0].completed).toBe(1);
  });
});

describe("lms program requirements — routes", () => {
  test("POST attaches + auto-enrolls current participants", async () => {
    seedCourse();
    seedProgram();
    seedParticipant("U-P1");
    mockFake.seed("participant_programs", [
      { participant_id: "U-P1", program_id: "P-2026-001" },
    ]);

    const res = await POST(
      jsonReq({ program_id: "P-2026-001", course_id: "crs-1", week_number: 2 }),
    );
    const data = await readJson(res);
    expect(data.success).toBe(true);
    expect(data.requirement.course_id).toBe("crs-1");
    // Attaching a course enrolls the program's current participants server-side.
    expect(mockFake.state.lms_enrollments.length).toBe(1);
  });

  test("GET lists requirements for a program", async () => {
    seedCourse();
    seedProgram();
    await attachCourseToProgram({ programId: "P-2026-001", courseId: "crs-1", weekNumber: 2 });

    const req = new Request(
      "http://localhost/api/lms/program-requirements?program_id=P-2026-001",
    );
    const res = await GET(req);
    const data = await readJson(res);
    expect(data.success).toBe(true);
    expect(data.requirements.length).toBe(1);
    expect(data.requirements[0].course.title).toBe("Customer Discovery Fundamentals");
  });

  test("GET requires a program_id", async () => {
    const req = new Request("http://localhost/api/lms/program-requirements");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  test("PUT updates + DELETE detaches", async () => {
    seedCourse();
    seedProgram();
    const req = await attachCourseToProgram({ programId: "P-2026-001", courseId: "crs-1" });

    const putRes = await PUT(
      new Request("http://localhost/api/lms/program-requirements/1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_required: false }),
      }),
      { params: { id: req.id } },
    );
    const putData = await readJson(putRes);
    expect(putData.success).toBe(true);
    expect(putData.requirement.is_required).toBe(false);

    const delRes = await DELETE(
      new Request("http://localhost/api/lms/program-requirements/1", { method: "DELETE" }),
      { params: { id: req.id } },
    );
    const delData = await readJson(delRes);
    expect(delData.success).toBe(true);
    expect(mockFake.state.lms_program_requirements.length).toBe(0);
  });
});
