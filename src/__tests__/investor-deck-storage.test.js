jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(),
}));

const { createClient } = require("@supabase/supabase-js");
const {
  signInvestorDeckFile,
  uploadInvestorDeckFile,
  validateInvestorDeckFile,
} = require("@/lib/investorDeckStorage");

const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe("investor pitch deck storage", () => {
  const upload = jest.fn();
  const createSignedUrl = jest.fn();
  const storage = {
    getBucket: jest.fn(),
    createBucket: jest.fn(),
    from: jest.fn(() => ({ upload, createSignedUrl })),
  };
  const client = { storage };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
    createClient.mockReturnValue(client);
    storage.getBucket.mockResolvedValue({ data: { public: false }, error: null });
    storage.createBucket.mockResolvedValue({ error: null });
    upload.mockResolvedValue({ error: null });
    createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://signed.example/deck" }, error: null });
  });

  afterAll(() => {
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalServiceKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("validates the PDF extension, MIME type and size", () => {
    expect(validateInvestorDeckFile({
      name: "pitch.pdf",
      type: "application/pdf",
      size: 12,
      arrayBuffer: async () => Buffer.from("%PDF-1.7"),
    })).toEqual({ success: true });

    expect(validateInvestorDeckFile({
      name: "pitch.exe",
      type: "application/pdf",
      size: 12,
      arrayBuffer: async () => Buffer.from("bad"),
    })).toMatchObject({ success: false });
    expect(validateInvestorDeckFile({
      name: "too-large.pdf",
      type: "application/pdf",
      size: 10 * 1024 * 1024 + 1,
      arrayBuffer: async () => Buffer.from("%PDF-1.7"),
    })).toMatchObject({ success: false });
  });

  it("uploads a PDF to a verified private bucket using a generated path", async () => {
    const result = await uploadInvestorDeckFile({
      dealFlowEntryId: "42",
      file: {
        name: "Pitch deck.pdf",
        type: "application/pdf",
        size: 9,
        arrayBuffer: async () => Buffer.from("%PDF-1.7"),
      },
    });

    expect(result).toMatchObject({ success: true, storagePath: expect.stringMatching(/^deal-flow\/42\//) });
    expect(upload).toHaveBeenCalledWith(
      result.storagePath,
      expect.any(Buffer),
      expect.objectContaining({ contentType: "application/pdf", upsert: false }),
    );
    expect(storage.createBucket).not.toHaveBeenCalled();
  });

  it("rejects content without a PDF signature", async () => {
    const result = await uploadInvestorDeckFile({
      dealFlowEntryId: "42",
      file: {
        name: "Pitch deck.pdf",
        type: "application/pdf",
        size: 9,
        arrayBuffer: async () => Buffer.from("not a PDF"),
      },
    });

    expect(result).toMatchObject({ success: false });
    expect(storage.getBucket).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it("refuses to upload or sign files from a public bucket", async () => {
    storage.getBucket.mockResolvedValue({ data: { public: true }, error: null });

    const result = await uploadInvestorDeckFile({
      dealFlowEntryId: "42",
      file: {
        name: "Pitch deck.pdf",
        type: "application/pdf",
        size: 9,
        arrayBuffer: async () => Buffer.from("%PDF-1.7"),
      },
    });

    expect(result).toMatchObject({ success: false });
    expect(upload).not.toHaveBeenCalled();
    await expect(signInvestorDeckFile("deal-flow/42/deck.pdf")).resolves.toBeNull();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("does not create storage resources while serving an investor deck", async () => {
    storage.getBucket.mockResolvedValue({
      data: null,
      error: { message: "Bucket not found" },
    });

    await expect(signInvestorDeckFile("deal-flow/42/deck.pdf")).resolves.toBeNull();

    expect(storage.createBucket).not.toHaveBeenCalled();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });
});
