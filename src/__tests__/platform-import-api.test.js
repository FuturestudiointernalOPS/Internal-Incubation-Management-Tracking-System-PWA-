/**
 * Characterisation tests for the platform import slice.
 *
 * Pins the import DECISIONS — the column→question fuzzy match (preview), the
 * lookup-first contact resolution and the row loop (execute) — so the suite
 * stays valid after the logic moved from the routes to
 * `@/services/platform/import`. The repository and email layers are mocked.
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [] })) },
  initDb: jest.fn(async () => true),
}));

jest.mock("@/server/auth/guards", () => ({
  requireAuth: jest.fn(async () => null),
}));

jest.mock("@/lib/email", () => ({
  resolveSubmissionEmail: jest.fn(({ contactEmail }) => contactEmail || ""),
}));

const mockImport = {
  getFormRunByIdForPreview: jest.fn(),
  getPlatformFormById: jest.fn(),
  getFormFieldsForPreview: jest.fn(),
  getFormRunByIdForImport: jest.fn(),
  getFormFieldLabels: jest.fn(async () => ({ rows: [] })),
  ensureImportBatchesTable: jest.fn(async () => ({})),
  ensureImportReviewFlagsTable: jest.fn(async () => ({})),
  findPreviousImportBatch: jest.fn(async () => ({ rows: [] })),
  createImportBatch: jest.fn(async () => ({ rows: [{ id: 77 }] })),
  findContactByCidForImport: jest.fn(async () => ({ rows: [] })),
  findContactByLowerEmailForImport: jest.fn(async () => ({ rows: [] })),
  findContactByPhoneForImport: jest.fn(async () => ({ rows: [] })),
  selectAllContactsForImport: jest.fn(async () => ({ rows: [] })),
  upsertImportedContact: jest.fn(async (cid, name, email) => ({ rows: [{ cid, name, email }] })),
  findSubmissionByRunAndSubmitter: jest.fn(async () => ({ rows: [] })),
  createPlatformFormSubmission: jest.fn(async () => ({})),
  createImportReviewFlag: jest.fn(async () => ({})),
  accumulateImportBatchCounts: jest.fn(async () => ({})),
  listImportReviewFlags: jest.fn(async () => ({ rows: [] })),
  updateImportReviewFlagStatus: jest.fn(async () => ({ rows: [] })),
};
jest.mock("@/models/platformImport", () => mockImport);

const { buildImportPreview, executeImport, fuzzyMatchColumns, listReviewFlags, setReviewFlagStatus } =
  require("@/services/platform/import");

beforeEach(() => {
  jest.clearAllMocks();
  mockImport.getFormFieldsForPreview.mockResolvedValue({ rows: [] });
  mockImport.getFormFieldLabels.mockResolvedValue({ rows: [] });
  mockImport.getFormRunByIdForImport.mockResolvedValue({ rows: [{ id: 9, name: "Run 9", form_id: 5 }] });
  mockImport.createImportBatch.mockResolvedValue({ rows: [{ id: 77 }] });
  mockImport.findPreviousImportBatch.mockResolvedValue({ rows: [] });
  mockImport.upsertImportedContact.mockImplementation(async (cid, name, email) => ({
    rows: [{ cid, name, email }],
  }));
  mockImport.findSubmissionByRunAndSubmitter.mockResolvedValue({ rows: [] });
  mockImport.listImportReviewFlags.mockResolvedValue({ rows: [] });
});

describe("fuzzyMatchColumns", () => {
  test("maps a column to the question whose label it overlaps, and leaves the rest unmatched", () => {
    const fields = [
      { id: 1, label: "Full Name" },
      { id: 2, label: "Email Address" },
    ];
    const { mapping, unmatched } = fuzzyMatchColumns(["Full Name", "Favourite Colour"], fields);

    expect(mapping["Full Name"]).toBe(1);
    expect(unmatched).toEqual(["Favourite Colour"]);
  });

  test("a question is claimed by only one column", () => {
    const fields = [{ id: 1, label: "Email" }];
    const { mapping } = fuzzyMatchColumns(["Email", "Email"], fields);
    expect(Object.values(mapping)).toEqual([1]);
  });
});

describe("buildImportPreview", () => {
  test("refuses a payload with neither a run nor a form (400)", async () => {
    const { status } = await buildImportPreview({ csv_text: "a,b\n1,2" });
    expect(status).toBe(400);
  });

  test("a run determines the form, ignoring a mismatched client form_id", async () => {
    mockImport.getFormRunByIdForPreview.mockResolvedValue({ rows: [{ id: 3, name: "Run 3", form_id: 42 }] });
    mockImport.getPlatformFormById.mockResolvedValue({ rows: [{ id: 42, name: "The run's form" }] });
    mockImport.getFormFieldsForPreview.mockResolvedValue({
      rows: [{ id: 1, label: "Full Name", field_type: "text", options: null, required: true }],
    });

    const { status, body } = await buildImportPreview({
      csv_text: "Full Name\nAda Lovelace",
      form_id: 999,
      run_id: 3,
    });

    expect(status).toBe(200);
    expect(mockImport.getPlatformFormById).toHaveBeenCalledWith("42");
    expect(body.form).toEqual({ id: 42, name: "The run's form" });
    expect(body.suggested_mapping).toEqual([
      { csv_column: "Full Name", field_id: 1, field_label: "Full Name" },
    ]);
    expect(body.total_rows).toBe(1);
  });

  test("a run that does not exist is a 404", async () => {
    mockImport.getFormRunByIdForPreview.mockResolvedValue({ rows: [] });
    const { status } = await buildImportPreview({ csv_text: "a\n1", run_id: 404 });
    expect(status).toBe(404);
  });
});

describe("executeImport", () => {
  test("creates a submission for a row with no existing contact, and reports the batch", async () => {
    mockImport.findContactByLowerEmailForImport.mockResolvedValue({ rows: [] });

    const { status, body } = await executeImport({
      form_id: 5,
      run_id: 9,
      mapping: { "Full Name": "_name", Email: "_email" },
      csv_rows: [{ "Full Name": "Ada", Email: "ada@example.org" }],
      file_hash: "deadbeef",
    });

    expect(status).toBe(200);
    expect(body.imported).toBe(1);
    expect(body.total).toBe(1);
    expect(body.batch).toEqual({ id: 77, file_hash: "deadbeef" });
    expect(mockImport.createPlatformFormSubmission).toHaveBeenCalledTimes(1);
    // Email matched nothing, so a new contact was created.
    expect(mockImport.upsertImportedContact).toHaveBeenCalledTimes(1);
  });

  test("a row whose submitter already has a submission in the run is skipped", async () => {
    mockImport.findContactByLowerEmailForImport.mockResolvedValue({ rows: [{ cid: "USER_1", name: "Ada" }] });
    mockImport.findSubmissionByRunAndSubmitter.mockResolvedValue({ rows: [{ id: 1 }] });

    const { body } = await executeImport({
      form_id: 5,
      run_id: 9,
      mapping: { Email: "_email" },
      csv_rows: [{ Email: "ada@example.org" }],
      file_hash: "h",
    });

    expect(body.imported).toBe(0);
    expect(body.skipped).toBe(1);
    expect(mockImport.createPlatformFormSubmission).not.toHaveBeenCalled();
  });

  test("a name-only match is imported but flagged needs_review", async () => {
    mockImport.findContactByLowerEmailForImport.mockResolvedValue({ rows: [] });
    mockImport.selectAllContactsForImport.mockResolvedValue({
      rows: [{ cid: "USER_9", name: "Lovelace Ada" }],
    });

    const { body } = await executeImport({
      form_id: 5,
      run_id: 9,
      mapping: { Name: "_name" },
      csv_rows: [{ Name: "Ada Lovelace" }],
      file_hash: "h",
    });

    expect(body.imported).toBe(1);
    expect(body.needs_review).toBe(1);
    expect(body.review_rows[0]).toMatchObject({ matched_cid: "USER_9", method: "name" });
    expect(mockImport.createImportReviewFlag).toHaveBeenCalledTimes(1);
  });

  test("an empty row is skipped", async () => {
    const { body } = await executeImport({
      form_id: 5,
      run_id: 9,
      mapping: { Email: "_email" },
      csv_rows: [{ Email: "" }],
      file_hash: "h",
    });
    expect(body.skipped).toBe(1);
    expect(body.imported).toBe(0);
  });
});

describe("review flags", () => {
  test("lists flags with their stored rows", async () => {
    mockImport.listImportReviewFlags.mockResolvedValue({ rows: [{ id: 1 }] });
    const { status, body } = await listReviewFlags({ status: "pending", runId: "9", formId: null });
    expect(status).toBe(200);
    expect(body.flags).toEqual([{ id: 1 }]);
  });

  test("setting a flag without an id is a 400", async () => {
    const { status } = await setReviewFlagStatus({ status: "resolved" });
    expect(status).toBe(400);
  });

  test("an unknown status is a 400", async () => {
    const { status } = await setReviewFlagStatus({ id: 1, status: "bogus" });
    expect(status).toBe(400);
    expect(mockImport.updateImportReviewFlagStatus).not.toHaveBeenCalled();
  });
});
