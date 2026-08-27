/**
 * LMS API tests (Phase 2 — course authoring) with a programmable fake DB.
 *
 * The DB layer is replaced by an in-memory interpreter that understands the
 * exact queries the LMS services issue, so the real services + routes are
 * exercised end-to-end (authorization gating, validation, status transitions,
 * YouTube normalization, safe-delete guards).
 *
 * Covers ticket §31 (authorization) and §35 (CRUD, sections, lessons, YouTube,
 * assessments, questions, publishing).
 */

// ─── DB mock (programmable) ────────────────────────────────────────────────
let mockDbHandler = () => ({ rows: [] });
const mockExecuted = [];

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    execute: jest.fn(async ({ sql, args }) => {
      mockExecuted.push({ sql, args: args || [] });
      return mockDbHandler(sql, args || []);
    }),
    transaction: jest.fn(async (cb) =>
      cb(async (sql, args = []) => {
        mockExecuted.push({ sql, args });
        return mockDbHandler(sql, args);
      }),
    ),
  },
  initDb: jest.fn(async () => {}),
}));

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(async () => ({ cid: "U-ADMIN", name: "Admin", role: "super_admin" })),
}));

jest.mock("@/lib/authorization", () => ({
  requireAuthorization: jest.fn(async () => null),
}));

const { requireAuthorization } = require("@/lib/authorization");

// ─── Fake DB state + interpreter ───────────────────────────────────────────
const TABLES = [
  "lms_courses",
  "lms_course_sections",
  "lms_lessons",
  "lms_assessments",
  "lms_assessment_questions",
  "lms_enrollments",
  "lms_lesson_progress",
  "lms_assessment_attempts",
];

let state = {};
let seq = 1;

function seed(table, rows) {
  state[table].push(...rows);
}

function resetState() {
  state = Object.fromEntries(TABLES.map((t) => [t, []]));
  seq = 1;
  mockExecuted.length = 0;
  requireAuthorization.mockResolvedValue(null);
}

function rowFor(table) {
  const row = { id: `${table.replace(/^lms_/, "LMS-").replace(/_/g, "-")}-${seq++}` };
  row.created_at = "2026-08-27T00:00:00Z";
  row.updated_at = "2026-08-27T00:00:00Z";
  return row;
}

function insert(sql, args) {
  const table = /insert into (\w+)/i.exec(sql)[1];
  const columns = /\(([^)]+)\)\s*VALUES/i.exec(sql)[1]
    .split(",")
    .map((c) => c.trim());
  const valueTokens = /VALUES\s*\(([^)]+)\)/i.exec(sql)[1]
    .split(",")
    .map((t) => t.trim());

  const row = rowFor(table);
  let argIndex = 0;
  columns.forEach((column, i) => {
    const token = valueTokens[i] || "?";
    if (token === "?" || token.startsWith("?")) {
      row[column] = args[argIndex++];
    } else {
      row[column] = token.replace(/^'|'$/g, "");
    }
  });
  state[table].push(row);
  return { rows: [row] };
}

function update(sql, args) {
  const table = /^update (\w+)/i.exec(sql)[1];
  const id = args[args.length - 1];
  const row = state[table].find((r) => String(r.id) === String(id));
  if (!row) return { rows: [], rowsAffected: 0 };

  // Build an immutable snapshot (real-DB semantics): the service may hold a
  // reference to the pre-update row; mutating it in place would corrupt
  // captured values (e.g. the position-swap algorithm).
  const updated = { ...row };
  const setMatch = /set (.+?) where/i.exec(sql);
  const parts = setMatch ? setMatch[1].split(",").map((p) => p.trim()) : [];
  let argIndex = 0;
  for (const part of parts) {
    const m = /^(\w+)\s*=\s*\?/.exec(part);
    if (m) updated[m[1]] = args[argIndex++];
    else if (/updated_at\s*=\s*now\(\)/i.test(part)) updated.updated_at = "2026-08-27T01:00:00Z";
    else if (/position\s*=\s*-1/.test(part)) updated.position = -1;
  }
  state[table] = state[table].map((r) => (r === row ? updated : r));
  return { rows: [updated], rowsAffected: 1 };
}

function remove(sql, args) {
  const table = /delete from (\w+)/i.exec(sql)[1];
  const id = args[0];
  state[table] = state[table].filter((r) => String(r.id) !== String(id));
  // Minimal cascade so follow-up queries behave consistently.
  if (table === "lms_course_sections") {
    const lessonIds = state.lms_lessons
      .filter((l) => String(l.section_id) === String(id))
      .map((l) => String(l.id));
    state.lms_lessons = state.lms_lessons.filter((l) => lessonIds.includes(String(l.id)) === false);
    state.lms_assessments = state.lms_assessments.filter(
      (a) => String(a.section_id) !== String(id),
    );
  }
  if (table === "lms_assessments") {
    state.lms_assessment_questions = state.lms_assessment_questions.filter(
      (q) => String(q.assessment_id) !== String(id),
    );
  }
  if (table === "lms_lessons") {
    state.lms_lesson_progress = state.lms_lesson_progress.filter(
      (p) => String(p.lesson_id) !== String(id),
    );
  }
  return { rows: [], rowsAffected: 1 };
}

function evalWhere(sql, args, row) {
  const whereMatch = /where (.+?)(?:\s+order by|\s+limit|$)/is.exec(sql);
  if (!whereMatch) return true;
  const cond = whereMatch[1];

  const inMatch = /(\w+)\s+in\s*\(([^)]*)\)/i.exec(cond);
  if (inMatch) {
    const column = inMatch[1];
    const count = (inMatch[2].match(/\?/g) || []).length;
    const ids = args.slice(0, count).map((a) => String(a));
    return ids.includes(String(row[column]));
  }
  const eqMatch = /(\w+)\s*=\s*\?/i.exec(cond);
  if (eqMatch) return String(row[eqMatch[1]]) === String(args[0]);
  return true;
}

function nextPosition(sql, args) {
  const m = /from (\w+) where (\w+) = \?/i.exec(sql);
  const table = m[1];
  const column = m[2];
  const parentId = args[0];
  const siblings = state[table].filter((r) => String(r[column]) === String(parentId));
  const max = siblings.reduce((acc, r) => Math.max(acc, r.position ?? -1), -1);
  return { rows: [{ next: max + 1 }] };
}

function neighbor(sql, args) {
  const table = /from (\w+)/i.exec(sql)[1];
  const m = /(\w+) = \? and (\w+) ([<>]) \?/i.exec(sql);
  const parentColumn = m[1];
  const posColumn = m[2];
  const op = m[3];
  const parentId = args[0];
  const pos = args[1];
  const rows = state[table]
    .filter((r) => String(r[parentColumn]) === String(parentId))
    .filter((r) => (op === "<" ? r.position < pos : r.position > pos))
    .sort((a, b) => (op === "<" ? b.position - a.position : a.position - b.position));
  return { rows: rows.slice(0, 1).map((r) => ({ ...r })) };
}

function guard(sql, args) {
  const table = /from (\w+)/i.exec(sql)[1];
  const found = state[table].some((r) => evalWhere(sql, args, r));
  return { rows: found ? [{ ok: 1 }] : [] };
}

function selectAll(sql, args) {
  const table = /from (\w+)/i.exec(sql)[1];
  let rows = [...state[table]];

  if (/where id = \?/i.test(sql)) {
    rows = rows.filter((r) => String(r.id) === String(args[0]));
  } else {
    const whereMatch = /where (.+?)(?:\s+order by|$)/is.exec(sql);
    if (whereMatch) {
      const cond = whereMatch[1];
      const inMatch = /(\w+)\s+in\s*\(([^)]*)\)/i.exec(cond);
      if (inMatch) {
        const column = inMatch[1];
        const count = (inMatch[2].match(/\?/g) || []).length;
        const ids = args.slice(0, count).map((a) => String(a));
        rows = rows.filter((r) => ids.includes(String(r[column])));
      } else {
        const eq = /(\w+)\s*=\s*\?/i.exec(cond);
        if (eq) rows = rows.filter((r) => String(r[eq[1]]) === String(args[0]));
      }
    }
  }
  return { rows: rows.map((r) => ({ ...r })) };
}

function interpreter(sql, args) {
  const s = sql.replace(/\s+/g, " ").trim();
  if (/^insert into/i.test(s)) return insert(s, args);
  if (/^update/i.test(s)) return update(s, args);
  if (/^delete from/i.test(s)) return remove(s, args);
  if (/coalesce\(max\(position\)/i.test(s)) return nextPosition(s, args);
  if (/select id, position from/i.test(s)) return neighbor(s, args);
  if (/^select 1 from/i.test(s)) return guard(s, args);
  return selectAll(s, args);
}

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
  resetState();
  mockDbHandler = interpreter;
});

describe("Courses — create/list/update/delete", () => {
  test("POST creates a draft course with the session as creator", async () => {
    const res = await coursesPOST(jsonReq({ title: "Customer Discovery" }));
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.success).toBe(true);
    expect(data.course.status).toBe("draft");
    expect(data.course.title).toBe("Customer Discovery");

    const insert = mockExecuted.find((q) => /insert into lms_courses/i.test(q.sql));
    expect(insert).toBeDefined();
    expect(insert.args).toContain("U-ADMIN");
    expect(insert.args).toContain("public");
    expect(insert.args).toContain(true); // is_free
  });

  test("POST without a title returns 400 and never inserts", async () => {
    const res = await coursesPOST(jsonReq({}));
    expect(res.status).toBe(400);
    expect(mockExecuted.some((q) => /insert into lms_courses/i.test(q.sql))).toBe(false);
  });

  test("POST with a paid price persists price metadata", async () => {
    seed("lms_courses", []);
    const res = await coursesPOST(
      jsonReq({ title: "Paid Course", is_free: false, price: 49.99 }),
    );
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.course.is_free).toBe(false);
    const insert = mockExecuted.find((q) => /insert into lms_courses/i.test(q.sql));
    expect(insert.args).toContain(49.99);
  });

  test("POST with an invalid price returns 400", async () => {
    const res = await coursesPOST(jsonReq({ title: "X", is_free: false, price: -5 }));
    expect(res.status).toBe(400);
  });

  test("GET lists courses", async () => {
    seed("lms_courses", [
      { id: "C-1", title: "A", status: "draft", is_free: true, visibility: "public", updated_at: "2026-08-27T00:00:00Z" },
      { id: "C-2", title: "B", status: "published", is_free: true, visibility: "public", updated_at: "2026-08-27T00:00:00Z" },
    ]);
    const res = await coursesGET(new Request("http://localhost/api/lms/courses"));
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.courses).toHaveLength(2);
  });

  test("PUT updates course metadata", async () => {
    seed("lms_courses", [
      { id: "C-1", title: "A", status: "draft", is_free: true, visibility: "public", updated_at: "2026-08-27T00:00:00Z" },
    ]);
    const res = await coursePUT(jsonReq({ title: "Renamed" }), { params: { id: "C-1" } });
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.course.title).toBe("Renamed");
  });

  test("DELETE refuses published courses", async () => {
    seed("lms_courses", [
      { id: "C-1", title: "A", status: "published", is_free: true, visibility: "public", updated_at: "2026-08-27T00:00:00Z" },
    ]);
    const res = await courseDELETE(jsonReq({}), { params: { id: "C-1" } });
    expect(res.status).toBe(409);
  });

  test("DELETE refuses draft courses with enrollments", async () => {
    seed("lms_courses", [
      { id: "C-1", title: "A", status: "draft", is_free: true, visibility: "public", updated_at: "2026-08-27T00:00:00Z" },
    ]);
    seed("lms_enrollments", [{ id: "E-1", course_id: "C-1", user_cid: "U-1" }]);
    const res = await courseDELETE(jsonReq({}), { params: { id: "C-1" } });
    expect(res.status).toBe(409);
  });

  test("DELETE removes an empty draft course", async () => {
    seed("lms_courses", [
      { id: "C-1", title: "A", status: "draft", is_free: true, visibility: "public", updated_at: "2026-08-27T00:00:00Z" },
    ]);
    const res = await courseDELETE(jsonReq({}), { params: { id: "C-1" } });
    expect(res.status).toBe(200);
    expect(mockExecuted.some((q) => /delete from lms_courses/i.test(q.sql))).toBe(true);
  });

  test("GET returns the full structure", async () => {
    seed("lms_courses", [
      { id: "C-1", title: "A", status: "draft", is_free: true, visibility: "public", updated_at: "2026-08-27T00:00:00Z" },
    ]);
    seed("lms_course_sections", [{ id: "S-1", course_id: "C-1", title: "Intro", position: 0 }]);
    seed("lms_lessons", [
      { id: "L-1", section_id: "S-1", title: "L1", content_type: "video", youtube_video_id: "dQw4w9WgXcQ", position: 0 },
    ]);
    seed("lms_assessments", [
      { id: "A-1", course_id: "C-1", section_id: "S-1", title: "Quiz", position: 0 },
      { id: "A-2", course_id: "C-1", section_id: null, title: "Final", position: 1 },
    ]);
    seed("lms_assessment_questions", [
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
    seed("lms_courses", [draftCourse]);
    seed("lms_course_sections", [validSection]);
    seed("lms_lessons", [validLesson]);
    const res = await publishPOST(jsonReq({}), { params: { id: "C-1" } });
    expect(res.status).toBe(200);
    const update = mockExecuted.find((q) => /update lms_courses.*status = 'published'/i.test(q.sql));
    expect(update).toBeDefined();
  });

  test("an empty course cannot publish — 422 with field-level details", async () => {
    seed("lms_courses", [draftCourse]);
    const res = await publishPOST(jsonReq({}), { params: { id: "C-1" } });
    expect(res.status).toBe(422);
    const data = await readJson(res);
    expect(data.details).toBeDefined();
    const keys = data.details.map((d) => d.key);
    expect(keys).toContain("lms.errors.noSections");
    expect(keys).toContain("lms.errors.noLessons");
  });

  test("a lesson without a video cannot publish", async () => {
    seed("lms_courses", [draftCourse]);
    seed("lms_course_sections", [validSection]);
    seed("lms_lessons", [{ ...validLesson, youtube_video_id: null }]);
    const res = await publishPOST(jsonReq({}), { params: { id: "C-1" } });
    expect(res.status).toBe(422);
    const data = await readJson(res);
    expect(data.details.map((d) => d.key)).toContain("lms.errors.lessonVideoRequired");
  });

  test("archived courses cannot be published", async () => {
    seed("lms_courses", [{ ...draftCourse, status: "archived" }]);
    const res = await publishPOST(jsonReq({}), { params: { id: "C-1" } });
    expect(res.status).toBe(409);
  });

  test("archiving a published course succeeds; archiving a draft is refused", async () => {
    seed("lms_courses", [{ ...draftCourse, status: "published" }]);
    const ok = await archivePOST(jsonReq({}), { params: { id: "C-1" } });
    expect(ok.status).toBe(200);

    seed("lms_courses", [{ ...draftCourse, id: "C-2" }]);
    const refused = await archivePOST(jsonReq({}), { params: { id: "C-2" } });
    expect(refused.status).toBe(409);
  });
});

describe("Sections", () => {
  test("POST creates a section at the next position", async () => {
    seed("lms_courses", [{ id: "C-1", title: "A", status: "draft", is_free: true, visibility: "public" }]);
    const res = await sectionsPOST(jsonReq({ title: "Intro" }), { params: { id: "C-1" } });
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.section.course_id).toBe("C-1");
    expect(data.section.position).toBe(0);
  });

  test("PUT moves a section down (transaction swap)", async () => {
    seed("lms_course_sections", [
      { id: "S-1", course_id: "C-1", title: "A", position: 0 },
      { id: "S-2", course_id: "C-1", title: "B", position: 1 },
    ]);
    const res = await sectionPUT(jsonReq({ action: "move", direction: "down" }), { params: { id: "S-1" } });
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.moved).toBe(true);
    const s1 = state.lms_course_sections.find((s) => s.id === "S-1");
    const s2 = state.lms_course_sections.find((s) => s.id === "S-2");
    expect(s1.position).toBe(1);
    expect(s2.position).toBe(0);
  });

  test("DELETE refuses when a lesson in the section has progress", async () => {
    seed("lms_course_sections", [{ id: "S-1", course_id: "C-1", title: "A", position: 0 }]);
    seed("lms_lessons", [{ id: "L-1", section_id: "S-1", title: "L", position: 0 }]);
    seed("lms_lesson_progress", [{ id: "P-1", lesson_id: "L-1", enrollment_id: "E-1" }]);
    const res = await sectionDELETE(jsonReq({}), { params: { id: "S-1" } });
    expect(res.status).toBe(409);
  });

  test("DELETE removes an empty section", async () => {
    seed("lms_course_sections", [{ id: "S-1", course_id: "C-1", title: "A", position: 0 }]);
    const res = await sectionDELETE(jsonReq({}), { params: { id: "S-1" } });
    expect(res.status).toBe(200);
  });
});

describe("Lessons & YouTube", () => {
  test("POST normalizes a YouTube URL into the video ID", async () => {
    seed("lms_course_sections", [{ id: "S-1", course_id: "C-1", title: "A", position: 0 }]);
    const res = await lessonsPOST(
      jsonReq({ title: "L1", youtubeVideoId: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }),
      { params: { id: "S-1" } },
    );
    expect(res.status).toBe(200);
    const insert = mockExecuted.find((q) => /insert into lms_lessons/i.test(q.sql));
    expect(insert).toBeDefined();
    expect(insert.args).toContain("dQw4w9WgXcQ");
  });

  test("POST with an invalid YouTube value returns 400", async () => {
    seed("lms_course_sections", [{ id: "S-1", course_id: "C-1", title: "A", position: 0 }]);
    const res = await lessonsPOST(
      jsonReq({ title: "L1", youtubeVideoId: "https://vimeo.com/123" }),
      { params: { id: "S-1" } },
    );
    expect(res.status).toBe(400);
    expect(mockExecuted.some((q) => /insert into lms_lessons/i.test(q.sql))).toBe(false);
  });

  test("POST requires a lesson title", async () => {
    seed("lms_course_sections", [{ id: "S-1", course_id: "C-1", title: "A", position: 0 }]);
    const res = await lessonsPOST(jsonReq({ title: "" }), { params: { id: "S-1" } });
    expect(res.status).toBe(400);
  });

  test("PUT updates lesson fields", async () => {
    seed("lms_lessons", [
      { id: "L-1", section_id: "S-1", title: "Old", content_type: "video", youtube_video_id: null, is_required: true, position: 0 },
    ]);
    const res = await lessonPUT(
      jsonReq({ title: "New", isRequired: false, youtubeVideoId: "https://youtu.be/aaaaaaaaaaa" }),
      { params: { id: "L-1" } },
    );
    expect(res.status).toBe(200);
    const lesson = state.lms_lessons.find((l) => l.id === "L-1");
    expect(lesson.title).toBe("New");
    expect(lesson.is_required).toBe(false);
    expect(lesson.youtube_video_id).toBe("aaaaaaaaaaa");
  });

  test("DELETE refuses a lesson with progress", async () => {
    seed("lms_lessons", [{ id: "L-1", section_id: "S-1", title: "L", content_type: "video", position: 0 }]);
    seed("lms_lesson_progress", [{ id: "P-1", lesson_id: "L-1", enrollment_id: "E-1" }]);
    const res = await lessonDELETE(jsonReq({}), { params: { id: "L-1" } });
    expect(res.status).toBe(409);
  });
});

describe("Assessments & questions", () => {
  test("POST creates a course-level assessment when sectionId is null", async () => {
    seed("lms_courses", [{ id: "C-1", title: "A", status: "draft", is_free: true, visibility: "public" }]);
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
    seed("lms_courses", [{ id: "C-1", title: "A", status: "draft", is_free: true, visibility: "public" }]);
    seed("lms_course_sections", [{ id: "S-9", course_id: "OTHER", title: "X", position: 0 }]);
    const res = await assessmentsPOST(
      jsonReq({ title: "Final", sectionId: "S-9" }),
      { params: { id: "C-1" } },
    );
    expect(res.status).toBe(400);
  });

  test("POST creates a valid multiple-choice question", async () => {
    seed("lms_assessments", [{ id: "A-1", course_id: "C-1", section_id: null, title: "Quiz", position: 0 }]);
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
    const insert = mockExecuted.find((q) => /insert into lms_assessment_questions/i.test(q.sql));
    expect(insert).toBeDefined();
    expect(insert.args).toContain("multiple_choice");
  });

  test("POST rejects a multiple-choice question with fewer than two options", async () => {
    seed("lms_assessments", [{ id: "A-1", course_id: "C-1", section_id: null, title: "Quiz", position: 0 }]);
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
    seed("lms_assessments", [{ id: "A-1", course_id: "C-1", section_id: null, title: "Quiz", position: 0 }]);
    const res = await questionsPOST(
      jsonReq({ question: "True?", questionType: "true_false", correctAnswer: [] }),
      { params: { id: "A-1" } },
    );
    expect(res.status).toBe(400);
  });

  test("PUT updates assessment pass mark", async () => {
    seed("lms_assessments", [{ id: "A-1", course_id: "C-1", section_id: null, title: "Quiz", pass_mark: null, position: 0 }]);
    const res = await assessmentPUT(jsonReq({ passMark: 80 }), { params: { id: "A-1" } });
    expect(res.status).toBe(200);
    const assessment = state.lms_assessments.find((a) => a.id === "A-1");
    expect(assessment.pass_mark).toBe(80);
  });
});

describe("Authorization (ticket §31)", () => {
  test("unauthorized users cannot create courses (403, no mutation)", async () => {
    requireAuthorization.mockResolvedValueOnce({ status: 403 });
    const res = await coursesPOST(jsonReq({ title: "Nope" }));
    expect(res.status).toBe(403);
    expect(mockExecuted.some((q) => /insert into lms_courses/i.test(q.sql))).toBe(false);
  });

  test("unauthorized users cannot publish (403)", async () => {
    requireAuthorization.mockResolvedValueOnce({ status: 403 });
    const res = await publishPOST(jsonReq({}), { params: { id: "C-1" } });
    expect(res.status).toBe(403);
    expect(mockExecuted.length).toBe(0);
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
