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

jest.mock("@/models/authorization/index", () => ({
  requireAuthorization: jest.fn(async () => null),
}));

const { requireAuthorization } = require("@/models/authorization/index");

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
const { POST: sectionsReorderPOST } = require("@/app/api/lms/courses/[id]/sections/reorder/route");
const {
  PUT: sectionPUT,
  DELETE: sectionDELETE,
} = require("@/app/api/lms/sections/[id]/route");
const { POST: lessonsPOST } = require("@/app/api/lms/sections/[id]/lessons/route");
const { PUT: lessonPUT, DELETE: lessonDELETE } = require("@/app/api/lms/lessons/[id]/route");
const { POST: assessmentsPOST } = require("@/app/api/lms/courses/[id]/assessments/route");
const {
  PUT: assessmentPUT,
  DELETE: assessmentDELETE,
} = require("@/app/api/lms/assessments/[id]/route");
const { POST: questionsPOST } = require("@/app/api/lms/assessments/[id]/questions/route");
const {
  PUT: questionPUT,
  DELETE: questionDELETE,
} = require("@/app/api/lms/questions/[id]/route");

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


describe("Assessments & questions", () => {
  test("POST creates a course-level assessment when sectionId is null", async () => {
    mockFake.seed("lms_courses", [{ id: "C-1", title: "A", status: "draft", is_free: true, visibility: "public" }]);
    const res = await assessmentsPOST(
      jsonReq({ title: "Final", sectionId: null, passMark: 70, questionType: "true_false" }),
      { params: { id: "C-1" } },
    );
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.assessment.section_id).toBeNull();
    expect(data.assessment.pass_mark).toBe(70);
    expect(data.assessment.question_type).toBe("true_false");
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
    mockFake.seed("lms_assessments", [{ id: "A-1", course_id: "C-1", section_id: null, title: "Quiz", question_type: "multiple_choice", position: 0 }]);
    const res = await questionsPOST(
      jsonReq({
        question: "Pick one",
        options: [
          { key: "A", text: "One" },
          { key: "B", text: "Two" },
        ],
        correctAnswer: ["B"],
      }),
      { params: { id: "A-1" } },
    );
    expect(res.status).toBe(200);
    const insert = mockFake.executed.find((entry) => /insert into lms_assessment_questions/i.test(entry.sql));
    expect(insert).toBeDefined();
    expect(insert.args).toContain("multiple_choice");
  });

  test("POST rejects a multiple-choice question with fewer than two options", async () => {
    mockFake.seed("lms_assessments", [{ id: "A-1", course_id: "C-1", section_id: null, title: "Quiz", question_type: "multiple_choice", position: 0 }]);
    const res = await questionsPOST(
      jsonReq({
        question: "Pick one",
        options: [{ key: "A", text: "Only" }],
        correctAnswer: ["A"],
      }),
      { params: { id: "A-1" } },
    );
    expect(res.status).toBe(400);
  });

  test("POST rejects a true/false question without a correct answer", async () => {
    mockFake.seed("lms_assessments", [{ id: "A-1", course_id: "C-1", section_id: null, title: "Quiz", question_type: "true_false", position: 0 }]);
    const res = await questionsPOST(
      jsonReq({ question: "True?", correctAnswer: [] }),
      { params: { id: "A-1" } },
    );
    expect(res.status).toBe(400);
  });

  test("POST creates a true/false question in a true_false assessment (type inherited from the assessment)", async () => {
    mockFake.seed("lms_assessments", [{ id: "A-1", course_id: "C-1", section_id: null, title: "Quiz", question_type: "true_false", position: 0 }]);
    const res = await questionsPOST(
      jsonReq({ question: "Sky is blue?", correctAnswer: ["true"] }),
      { params: { id: "A-1" } },
    );
    expect(res.status).toBe(200);
    const insert = mockFake.executed.find((entry) => /insert into lms_assessment_questions/i.test(entry.sql));
    expect(insert).toBeDefined();
    expect(insert.args).toContain("true_false");
  });

  test("PUT updates assessment pass mark", async () => {
    mockFake.seed("lms_assessments", [{ id: "A-1", course_id: "C-1", section_id: null, title: "Quiz", pass_mark: null, position: 0 }]);
    const res = await assessmentPUT(jsonReq({ passMark: 80 }), { params: { id: "A-1" } });
    expect(res.status).toBe(200);
    const assessment = mockFake.state.lms_assessments.find((stored) => stored.id === "A-1");
    expect(assessment.pass_mark).toBe(80);
  });

  test("PUT allows changing the question type before questions are added", async () => {
    mockFake.seed("lms_assessments", [{ id: "A-1", course_id: "C-1", section_id: null, title: "Quiz", question_type: "multiple_choice", position: 0 }]);
    const res = await assessmentPUT(jsonReq({ questionType: "true_false" }), { params: { id: "A-1" } });
    expect(res.status).toBe(200);
    const assessment = mockFake.state.lms_assessments.find((stored) => stored.id === "A-1");
    expect(assessment.question_type).toBe("true_false");
  });

  test("PUT rejects changing the question type once questions exist", async () => {
    mockFake.seed("lms_assessments", [{ id: "A-1", course_id: "C-1", section_id: null, title: "Quiz", question_type: "multiple_choice", position: 0 }]);
    mockFake.seed("lms_assessment_questions", [{ id: "Q-1", assessment_id: "A-1", question: "Q?", question_type: "multiple_choice", position: 0 }]);
    const res = await assessmentPUT(jsonReq({ questionType: "true_false" }), { params: { id: "A-1" } });
    expect(res.status).toBe(400);
    const assessment = mockFake.state.lms_assessments.find((stored) => stored.id === "A-1");
    expect(assessment.question_type).toBe("multiple_choice");
  });

  test("DELETE removes an assessment and its questions (200)", async () => {
    mockFake.seed("lms_assessments", [{ id: "A-1", course_id: "C-1", section_id: null, title: "Quiz", question_type: "multiple_choice", position: 0 }]);
    mockFake.seed("lms_assessment_questions", [{ id: "Q-1", assessment_id: "A-1", question: "Q?", question_type: "multiple_choice", position: 0 }]);
    const res = await assessmentDELETE(jsonReq({}), { params: { id: "A-1" } });
    expect(res.status).toBe(200);
    expect(mockFake.state.lms_assessments.find((stored) => stored.id === "A-1")).toBeUndefined();
    expect(mockFake.state.lms_assessment_questions.find((stored) => stored.id === "Q-1")).toBeUndefined();
  });

  test("DELETE refuses an assessment with learner attempts (409)", async () => {
    mockFake.seed("lms_assessments", [{ id: "A-1", course_id: "C-1", section_id: null, title: "Quiz", question_type: "multiple_choice", position: 0 }]);
    mockFake.seed("lms_assessment_attempts", [
      { id: "AT-1", assessment_id: "A-1", user_cid: "U-LEARNER", attempt_number: 1, score: 2, total_points: 2, passed: true },
    ]);
    const res = await assessmentDELETE(jsonReq({}), { params: { id: "A-1" } });
    expect(res.status).toBe(409);
    const data = await readJson(res);
    expect(data.error).toBe("lms.errors.cannotDeleteWithAttempts");
    expect(mockFake.state.lms_assessments).toHaveLength(1);
  });

  test("DELETE an unknown assessment returns 404", async () => {
    const res = await assessmentDELETE(jsonReq({}), { params: { id: "NOPE" } });
    expect(res.status).toBe(404);
    const data = await readJson(res);
    expect(data.error).toBe("lms.errors.assessmentNotFound");
  });

  test("PUT updates a question's text, options, answer and points", async () => {
    mockFake.seed("lms_assessment_questions", [
      {
        id: "Q-1",
        assessment_id: "A-1",
        question: "Old?",
        question_type: "multiple_choice",
        options: [
          { key: "A", text: "One" },
          { key: "B", text: "Two" },
        ],
        correct_answer: ["A"],
        points: 1,
        position: 0,
      },
    ]);
    const res = await questionPUT(
      jsonReq({
        question: "New?",
        options: [
          { key: "A", text: "Alpha" },
          { key: "B", text: "Beta" },
          { key: "C", text: "Gamma" },
        ],
        correctAnswer: ["C"],
        points: 3,
      }),
      { params: { id: "Q-1" } },
    );
    expect(res.status).toBe(200);
    const storedQuestion = mockFake.state.lms_assessment_questions.find((row) => row.id === "Q-1");
    expect(storedQuestion.question).toBe("New?");
    expect(storedQuestion.points).toBe(3);
    expect(JSON.parse(storedQuestion.options)).toEqual([
      { key: "A", text: "Alpha" },
      { key: "B", text: "Beta" },
      { key: "C", text: "Gamma" },
    ]);
    expect(JSON.parse(storedQuestion.correct_answer)).toEqual(["C"]);
  });

  test("PUT rejects blank question text (400)", async () => {
    mockFake.seed("lms_assessment_questions", [
      {
        id: "Q-1",
        assessment_id: "A-1",
        question: "Old?",
        question_type: "multiple_choice",
        options: [
          { key: "A", text: "One" },
          { key: "B", text: "Two" },
        ],
        correct_answer: ["A"],
        points: 1,
        position: 0,
      },
    ]);
    const res = await questionPUT(jsonReq({ question: "   " }), { params: { id: "Q-1" } });
    expect(res.status).toBe(400);
    const data = await readJson(res);
    expect(data.error).toBe("lms.errors.questionTextRequired");
    const storedQuestion = mockFake.state.lms_assessment_questions.find((row) => row.id === "Q-1");
    expect(storedQuestion.question).toBe("Old?");
  });

  test("PUT rejects multiple-choice options with fewer than two choices (400)", async () => {
    mockFake.seed("lms_assessment_questions", [
      {
        id: "Q-1",
        assessment_id: "A-1",
        question: "Old?",
        question_type: "multiple_choice",
        options: [
          { key: "A", text: "One" },
          { key: "B", text: "Two" },
        ],
        correct_answer: ["A"],
        points: 1,
        position: 0,
      },
    ]);
    const res = await questionPUT(
      jsonReq({ options: [{ key: "A", text: "Only" }], correctAnswer: ["A"] }),
      { params: { id: "Q-1" } },
    );
    expect(res.status).toBe(400);
    const data = await readJson(res);
    expect(data.error).toBe("lms.errors.mcOptionsRequired");
    const storedQuestion = mockFake.state.lms_assessment_questions.find((row) => row.id === "Q-1");
    expect(storedQuestion.correct_answer).toEqual(["A"]); // untouched — the row is never mutated on a validation failure
  });

  test("PUT action move swaps a question with its up neighbour", async () => {
    mockFake.seed("lms_assessment_questions", [
      { id: "Q-1", assessment_id: "A-1", question: "One", question_type: "multiple_choice", position: 0 },
      { id: "Q-2", assessment_id: "A-1", question: "Two", question_type: "multiple_choice", position: 1 },
      { id: "Q-3", assessment_id: "A-1", question: "Three", question_type: "multiple_choice", position: 2 },
    ]);
    const res = await questionPUT(
      jsonReq({ action: "move", direction: "up" }),
      { params: { id: "Q-2" } },
    );
    expect(res.status).toBe(200);
    expect((await readJson(res)).moved).toBe(true);
    expect(mockFake.state.lms_assessment_questions.find((stored) => stored.id === "Q-1").position).toBe(1);
    expect(mockFake.state.lms_assessment_questions.find((stored) => stored.id === "Q-2").position).toBe(0);
    expect(mockFake.state.lms_assessment_questions.find((stored) => stored.id === "Q-3").position).toBe(2);
  });

  test("PUT action move swaps a question with its down neighbour", async () => {
    mockFake.seed("lms_assessment_questions", [
      { id: "Q-1", assessment_id: "A-1", question: "One", question_type: "multiple_choice", position: 0 },
      { id: "Q-2", assessment_id: "A-1", question: "Two", question_type: "multiple_choice", position: 1 },
      { id: "Q-3", assessment_id: "A-1", question: "Three", question_type: "multiple_choice", position: 2 },
    ]);
    const res = await questionPUT(
      jsonReq({ action: "move", direction: "down" }),
      { params: { id: "Q-2" } },
    );
    expect(res.status).toBe(200);
    expect((await readJson(res)).moved).toBe(true);
    expect(mockFake.state.lms_assessment_questions.find((stored) => stored.id === "Q-1").position).toBe(0);
    expect(mockFake.state.lms_assessment_questions.find((stored) => stored.id === "Q-2").position).toBe(2);
    expect(mockFake.state.lms_assessment_questions.find((stored) => stored.id === "Q-3").position).toBe(1);
  });

  test("PUT action move with no neighbour reports moved: false", async () => {
    mockFake.seed("lms_assessment_questions", [
      { id: "Q-1", assessment_id: "A-1", question: "One", question_type: "multiple_choice", position: 0 },
      { id: "Q-2", assessment_id: "A-1", question: "Two", question_type: "multiple_choice", position: 1 },
    ]);
    const res = await questionPUT(
      jsonReq({ action: "move", direction: "up" }),
      { params: { id: "Q-1" } },
    );
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.moved).toBe(false);
    expect(mockFake.state.lms_assessment_questions.find((stored) => stored.id === "Q-1").position).toBe(0);
  });

  test("PUT action move with an invalid direction returns 400", async () => {
    mockFake.seed("lms_assessment_questions", [
      { id: "Q-1", assessment_id: "A-1", question: "One", question_type: "multiple_choice", position: 0 },
    ]);
    const res = await questionPUT(
      jsonReq({ action: "move", direction: "sideways" }),
      { params: { id: "Q-1" } },
    );
    expect(res.status).toBe(400);
    const data = await readJson(res);
    expect(data.error).toBe("lms.errors.invalidDirection");
  });

  test("PUT an unknown question returns 404", async () => {
    const res = await questionPUT(jsonReq({ question: "New?" }), { params: { id: "NOPE" } });
    expect(res.status).toBe(404);
    const data = await readJson(res);
    expect(data.error).toBe("lms.errors.questionNotFound");
  });

  test("DELETE removes a question (200)", async () => {
    mockFake.seed("lms_assessment_questions", [
      { id: "Q-1", assessment_id: "A-1", question: "One", question_type: "multiple_choice", position: 0 },
    ]);
    const res = await questionDELETE(jsonReq({}), { params: { id: "Q-1" } });
    expect(res.status).toBe(200);
    expect(mockFake.state.lms_assessment_questions.find((stored) => stored.id === "Q-1")).toBeUndefined();
  });

  test("DELETE an unknown question returns 404", async () => {
    const res = await questionDELETE(jsonReq({}), { params: { id: "NOPE" } });
    expect(res.status).toBe(404);
    const data = await readJson(res);
    expect(data.error).toBe("lms.errors.questionNotFound");
  });

  test("question PUT/DELETE require lms.edit (403, no mutation)", async () => {
    mockFake.seed("lms_assessment_questions", [
      { id: "Q-1", assessment_id: "A-1", question: "One", question_type: "multiple_choice", position: 0 },
    ]);
    requireAuthorization.mockResolvedValueOnce({ status: 403 });
    const putResponse = await questionPUT(jsonReq({ question: "New?" }), { params: { id: "Q-1" } });
    expect(putResponse.status).toBe(403);

    requireAuthorization.mockResolvedValueOnce({ status: 403 });
    const deleteResponse = await questionDELETE(jsonReq({}), { params: { id: "Q-1" } });
    expect(deleteResponse.status).toBe(403);
    expect(mockFake.executed.length).toBe(0);
  });
});

describe("Sections — drag & drop reorder", () => {
  const seedCourseWithSections = () => {
    mockFake.seed("lms_courses", [{ id: "C-1", title: "A", status: "draft", is_free: true, visibility: "public" }]);
    mockFake.seed("lms_course_sections", [
      { id: "S-1", course_id: "C-1", title: "A", position: 0 },
      { id: "S-2", course_id: "C-1", title: "B", position: 1 },
      { id: "S-3", course_id: "C-1", title: "C", position: 2 },
    ]);
  };

  const positions = () =>
    mockFake.state.lms_course_sections
      .slice()
      .sort((left, right) => left.position - right.position)
      .map((section) => section.id);

  test("POST persists an arbitrary drag-and-drop section order", async () => {
    seedCourseWithSections();
    const res = await sectionsReorderPOST(
      jsonReq({ sectionIds: ["S-3", "S-1", "S-2"] }),
      { params: { id: "C-1" } },
    );
    expect(res.status).toBe(200);
    expect((await readJson(res)).moved).toBe(true);
    expect(positions()).toEqual(["S-3", "S-1", "S-2"]);
    expect(mockFake.state.lms_course_sections.find((section) => section.id === "S-1").position).toBe(1);
    expect(mockFake.state.lms_course_sections.find((section) => section.id === "S-2").position).toBe(2);
    expect(mockFake.state.lms_course_sections.find((section) => section.id === "S-3").position).toBe(0);
  });

  test("POST reports moved: false when the order is unchanged", async () => {
    seedCourseWithSections();
    const res = await sectionsReorderPOST(
      jsonReq({ sectionIds: ["S-1", "S-2", "S-3"] }),
      { params: { id: "C-1" } },
    );
    expect(res.status).toBe(200);
    expect((await readJson(res)).moved).toBe(false);
    expect(positions()).toEqual(["S-1", "S-2", "S-3"]);
  });

  test("POST rejects a list that does not match the course sections (400, no mutation)", async () => {
    seedCourseWithSections();
    const res = await sectionsReorderPOST(
      jsonReq({ sectionIds: ["S-1", "S-2"] }),
      { params: { id: "C-1" } },
    );
    expect(res.status).toBe(400);
    expect(positions()).toEqual(["S-1", "S-2", "S-3"]);
  });

  test("POST rejects ids from another course (400)", async () => {
    mockFake.seed("lms_courses", [{ id: "C-1", title: "A", status: "draft", is_free: true, visibility: "public" }]);
    mockFake.seed("lms_course_sections", [
      { id: "S-1", course_id: "C-1", title: "A", position: 0 },
      { id: "S-X", course_id: "OTHER", title: "B", position: 1 },
    ]);
    const res = await sectionsReorderPOST(
      jsonReq({ sectionIds: ["S-X", "S-1"] }),
      { params: { id: "C-1" } },
    );
    expect(res.status).toBe(400);
  });

  test("POST on an unknown course returns 404", async () => {
    const res = await sectionsReorderPOST(
      jsonReq({ sectionIds: ["S-1"] }),
      { params: { id: "NOPE" } },
    );
    expect(res.status).toBe(404);
  });
});

describe("Authorization (ticket §31)", () => {
  test("unauthorized users cannot create courses (403, no mutation)", async () => {
    requireAuthorization.mockResolvedValueOnce({ status: 403 });
    const res = await coursesPOST(jsonReq({ title: "Nope" }));
    expect(res.status).toBe(403);
    expect(mockFake.executed.some((entry) => /insert into lms_courses/i.test(entry.sql))).toBe(false);
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

