/**
 * LMS SESSION RESOURCES — the learner's view of uploaded files.
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
  listSessionResourcesBySession,
  learnerSessionResourcesBySession,
} = require("@/lib/lms/sessionResources");
const {
  SESSION_RESOURCE_URL_TTL_SECONDS,
} = require("@/lib/lms/sessionResourceFiles");

const PROGRAM = "P-2026-001";
const SESSION = "S-1";
const STORAGE_PATH = "sessions/P-2026-001/S-1/123-handout.pdf";
const PUBLIC_URL = `https://cdn.impactos.test/lms-session-resources/${STORAGE_PATH}`;
const SIGNED_URL = `https://supabase.test/storage/v1/object/sign/lms-session-resources/${STORAGE_PATH}?token=abc`;

const uploaded = (overrides = {}) => ({
  id: "R-1",
  program_id: PROGRAM,
  session_id: SESSION,
  week_number: 2,
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
  const bySession = await learnerSessionResourcesBySession(PROGRAM);
  return [...bySession.values()].flat().find((r) => r.id === id);
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
  mockFake.seed("lms_session_resources", [uploaded()]);

  const resource = await learnerById("R-1");

  expect(mockCreateSignedUrl).toHaveBeenCalledWith(STORAGE_PATH, SESSION_RESOURCE_URL_TTL_SECONDS);
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
  mockFake.seed("lms_session_resources", [uploaded()]);
  await learnerById("R-1");

  // Long enough for a viewing session, far from a durable bypass.
  expect(SESSION_RESOURCE_URL_TTL_SECONDS).toBeGreaterThan(60 * 60);
  expect(SESSION_RESOURCE_URL_TTL_SECONDS).toBeLessThanOrEqual(60 * 60 * 12);
});

test("an external link is the author's own and passes through untouched", async () => {
  mockFake.seed("lms_session_resources", [
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
  mockFake.seed("lms_session_resources", [uploaded()]);
  mockCreateSignedUrl.mockResolvedValue({ data: null, error: { message: "nope" } });

  const resource = await learnerById("R-1");

  expect(resource.url).toBeNull();
  expect(resource.storage_path).toBeNull();
});

test("the staff read keeps the stored values — signing is the learner's alone", async () => {
  mockFake.seed("lms_session_resources", [uploaded()]);

  const bySession = await listSessionResourcesBySession(PROGRAM);
  const resource = bySession.get(SESSION)[0];

  expect(resource.url).toBe(PUBLIC_URL);
  expect(resource.storage_path).toBe(STORAGE_PATH);
  expect(mockCreateSignedUrl).not.toHaveBeenCalled();
});

test("grouping by session still separates program-wide material", async () => {
  mockFake.seed("lms_session_resources", [
    uploaded({ id: "R-wide", session_id: null, storage_path: null, source: "link" }),
    uploaded({ id: "R-session" }),
  ]);

  const bySession = await learnerSessionResourcesBySession(PROGRAM);

  expect(bySession.get("").map((r) => r.id)).toEqual(["R-wide"]);
  expect(bySession.get(SESSION).map((r) => r.id)).toEqual(["R-session"]);
});

test("the participant program payload reads material through the learner view", () => {
  // Wiring check: the payload is what reaches a learner, so it must not read the
  // staff view — that is where the permanent link still lives.
  const source = fs.readFileSync(
    path.join(__dirname, "../app/api/participant/programs/[id]/route.js"),
    "utf8",
  );
  expect(source).toContain("learnerSessionResourcesBySession");
  expect(source).not.toContain("listSessionResourcesBySession");
});
