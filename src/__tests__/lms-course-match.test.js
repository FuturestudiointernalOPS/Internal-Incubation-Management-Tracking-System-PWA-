/**
 * FIND A COURSE BY THE NAME THE WEBSITE GIVES
 *
 * The website names a programme ("launchlab") and ImpactOS answers with the
 * Execution that sells the best-matching course, at the price it will charge.
 * A name match alone is not enough: a matching course that is not actually sold
 * answers with a null checkout, so the website keeps its own fallback instead
 * of being sent somewhere that grants nothing.
 */

const { createFakeDb } = require("./helpers/fakeLmsDb");
const mockFake = createFakeDb();

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: mockFake.execute, transaction: mockFake.transaction },
  initDb: jest.fn(async () => {}),
}));

const { GET: matchGET } = require("@/app/api/public/course-match/route");
const { nameKey, nameScore } = require("@/lib/lms/courseMatch");

const readJson = async (res) => res.json();

function seedCourse(overrides = {}) {
  mockFake.seed("lms_courses", [
    {
      id: overrides.id || "crs-1",
      title: overrides.title || "Customer Discovery Fundamentals",
      description: "Learn how to identify and interview your target customers.",
      thumbnail_url: null,
      status: overrides.status || "published",
      visibility: overrides.visibility || "public",
      is_free: overrides.is_free !== undefined ? overrides.is_free : true,
      price: overrides.price != null ? overrides.price : null,
      created_by: "U-ADMIN",
      updated_at: overrides.updatedAt || "2026-09-01T00:00:00Z",
    },
  ]);
  return overrides.id || "crs-1";
}

function seedRun({ id = 7, courseId, slug = "bootcamp-run", status = "active", formId = 3 } = {}) {
  mockFake.seed("platform_form_runs", [
    {
      id,
      form_id: formId,
      name: "Bootcamp",
      status,
      public_slug: slug,
      lms_course_id: courseId,
      updated_at: "2026-09-01T00:00:00Z",
    },
  ]);
}

beforeEach(() => {
  mockFake.reset();
});

describe("scoring a name against a course title", () => {
  test("the whole name, a prefix, or shared words match; chance does not", () => {
    expect(nameKey("Launch Lab")).toBe("launchlab");
    expect(nameScore("launch lab bootcamp", "Launch Lab Bootcamp")).toBe(1000);
    expect(nameScore("launchlab", "Launch Lab Bootcamp")).toBeGreaterThanOrEqual(800);
    expect(nameScore("bootcamp", "Launch Lab Bootcamp")).toBeGreaterThan(0);
    expect(nameScore("launchlab", "Clarté du problème")).toBe(0);
  });
});

describe("GET /api/public/course-match", () => {
  test("answers with the course and the Execution that sells it", async () => {
    const courseId = seedCourse({
      id: "crs-ll",
      title: "Launch Lab Bootcamp",
      is_free: false,
      price: 15000,
    });
    seedRun({ id: 9, courseId, slug: "bootcamp-run" });

    const res = await matchGET(new Request("http://localhost/api/public/course-match?name=launchlab"));
    const data = await readJson(res);

    expect(data.success).toBe(true);
    expect(data.match.title).toBe("Launch Lab Bootcamp");
    expect(data.checkout).toMatchObject({ run_slug: "bootcamp-run", amount: 15000 });
  });

  test("a matching but unsold course yields no checkout", async () => {
    seedCourse({ id: "crs-ll", title: "Launch Lab Bootcamp" });

    const res = await matchGET(new Request("http://localhost/api/public/course-match?name=launchlab"));
    const data = await readJson(res);

    expect(data.match.title).toBe("Launch Lab Bootcamp");
    expect(data.checkout).toBeNull();
  });

  test("answers with nothing when no course corresponds", async () => {
    seedCourse({ title: "Design Thinking" });

    const res = await matchGET(new Request("http://localhost/api/public/course-match?name=launchlab"));
    const data = await readJson(res);

    expect(data.success).toBe(true);
    expect(data.match).toBeNull();
    expect(data.checkout).toBeNull();
  });

  test("refuses a request with no name", async () => {
    const res = await matchGET(new Request("http://localhost/api/public/course-match"));
    expect(res.status).toBe(400);
  });
});
