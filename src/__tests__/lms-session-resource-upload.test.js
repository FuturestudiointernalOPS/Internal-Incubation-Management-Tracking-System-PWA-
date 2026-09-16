/**
 * LMS SESSION RESOURCE FILE UPLOADS — Phase 8.1 tests
 *
 * POST   /api/lms/session-resources/upload  (multipart)
 * DELETE /api/lms/session-resources/upload?path=…
 *
 * The route is a storage boundary (Supabase `lms-session-resources` bucket), so
 * @supabase/supabase-js is mocked and the REAL route handler + service run
 * end-to-end. Covers:
 *   - authorization (lms.assign) on both verbs
 *   - validation per kind (type + size) — a rejected file never reaches storage
 *   - happy path (upload + public URL + storage metadata)
 *   - bucket auto-creation on first failure, then retry
 *   - persistent storage failure → 500 with an i18n key (never a raw error)
 *   - orphan cleanup: deleting a resource deletes its stored object
 */

const { createFakeDb } = require("./helpers/fakeLmsDb");
const mockFake = createFakeDb();

const upload = jest.fn();
const remove = jest.fn();
const createBucket = jest.fn();
const getPublicUrl = jest.fn();
const from = jest.fn(() => ({ upload, remove, getPublicUrl }));
const mockSupabaseStorage = { from, createBucket };

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({ storage: mockSupabaseStorage })),
}));

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: mockFake.execute, transaction: mockFake.transaction },
  initDb: jest.fn(async () => {}),
}));

jest.mock("@/lib/authorization", () => ({
  requireAuthorization: jest.fn(async () => null),
}));

const { requireAuthorization } = require("@/lib/authorization");
const { POST, DELETE } = require("@/app/api/lms/session-resources/upload/route");
const {
  createSessionResource,
  deleteSessionResource,
} = require("@/lib/lms/sessionResources");

const PUBLIC_URL = "https://cdn.impactos.test/lms-session-resources/sessions/P-1/S-1/123-handout.pdf";
const readJson = async (res) => res.json();

const PROGRAM = "P-2026-001";
const SESSION = "S-1";

/** FormData request with a browser-like File. */
function fileRequest({ name = "handout.pdf", type = "application/pdf", bytes, kind = "document" } = {}) {
  const fd = new FormData();
  fd.append(
    "file",
    new File([bytes || Buffer.from("fake-file-bytes")], name, { type }),
  );
  fd.append("kind", kind);
  fd.append("program_id", PROGRAM);
  fd.append("session_id", SESSION);
  return new Request("http://localhost/api/lms/session-resources/upload", {
    method: "POST",
    body: fd,
  });
}

beforeEach(() => {
  mockFake.reset();
  requireAuthorization.mockReset();
  requireAuthorization.mockResolvedValue(null);
  upload.mockReset();
  remove.mockReset();
  createBucket.mockReset();
  getPublicUrl.mockReset();
  getPublicUrl.mockReturnValue({ data: { publicUrl: PUBLIC_URL } });
  // The storage client needs credentials to be constructed at all.
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
});

describe("POST /api/lms/session-resources/upload", () => {
  test("403 when lms.assign is missing — nothing is uploaded", async () => {
    const denied = new Response("{}", { status: 403 });
    requireAuthorization.mockResolvedValueOnce(denied);
    const res = await POST(fileRequest());
    expect(res).toBe(denied);
    expect(requireAuthorization).toHaveBeenCalledWith("lms", "assign");
    expect(upload).not.toHaveBeenCalled();
  });

  test("400 when no file is provided", async () => {
    const fd = new FormData();
    fd.append("kind", "document");
    const res = await POST(
      new Request("http://localhost/api/lms/session-resources/upload", {
        method: "POST",
        body: fd,
      }),
    );
    expect(res.status).toBe(400);
    const data = await readJson(res);
    expect(data.error).toBe("lms.errors.fileRequired");
    expect(upload).not.toHaveBeenCalled();
  });

  test("400 for a disallowed document type", async () => {
    const res = await POST(
      fileRequest({ name: "payload.exe", type: "application/x-msdownload" }),
    );
    expect(res.status).toBe(400);
    const data = await readJson(res);
    expect(data.error).toBe("lms.errors.invalidDocumentFile");
    expect(upload).not.toHaveBeenCalled();
  });

  test("400 for a disallowed video type", async () => {
    const res = await POST(
      fileRequest({ name: "clip.avi", type: "video/x-msvideo", kind: "video" }),
    );
    expect(res.status).toBe(400);
    const data = await readJson(res);
    expect(data.error).toBe("lms.errors.invalidVideoFile");
    expect(upload).not.toHaveBeenCalled();
  });

  test("400 when a document exceeds its 5 MB ceiling", async () => {
    const res = await POST(fileRequest({ bytes: Buffer.alloc(5 * 1024 * 1024 + 1) }));
    expect(res.status).toBe(400);
    const data = await readJson(res);
    expect(data.error).toBe("lms.errors.fileTooLarge");
    expect(data.details).toMatchObject({ maxMb: 5 });
    expect(upload).not.toHaveBeenCalled();
  });

  test("an unknown kind is rejected before storage", async () => {
    const res = await POST(fileRequest({ kind: "podcast" }));
    expect(res.status).toBe(400);
    const data = await readJson(res);
    expect(data.error).toBe("lms.errors.invalidResourceKind");
    expect(upload).not.toHaveBeenCalled();
  });

  test("200 uploads the file and returns the storage metadata", async () => {
    upload.mockResolvedValue({ error: null });
    const res = await POST(fileRequest());
    expect(res.status).toBe(200);
    const data = await readJson(res);

    expect(data.success).toBe(true);
    expect(data.url).toBe(PUBLIC_URL);
    expect(data.storage_path).toMatch(/^sessions\/P-2026-001\/S-1\/\d+-handout\.pdf$/);
    expect(data.file_name).toBe("handout.pdf");
    expect(data.kind).toBe("document");
    expect(data.mime_type).toBe("application/pdf");
    expect(data.file_size).toBeGreaterThan(0);

    expect(from).toHaveBeenCalledWith("lms-session-resources");
    const [objectPath, buffer, opts] = upload.mock.calls[0];
    expect(objectPath).toBe(data.storage_path);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(opts).toMatchObject({ contentType: "application/pdf", upsert: true });
    expect(createBucket).not.toHaveBeenCalled();
  });

  test("a video file is validated against the video ceiling", async () => {
    upload.mockResolvedValue({ error: null });
    const res = await POST(fileRequest({ name: "intro.mp4", type: "video/mp4", kind: "video" }));
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.kind).toBe("video");
    expect(data.storage_path).toMatch(/intro\.mp4$/);
  });

  test("auto-creates the bucket once, then retries", async () => {
    upload
      .mockResolvedValueOnce({ error: { message: "Bucket not found" } })
      .mockResolvedValueOnce({ error: null });
    const res = await POST(fileRequest());
    expect(res.status).toBe(200);
    expect(createBucket).toHaveBeenCalledTimes(1);
    expect(createBucket).toHaveBeenCalledWith("lms-session-resources", { public: true });
    expect(upload).toHaveBeenCalledTimes(2);
  });

  test("persistent storage failure → 500 with an i18n key", async () => {
    upload.mockResolvedValue({ error: { message: "disk full" } });
    const res = await POST(fileRequest());
    expect(res.status).toBe(500);
    const data = await readJson(res);
    expect(data.error).toBe("lms.errors.fileUploadFailed");
  });
});

describe("DELETE /api/lms/session-resources/upload", () => {
  const delReq = (path) =>
    new Request(
      `http://localhost/api/lms/session-resources/upload${
        path ? `?path=${encodeURIComponent(path)}` : ""
      }`,
      { method: "DELETE" },
    );

  test("400 without a storage path", async () => {
    const res = await DELETE(delReq(""));
    expect(res.status).toBe(400);
    expect(remove).not.toHaveBeenCalled();
  });

  test("400 for a path outside the session-resource folder", async () => {
    const res = await DELETE(delReq("course-thumbnails/123-thumb.png"));
    expect(res.status).toBe(400);
    expect(remove).not.toHaveBeenCalled();
  });

  test("removes the orphan object", async () => {
    remove.mockResolvedValue({ error: null });
    const res = await DELETE(delReq("sessions/P-1/S-1/123-draft.pdf"));
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data).toMatchObject({ success: true, removed: true });
    expect(from).toHaveBeenCalledWith("lms-session-resources");
    expect(remove).toHaveBeenCalledWith(["sessions/P-1/S-1/123-draft.pdf"]);
  });
});

describe("session resources — storage lifecycle", () => {
  function seedProgramAndSession() {
    mockFake.seed("v2_programs", [{ id: PROGRAM, name: "Track" }]);
    mockFake.seed("v2_sessions", [
      { id: SESSION, program_id: PROGRAM, title: "Week 1", week_number: 1 },
    ]);
  }

  test("an uploaded resource keeps its file metadata", async () => {
    seedProgramAndSession();
    const resource = await createSessionResource({
      programId: PROGRAM,
      sessionId: SESSION,
      kind: "document",
      title: "Handout",
      url: PUBLIC_URL,
      source: "upload",
      storagePath: "sessions/P-2026-001/S-1/123-handout.pdf",
      fileName: "handout.pdf",
      fileSize: 2048,
      mimeType: "application/pdf",
    });
    expect(resource.source).toBe("upload");
    expect(resource.storage_path).toBe("sessions/P-2026-001/S-1/123-handout.pdf");
    expect(resource.file_name).toBe("handout.pdf");
    expect(resource.file_size).toBe(2048);
    expect(resource.mime_type).toBe("application/pdf");
  });

  test("an upload without a storage path is rejected", async () => {
    seedProgramAndSession();
    await expect(
      createSessionResource({
        programId: PROGRAM,
        sessionId: SESSION,
        title: "Handout",
        url: PUBLIC_URL,
        source: "upload",
      }),
    ).rejects.toThrow("lms.errors.resourceFileRequired");
  });

  test("an upload pointing outside the session-resource folder is rejected", async () => {
    seedProgramAndSession();
    await expect(
      createSessionResource({
        programId: PROGRAM,
        sessionId: SESSION,
        title: "Handout",
        url: PUBLIC_URL,
        source: "upload",
        storagePath: "course-thumbnails/123-thumb.png",
      }),
    ).rejects.toThrow("lms.errors.resourceFileRequired");
  });

  test("an unknown source is rejected", async () => {
    seedProgramAndSession();
    await expect(
      createSessionResource({
        programId: PROGRAM,
        sessionId: SESSION,
        title: "Handout",
        url: PUBLIC_URL,
        source: "ftp",
      }),
    ).rejects.toThrow("lms.errors.invalidResourceSource");
  });

  test("deleting an uploaded resource deletes the stored object", async () => {
    seedProgramAndSession();
    remove.mockResolvedValue({ error: null });
    const resource = await createSessionResource({
      programId: PROGRAM,
      sessionId: SESSION,
      title: "Handout",
      url: PUBLIC_URL,
      source: "upload",
      storagePath: "sessions/P-2026-001/S-1/123-handout.pdf",
      fileName: "handout.pdf",
      fileSize: 2048,
      mimeType: "application/pdf",
    });

    await deleteSessionResource(resource.id);
    expect(remove).toHaveBeenCalledWith(["sessions/P-2026-001/S-1/123-handout.pdf"]);
  });

  test("a link resource never touches storage", async () => {
    seedProgramAndSession();
    const resource = await createSessionResource({
      programId: PROGRAM,
      sessionId: SESSION,
      title: "Reader",
      url: "https://example.test/reader.pdf",
    });
    await deleteSessionResource(resource.id);
    expect(remove).not.toHaveBeenCalled();
  });
});

describe("resource preview + accepted-type helpers (learner/library rules)", () => {
  const {
    formatFileSize,
    isAcceptedResourceFile,
    resourcePreviewKind,
  } = require("@/lib/lms/constants");

  const uploaded = (overrides = {}) => ({
    source: "upload",
    url: "https://cdn.impactos.test/lms-session-resources/x",
    kind: "document",
    ...overrides,
  });

  test("only uploaded files are previewed — external links never are", () => {
    expect(resourcePreviewKind({ source: "link", url: "https://x.test/a.pdf" })).toBeNull();
    expect(resourcePreviewKind(uploaded({ mime_type: "application/pdf" }))).toBe("pdf");
  });

  test("images, PDFs and videos resolve to their preview kind", () => {
    expect(resourcePreviewKind(uploaded({ mime_type: "image/png" }))).toBe("image");
    expect(resourcePreviewKind(uploaded({ mime_type: "image/jpeg" }))).toBe("image");
    expect(resourcePreviewKind(uploaded({ mime_type: "application/pdf" }))).toBe("pdf");
    expect(
      resourcePreviewKind(uploaded({ kind: "video", mime_type: "video/mp4" })),
    ).toBe("video");
  });

  test("falls back to the filename when the browser sent no mime type", () => {
    expect(resourcePreviewKind(uploaded({ file_name: "scan.pdf" }))).toBe("pdf");
    expect(resourcePreviewKind(uploaded({ file_name: "photo.jpeg" }))).toBe("image");
    expect(
      resourcePreviewKind(uploaded({ kind: "video", file_name: "intro.webm" })),
    ).toBe("video");
  });

  test("documents we cannot render inline get no preview", () => {
    expect(
      resourcePreviewKind(uploaded({ mime_type: "application/msword", file_name: "plan.doc" })),
    ).toBeNull();
    expect(resourcePreviewKind(uploaded({ url: null }))).toBeNull();
    expect(resourcePreviewKind(null)).toBeNull();
  });

  test("accepts a file by mime type OR extension, per kind", () => {
    expect(isAcceptedResourceFile({ name: "a.pdf", type: "application/pdf" }, "document")).toBe(true);
    // Empty mime type (some browsers) still passes on the extension.
    expect(isAcceptedResourceFile({ name: "a.pdf", type: "" }, "document")).toBe(true);
    expect(isAcceptedResourceFile({ name: "a.exe", type: "application/x-msdownload" }, "document")).toBe(false);
    expect(isAcceptedResourceFile({ name: "a.mp4", type: "video/mp4" }, "video")).toBe(true);
    // A document is not a video, even though both are allowed in general.
    expect(isAcceptedResourceFile({ name: "a.pdf", type: "application/pdf" }, "video")).toBe(false);
  });

  test("formats file sizes for humans", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe("1.5 MB");
    // Whole megabytes are not padded with a useless decimal.
    expect(formatFileSize(4 * 1024 * 1024)).toBe("4 MB");
    expect(formatFileSize(0)).toBe("");
    expect(formatFileSize(null)).toBe("");
  });
});

describe("Phase 8 migrations vs domain constants (drift guard)", () => {
  const fs = require("fs");
  const path = require("path");
  const MIGRATIONS = path.join(__dirname, "../../supabase/migrations");
  const resourcesMigration = fs.readFileSync(
    path.join(MIGRATIONS, "20260916_lms_session_resources_and_coaching.sql"),
    "utf8",
  );
  const uploadsMigration = fs.readFileSync(
    path.join(MIGRATIONS, "20260917_lms_session_resource_uploads.sql"),
    "utf8",
  );

  const {
    LMS_RESOURCE_KINDS,
    LMS_RESOURCE_SOURCES,
  } = require("@/lib/lms/constants");

  test("kinds and sources match the CHECK values in lms_session_resources", () => {
    const block = resourcesMigration.match(
      /CREATE TABLE IF NOT EXISTS lms_session_resources \(([\s\S]*?)\n\);/,
    )[1];
    for (const value of LMS_RESOURCE_KINDS) expect(block).toContain(`'${value}'`);
    for (const value of LMS_RESOURCE_SOURCES) expect(block).toContain(`'${value}'`);
  });

  test("the uploads migration is additive and runs after the table is created", () => {
    expect(uploadsMigration).not.toMatch(/DROP TABLE/);
    for (const column of [
      "source TEXT",
      "storage_path TEXT",
      "file_name TEXT",
      "file_size BIGINT",
      "mime_type TEXT",
    ]) {
      expect(uploadsMigration).toContain(`ADD COLUMN IF NOT EXISTS ${column}`);
    }
    // Filename order IS apply order: 20260917 must sort after 20260916.
    expect("20260917_lms_session_resource_uploads.sql" > "20260916_lms_session_resources_and_coaching.sql").toBe(
      true,
    );
  });
});
