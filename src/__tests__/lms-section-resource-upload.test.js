/**
 * LMS SECTION RESOURCE FILE UPLOADS — Phase 8.1 tests
 *
 * POST   /api/lms/section-resources/upload  (multipart)
 * DELETE /api/lms/section-resources/upload?path=…
 *
 * The route is a storage boundary (Supabase `lms-session-resources` bucket), so
 * @supabase/supabase-js is mocked and the REAL route handler + service run
 * end-to-end. Covers:
 *   - authorization (lms.edit) on both verbs
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
const { POST, DELETE } = require("@/app/api/lms/section-resources/upload/route");
const {
  createSectionResource,
  deleteSectionResource,
} = require("@/lib/lms/sectionResources");

const PUBLIC_URL = "https://cdn.impactos.test/lms-session-resources/sections/C-1/S-1/123-handout.pdf";
const readJson = async (res) => res.json();

const COURSE = "C-1";
const SECTION = "S-1";

/** FormData request with a browser-like File. */
function fileRequest({ name = "handout.pdf", type = "application/pdf", bytes, kind = "document" } = {}) {
  const fd = new FormData();
  fd.append(
    "file",
    new File([bytes || Buffer.from("fake-file-bytes")], name, { type }),
  );
  fd.append("kind", kind);
  fd.append("course_id", COURSE);
  fd.append("section_id", SECTION);
  return new Request("http://localhost/api/lms/section-resources/upload", {
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

describe("POST /api/lms/section-resources/upload", () => {
  test("403 when lms.edit is missing — nothing is uploaded", async () => {
    const denied = new Response("{}", { status: 403 });
    requireAuthorization.mockResolvedValueOnce(denied);
    const res = await POST(fileRequest());
    expect(res).toBe(denied);
    expect(requireAuthorization).toHaveBeenCalledWith("lms", "edit");
    expect(upload).not.toHaveBeenCalled();
  });

  test("400 when no file is provided", async () => {
    const fd = new FormData();
    fd.append("kind", "document");
    const res = await POST(
      new Request("http://localhost/api/lms/section-resources/upload", {
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
    expect(data.storage_path).toMatch(/^sections\/C-1\/S-1\/\d+-handout\.pdf$/);
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

describe("DELETE /api/lms/section-resources/upload", () => {
  const delReq = (path) =>
    new Request(
      `http://localhost/api/lms/section-resources/upload${
        path ? `?path=${encodeURIComponent(path)}` : ""
      }`,
      { method: "DELETE" },
    );

  test("400 without a storage path", async () => {
    const res = await DELETE(delReq(""));
    expect(res.status).toBe(400);
    expect(remove).not.toHaveBeenCalled();
  });

  test("400 for a path outside the section-resource folder", async () => {
    const res = await DELETE(delReq("course-thumbnails/123-thumb.png"));
    expect(res.status).toBe(400);
    expect(remove).not.toHaveBeenCalled();
  });

  test("400 for the retired program-session prefix", async () => {
    // Objects from the retired feature live under sessions/ and must never be
    // reachable through this endpoint.
    const res = await DELETE(delReq("sessions/P-1/S-1/123-draft.pdf"));
    expect(res.status).toBe(400);
    expect(remove).not.toHaveBeenCalled();
  });

  test("removes the orphan object", async () => {
    remove.mockResolvedValue({ error: null });
    const res = await DELETE(delReq("sections/C-1/S-1/123-draft.pdf"));
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data).toMatchObject({ success: true, removed: true });
    expect(from).toHaveBeenCalledWith("lms-session-resources");
    expect(remove).toHaveBeenCalledWith(["sections/C-1/S-1/123-draft.pdf"]);
  });
});

describe("section resources — storage lifecycle", () => {
  function seedCourseAndSection() {
    mockFake.seed("lms_courses", [{ id: COURSE, title: "Track", status: "published" }]);
    mockFake.seed("lms_course_sections", [
      { id: SECTION, course_id: COURSE, title: "Week 1", position: 0 },
    ]);
  }

  test("an uploaded resource keeps its file metadata", async () => {
    seedCourseAndSection();
    const resource = await createSectionResource({
      sectionId: SECTION,
      kind: "document",
      title: "Handout",
      url: PUBLIC_URL,
      source: "upload",
      storagePath: "sections/C-1/S-1/123-handout.pdf",
      fileName: "handout.pdf",
      fileSize: 2048,
      mimeType: "application/pdf",
    });
    expect(resource.source).toBe("upload");
    expect(resource.section_id).toBe(SECTION);
    expect(resource.storage_path).toBe("sections/C-1/S-1/123-handout.pdf");
    expect(resource.file_name).toBe("handout.pdf");
    expect(resource.file_size).toBe(2048);
    expect(resource.mime_type).toBe("application/pdf");
  });

  test("an upload without a storage path is rejected", async () => {
    seedCourseAndSection();
    await expect(
      createSectionResource({
        sectionId: SECTION,
        title: "Handout",
        url: PUBLIC_URL,
        source: "upload",
      }),
    ).rejects.toThrow("lms.errors.resourceFileRequired");
  });

  test("an upload pointing outside the section-resource folder is rejected", async () => {
    seedCourseAndSection();
    await expect(
      createSectionResource({
        sectionId: SECTION,
        title: "Handout",
        url: PUBLIC_URL,
        source: "upload",
        storagePath: "course-thumbnails/123-thumb.png",
      }),
    ).rejects.toThrow("lms.errors.resourceFileRequired");
  });

  test("an upload pointing at the retired program-session prefix is rejected", async () => {
    seedCourseAndSection();
    await expect(
      createSectionResource({
        sectionId: SECTION,
        title: "Handout",
        url: PUBLIC_URL,
        source: "upload",
        storagePath: "sessions/P-2026-001/S-1/123-handout.pdf",
      }),
    ).rejects.toThrow("lms.errors.resourceFileRequired");
  });

  test("an unknown source is rejected", async () => {
    seedCourseAndSection();
    await expect(
      createSectionResource({
        sectionId: SECTION,
        title: "Handout",
        url: PUBLIC_URL,
        source: "ftp",
      }),
    ).rejects.toThrow("lms.errors.invalidResourceSource");
  });

  test("deleting an uploaded resource deletes the stored object", async () => {
    seedCourseAndSection();
    remove.mockResolvedValue({ error: null });
    const resource = await createSectionResource({
      sectionId: SECTION,
      title: "Handout",
      url: PUBLIC_URL,
      source: "upload",
      storagePath: "sections/C-1/S-1/123-handout.pdf",
      fileName: "handout.pdf",
      fileSize: 2048,
      mimeType: "application/pdf",
    });

    await deleteSectionResource(resource.id);
    expect(remove).toHaveBeenCalledWith(["sections/C-1/S-1/123-handout.pdf"]);
  });

  test("a link resource never touches storage", async () => {
    seedCourseAndSection();
    const resource = await createSectionResource({
      sectionId: SECTION,
      title: "Reader",
      url: "https://example.test/reader.pdf",
    });
    await deleteSectionResource(resource.id);
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

describe("Section resources migration vs domain constants (drift guard)", () => {
  const fs = require("fs");
  const path = require("path");
  const MIGRATIONS = path.join(__dirname, "../../supabase/migrations");
  const sectionMigration = fs.readFileSync(
    path.join(MIGRATIONS, "20260918_lms_section_resources.sql"),
    "utf8",
  );

  const {
    LMS_RESOURCE_KINDS,
    LMS_RESOURCE_SOURCES,
  } = require("@/lib/lms/constants");

  test("kinds and sources match the CHECK values in lms_section_resources", () => {
    const block = sectionMigration.match(
      /CREATE TABLE IF NOT EXISTS lms_section_resources \(([\s\S]*?)\n\);/,
    )[1];
    for (const value of LMS_RESOURCE_KINDS) expect(block).toContain(`'${value}'`);
    for (const value of LMS_RESOURCE_SOURCES) expect(block).toContain(`'${value}'`);
  });

  test("the section table carries the upload columns and cascades with its section", () => {
    for (const column of [
      "source TEXT",
      "storage_path TEXT",
      "file_name TEXT",
      "file_size BIGINT",
      "mime_type TEXT",
    ]) {
      expect(sectionMigration).toContain(column);
    }
    // A section's material dies with the section.
    expect(sectionMigration).toContain("REFERENCES lms_course_sections(id) ON DELETE CASCADE");
    // Filename order IS apply order: 20260918 must sort after the LMS
    // foundation (20260827) that creates lms_course_sections.
    expect("20260918_lms_section_resources.sql" > "20260827_lms_foundation.sql").toBe(true);
  });
});
