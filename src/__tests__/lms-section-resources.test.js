/**
 * LMS SECTION RESOURCES — Phase 8 tests
 *
 * The material attached to a COURSE SECTION of an LMS course (videos +
 * documents, with the "recommended" flag and note), as authored by a course
 * editor / Program Manager.
 *
 * A resource belongs to a section (`section_id`); there is no program or
 * program-session scope any more, and no week inheritance.
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
  createSectionResource,
  listSectionResources,
  updateSectionResource,
  deleteSectionResource,
} = require("@/lib/lms/sectionResources");

const { GET: resourcesGET, POST: resourcesPOST } = require("@/app/api/lms/section-resources/route");
const {
  PUT: resourcePUT,
  DELETE: resourceDELETE,
} = require("@/app/api/lms/section-resources/[id]/route");

const jsonReq = (body, url = "http://localhost/api/lms/test") =>
  new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const readJson = async (res) => res.json();

const COURSE = "C-1";
const SECTION = "S-1";

function seedCourse() {
  mockFake.seed("lms_courses", [
    { id: COURSE, title: "Advanced Venture Creation Track", status: "published" },
  ]);
}

function seedSection(overrides = {}) {
  mockFake.seed("lms_course_sections", [
    {
      id: SECTION,
      course_id: COURSE,
      title: "Week 1 — Discovery",
      position: 0,
      ...overrides,
    },
  ]);
}

beforeEach(() => {
  mockFake.reset();
  jest.clearAllMocks();
  requireAuthorization.mockResolvedValue(null);
  getSession.mockResolvedValue({ cid: "U-LEARNER", name: "Learner", role: "participant" });
});

// ─── Section resources ─────────────────────────────────────────────────────

describe("lms section resources — service", () => {
  test("a resource requires a section id", async () => {
    await expect(
      createSectionResource({ sectionId: "", title: "T", url: "https://x.test/a.pdf" }),
    ).rejects.toThrow("lms.errors.sectionNotFound");
  });

  test("the section must exist", async () => {
    await expect(
      createSectionResource({ sectionId: "S-MISSING", title: "T", url: "https://x.test/a.pdf" }),
    ).rejects.toThrow("lms.errors.sectionNotFound");
  });

  test("listing without a section id fails fast", async () => {
    await expect(listSectionResources({})).rejects.toThrow("lms.errors.sectionNotFound");
  });

  test("a title is required", async () => {
    seedCourse();
    seedSection();
    await expect(
      createSectionResource({ sectionId: SECTION, title: "  ", url: "https://x.test/a.pdf" }),
    ).rejects.toThrow("lms.errors.resourceTitleRequired");
  });

  test("a link is required and must be http(s)", async () => {
    seedCourse();
    seedSection();
    await expect(
      createSectionResource({ sectionId: SECTION, title: "Doc" }),
    ).rejects.toThrow("lms.errors.resourceUrlRequired");
    await expect(
      createSectionResource({
        sectionId: SECTION,
        title: "Doc",
        url: "javascript:alert(1)",
      }),
    ).rejects.toThrow("lms.errors.resourceUrlInvalid");
    await expect(
      createSectionResource({ sectionId: SECTION, title: "Doc", url: "not-a-url" }),
    ).rejects.toThrow("lms.errors.resourceUrlInvalid");
  });

  test("an unknown kind is rejected", async () => {
    seedCourse();
    seedSection();
    await expect(
      createSectionResource({
        sectionId: SECTION,
        kind: "podcast",
        title: "Doc",
        url: "https://x.test/a.pdf",
      }),
    ).rejects.toThrow("lms.errors.invalidResourceKind");
  });

  test("creates a video resource scoped to its section", async () => {
    seedCourse();
    seedSection();
    const resource = await createSectionResource({
      sectionId: SECTION,
      kind: "video",
      title: "Founder interview",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      isRecommended: true,
      recommendationNote: "Watch before the workshop",
      createdBy: "U-PM",
    });
    expect(resource.kind).toBe("video");
    expect(resource.section_id).toBe(SECTION);
    expect(resource.is_recommended).toBe(true);
    expect(resource.recommendation_note).toBe("Watch before the workshop");
    expect(resource.created_by).toBe("U-PM");
    expect(resource.position).toBe(0);
  });

  test("a recommendation note is dropped when the resource is not recommended", async () => {
    seedCourse();
    seedSection();
    const resource = await createSectionResource({
      sectionId: SECTION,
      title: "Slides",
      url: "https://x.test/slides.pdf",
      recommendationNote: "should not be stored",
    });
    expect(resource.is_recommended).toBe(false);
    expect(resource.recommendation_note).toBeNull();
    expect(resource.kind).toBe("document"); // default kind
  });

  test("listing is scoped to the section and flags recommendations", async () => {
    seedCourse();
    seedSection();
    seedSection({ id: "S-2", title: "Week 2", position: 1 });
    await createSectionResource({
      sectionId: SECTION,
      title: "Reader",
      url: "https://x.test/reader.pdf",
    });
    const toolkit = await createSectionResource({
      sectionId: SECTION,
      title: "Toolkit",
      url: "https://x.test/toolkit.pdf",
      isRecommended: true,
      recommendationNote: "Bring it filled in",
    });
    await createSectionResource({
      sectionId: "S-2",
      title: "Other section",
      url: "https://x.test/other.pdf",
    });

    const forSection = await listSectionResources({ sectionId: SECTION });
    expect(forSection.map((resource) => resource.title)).toEqual(["Reader", "Toolkit"]);

    // Recommendations stay in the list, flagged — the surface decides how to
    // present them (the learner view pulls them into their own block).
    const recommended = forSection.filter((resource) => resource.is_recommended);
    expect(recommended).toHaveLength(1);
    expect(recommended[0].title).toBe("Toolkit");
    expect(recommended[0].id).toBe(toolkit.id);
  });

  test("update toggles the recommendation and rewrites the link", async () => {
    seedCourse();
    seedSection();
    const resource = await createSectionResource({
      sectionId: SECTION,
      title: "Reader",
      url: "https://x.test/reader.pdf",
    });
    const updated = await updateSectionResource(resource.id, {
      is_recommended: true,
      recommendation_note: "Start here",
      url: "https://x.test/reader-v2.pdf",
    });
    expect(updated.is_recommended).toBe(true);
    expect(updated.recommendation_note).toBe("Start here");
    expect(updated.url).toBe("https://x.test/reader-v2.pdf");
  });

  test("update rejects an invalid link and an unknown resource", async () => {
    seedCourse();
    seedSection();
    const resource = await createSectionResource({
      sectionId: SECTION,
      title: "Reader",
      url: "https://x.test/reader.pdf",
    });
    await expect(updateSectionResource(resource.id, { url: "ftp://x.test/a" })).rejects.toThrow(
      "lms.errors.resourceUrlInvalid",
    );
    await expect(updateSectionResource("nope", { title: "X" })).rejects.toThrow(
      "lms.errors.resourceNotFound",
    );
  });

  test("delete removes the row", async () => {
    seedCourse();
    seedSection();
    const resource = await createSectionResource({
      sectionId: SECTION,
      title: "Reader",
      url: "https://x.test/reader.pdf",
    });
    await deleteSectionResource(resource.id);
    expect(mockFake.state.lms_section_resources).toHaveLength(0);
    await expect(deleteSectionResource(resource.id)).rejects.toThrow("lms.errors.resourceNotFound");
  });
});

describe("lms section resources — routes", () => {
  test("GET without a section id fails fast", async () => {
    const res = await resourcesGET(new Request("http://localhost/api/lms/section-resources"));
    expect(res.status).toBe(400);
    const data = await readJson(res);
    expect(data.error).toBe("lms.errors.sectionNotFound");
  });

  test("GET returns the section's resources", async () => {
    seedCourse();
    seedSection();
    await createSectionResource({
      sectionId: SECTION,
      title: "Reader",
      url: "https://x.test/reader.pdf",
    });
    const res = await resourcesGET(
      new Request(`http://localhost/api/lms/section-resources?section_id=${SECTION}`),
    );
    const data = await readJson(res);
    expect(data.success).toBe(true);
    expect(data.resources).toHaveLength(1);
  });

  test("POST is gated by lms.edit", async () => {
    const denied = new Response("{}", { status: 403 });
    requireAuthorization.mockResolvedValueOnce(denied);
    const res = await resourcesPOST(
      jsonReq({
        section_id: SECTION,
        title: "Reader",
        url: "https://x.test/reader.pdf",
      }),
    );
    expect(res).toBe(denied);
    expect(requireAuthorization).toHaveBeenCalledWith("lms", "edit");
  });

  test("POST creates the resource with the session as author", async () => {
    seedCourse();
    seedSection();
    getSession.mockResolvedValueOnce({ cid: "U-PM", name: "PM", role: "program_manager" });
    const res = await resourcesPOST(
      jsonReq({
        section_id: SECTION,
        title: "Reader",
        url: "https://x.test/reader.pdf",
      }),
    );
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.resource.title).toBe("Reader");
    expect(data.resource.section_id).toBe(SECTION);
    expect(data.resource.created_by).toBe("U-PM");
  });

  test("PUT and DELETE round out the authoring lifecycle", async () => {
    seedCourse();
    seedSection();
    const resource = await createSectionResource({
      sectionId: SECTION,
      title: "Reader",
      url: "https://x.test/reader.pdf",
    });

    const putResponse = await resourcePUT(
      jsonReq({ is_recommended: true, recommendation_note: "Read first" }),
      { params: Promise.resolve({ id: resource.id }) },
    );
    const putBody = await readJson(putResponse);
    expect(putBody.resource.is_recommended).toBe(true);

    const deleteResponse = await resourceDELETE(jsonReq({}), {
      params: Promise.resolve({ id: resource.id }),
    });
    expect((await readJson(deleteResponse)).success).toBe(true);
  });
});
