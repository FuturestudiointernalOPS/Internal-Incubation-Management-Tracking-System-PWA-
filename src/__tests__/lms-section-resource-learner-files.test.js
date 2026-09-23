/**
 * LMS SECTION RESOURCES — the learner's view of uploaded files.
 *
 * An uploaded file is material shown INSIDE ImpactOS, so the participant surface
 * must never receive the permanent public URL stored on the row: it is handed a
 * SHORT-LIVED SIGNED link, and the storage path stays on the server. That is why
 * the learner read is a distinct function — the staff read keeps returning the
 * stored values, where handing a link to a colleague is acceptable.
 *
 * A file storage refuses to sign comes back with no url at all, so the surface
 * can say it is unavailable instead of rendering a dead link.
 *
 * The bucket is a storage boundary, so @supabase/supabase-js is mocked and the
 * REAL service runs against the fake LMS database.
 */

const fs = require("fs");
const path = require("path");
const { createFakeDb } = require("./helpers/fakeLmsDb");

const mockFake = createFakeDb();

const mockCreateSignedUrl = jest.fn();
const mockStorageFrom = jest.fn(() => ({ createSignedUrl: mockCreateSignedUrl }));
jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({ storage: { from: mockStorageFrom } })),
}));

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: mockFake.execute, transaction: mockFake.transaction },
  initDb: jest.fn(async () => {}),
}));

const {
  listSectionResourcesByCourse,
  learnerSectionResourcesByCourse,
} = require("@/lib/lms/sectionResources");
const {
  SECTION_RESOURCE_URL_TTL_SECONDS,
} = require("@/lib/lms/sectionResourceFiles");

const COURSE = "C-1";
const SECTION = "S-1";
const STORAGE_PATH = "sections/C-1/S-1/123-handout.pdf";
const PUBLIC_URL = `https://cdn.impactos.test/lms-session-resources/${STORAGE_PATH}`;
const SIGNED_URL = `https://supabase.test/storage/v1/object/sign/lms-session-resources/${STORAGE_PATH}?token=abc`;

const seedSection = (id = SECTION, overrides = {}) =>
  mockFake.seed("lms_course_sections", [
    { id, course_id: COURSE, title: `Section ${id}`, position: 0, ...overrides },
  ]);

const uploaded = (overrides = {}) => ({
  id: "R-1",
  section_id: SECTION,
  kind: "document",
  title: "Handout",
  url: PUBLIC_URL,
  source: "upload",
  storage_path: STORAGE_PATH,
  file_name: "handout.pdf",
  file_size: 2048,
  mime_type: "application/pdf",
  is_recommended: false,
  position: 0,
  ...overrides,
});

const learnerById = async (id) => {
  const byCourse = await learnerSectionResourcesByCourse(COURSE);
  return [...byCourse.values()].flat().find((resource) => resource.id === id);
};

beforeEach(() => {
  mockFake.reset();
  mockStorageFrom.mockClear();
  mockCreateSignedUrl.mockReset();
  mockCreateSignedUrl.mockResolvedValue({ data: { signedUrl: SIGNED_URL }, error: null });
  // The storage client needs credentials to be constructed at all.
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
});

test("an uploaded file reaches the learner as a signed link, never the public one", async () => {
  seedSection();
  mockFake.seed("lms_section_resources", [uploaded()]);

  const resource = await learnerById("R-1");

  expect(mockCreateSignedUrl).toHaveBeenCalledWith(STORAGE_PATH, SECTION_RESOURCE_URL_TTL_SECONDS);
  expect(resource.url).toBe(SIGNED_URL);
  expect(resource.url).not.toBe(PUBLIC_URL);
  // The permanent address of the object stays on the server.
  expect(resource.storage_path).toBeNull();
  // Everything the surface displays survives the swap.
  expect(resource.title).toBe("Handout");
  expect(resource.file_name).toBe("handout.pdf");
  expect(resource.file_size).toBe(2048);
});

test("the learner's link is short-lived", async () => {
  seedSection();
  mockFake.seed("lms_section_resources", [uploaded()]);
  await learnerById("R-1");

  // Long enough for a viewing session, far from a durable bypass.
  expect(SECTION_RESOURCE_URL_TTL_SECONDS).toBeGreaterThan(60 * 60);
  expect(SECTION_RESOURCE_URL_TTL_SECONDS).toBeLessThanOrEqual(60 * 60 * 12);
});

test("an external link is the author's own and passes through untouched", async () => {
  seedSection();
  mockFake.seed("lms_section_resources", [
    uploaded({
      id: "R-2",
      source: "link",
      url: "https://example.test/reader.pdf",
      storage_path: null,
    }),
  ]);

  const resource = await learnerById("R-2");

  expect(resource.url).toBe("https://example.test/reader.pdf");
  expect(mockCreateSignedUrl).not.toHaveBeenCalled();
});

test("a file storage cannot sign comes back without a link", async () => {
  seedSection();
  mockFake.seed("lms_section_resources", [uploaded()]);
  mockCreateSignedUrl.mockResolvedValue({ data: null, error: { message: "nope" } });

  const resource = await learnerById("R-1");

  expect(resource.url).toBeNull();
  expect(resource.storage_path).toBeNull();
});

test("the staff read keeps the stored values — signing is the learner's alone", async () => {
  seedSection();
  mockFake.seed("lms_section_resources", [uploaded()]);

  const bySection = await listSectionResourcesByCourse(COURSE);
  const resource = bySection.get(SECTION)[0];

  expect(resource.url).toBe(PUBLIC_URL);
  expect(resource.storage_path).toBe(STORAGE_PATH);
  expect(mockCreateSignedUrl).not.toHaveBeenCalled();
});

test("grouping by section still separates material per section", async () => {
  seedSection(SECTION);
  seedSection("S-2", { title: "Week 2", position: 1 });
  mockFake.seed("lms_section_resources", [
    uploaded({ id: "R-1" }),
    uploaded({ id: "R-2", section_id: "S-2" }),
  ]);

  const bySection = await learnerSectionResourcesByCourse(COURSE);

  expect([...bySection.keys()].sort()).toEqual(["S-1", "S-2"]);
  expect(bySection.get("S-1").map((resource) => resource.id)).toEqual(["R-1"]);
  expect(bySection.get("S-2").map((resource) => resource.id)).toEqual(["R-2"]);
});

test("the learner course payload reads material through the learner view", () => {
  // Wiring check: the payload is what reaches a learner, so it must not read the
  // staff view — that is where the permanent link still lives.
  const source = fs.readFileSync(
    path.join(__dirname, "../models/lms/learning.js"),
    "utf8",
  );
  expect(source).toContain("learnerSectionResourcesByCourse");
  expect(source).not.toContain("listSectionResourcesByCourse");
});
