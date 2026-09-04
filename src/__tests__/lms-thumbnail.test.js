/**
 * LMS course thumbnail upload tests (POST /api/lms/courses/thumbnail).
 *
 * The route is a storage boundary (Supabase `course-thumbnails` bucket), so
 * @supabase/supabase-js is mocked and the REAL route handler runs end-to-end.
 * Covers:
 *   - authorization (lms.edit OR lms.create must pass)
 *   - validation (missing / wrong-type / oversized files never reach storage)
 *   - happy path (upload + public URL)
 *   - bucket auto-creation on first failure, then retry
 *   - persistent storage failure → 500 with an i18n key (never a raw error)
 */

const upload = jest.fn();
const createBucket = jest.fn();
const getPublicUrl = jest.fn();
const from = jest.fn(() => ({ upload, getPublicUrl }));
const mockSupabaseStorage = { from, createBucket };

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({ storage: mockSupabaseStorage })),
}));

jest.mock("@/lib/authorization", () => ({
  requireAuthorization: jest.fn(async () => null),
}));

const { requireAuthorization } = require("@/lib/authorization");
const { POST } = require("@/app/api/lms/courses/thumbnail/route");

const PUBLIC_URL = "https://cdn.impactos.test/course-thumbnails/123-thumb.png";
const readJson = async (res) => res.json();

const formReq = (body) =>
  new Request("http://localhost/api/lms/courses/thumbnail", {
    method: "POST",
    body,
  });

function pngRequest(overrides = {}) {
  const fd = new FormData();
  const bytes = overrides.bytes || Buffer.from("fake-png-bytes");
  fd.append(
    "file",
    new File([bytes], overrides.name || "thumbnail.png", {
      type: overrides.type || "image/png",
    }),
  );
  return formReq(fd);
}

beforeEach(() => {
  requireAuthorization.mockReset();
  requireAuthorization.mockResolvedValue(null);
  upload.mockReset();
  createBucket.mockReset();
  getPublicUrl.mockReset();
  getPublicUrl.mockReturnValue({ data: { publicUrl: PUBLIC_URL } });
});

describe("POST /api/lms/courses/thumbnail", () => {
  test("403 when neither lms.edit nor lms.create is granted — no upload", async () => {
    requireAuthorization.mockResolvedValueOnce({ status: 403 });
    requireAuthorization.mockResolvedValueOnce({ status: 403 });
    const res = await POST(pngRequest());
    expect(res.status).toBe(403);
    expect(upload).not.toHaveBeenCalled();
  });

  test("lms.create alone is enough when lms.edit is denied (OR fallback)", async () => {
    requireAuthorization.mockResolvedValueOnce({ status: 403 }); // edit denied
    // create resolves null (default) → request proceeds to validation
    const res = await POST(formReq(new FormData())); // no file on purpose
    expect(res.status).toBe(400); // validation, not authorization
    expect(upload).not.toHaveBeenCalled();
  });

  test("400 when the file field is missing", async () => {
    const res = await POST(formReq(new FormData()));
    expect(res.status).toBe(400);
    const data = await readJson(res);
    expect(data.error).toBe("lms.fields.thumbnailInvalidType");
    expect(upload).not.toHaveBeenCalled();
  });

  test("400 when both the MIME type and the extension are disallowed", async () => {
    const res = await POST(pngRequest({ name: "photo.gif", type: "image/gif" }));
    expect(res.status).toBe(400);
    const data = await readJson(res);
    expect(data.error).toBe("lms.fields.thumbnailInvalidType");
    expect(upload).not.toHaveBeenCalled();
  });

  test("400 when the file exceeds 5MB", async () => {
    const res = await POST(
      pngRequest({ bytes: Buffer.alloc(5 * 1024 * 1024 + 1) }),
    );
    expect(res.status).toBe(400);
    const data = await readJson(res);
    expect(data.error).toBe("lms.fields.thumbnailTooLarge");
    expect(upload).not.toHaveBeenCalled();
  });

  test("200 uploads the file and returns the public URL", async () => {
    upload.mockResolvedValue({ error: null });
    const res = await POST(pngRequest());
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.success).toBe(true);
    expect(data.url).toBe(PUBLIC_URL);

    expect(upload).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("course-thumbnails");
    const [fileName, buffer, opts] = upload.mock.calls[0];
    expect(fileName).toMatch(/^course-thumbnails\/\d+-thumbnail\.png$/);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(opts).toMatchObject({ contentType: "image/png", upsert: true });
    expect(createBucket).not.toHaveBeenCalled();
  });

  test("auto-creates the bucket once, then retries the upload", async () => {
    upload
      .mockResolvedValueOnce({ error: { message: "Bucket not found" } })
      .mockResolvedValueOnce({ error: null });
    const res = await POST(pngRequest());
    expect(res.status).toBe(200);
    expect(createBucket).toHaveBeenCalledTimes(1);
    expect(createBucket).toHaveBeenCalledWith("course-thumbnails", { public: true });
    expect(upload).toHaveBeenCalledTimes(2);
  });

  test("persistent storage failure → 500 with an i18n key, never a raw error", async () => {
    upload.mockResolvedValue({ error: { message: "disk full" } });
    const res = await POST(pngRequest());
    expect(res.status).toBe(500);
    const data = await readJson(res);
    expect(data.success).toBe(false);
    expect(data.error).toBe("lms.fields.thumbnailUploadFailed");
  });
});
