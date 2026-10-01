/**
 * Characterisation tests for the platform Forms + Collections services.
 *
 * Pins the DECISIONS — the version-snapshot fallback, the FK-safe builder save
 * (fields re-pointed before sections are deleted), the single-investor guard,
 * the collections tree and the slug — so the suite stays valid after the logic
 * moved from the routes to `@/services/platform/{forms,collections}`. The
 * repository is mocked.
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [] })) },
  initDb: jest.fn(async () => true),
}));

const mockForms = {
  getPlatformFormByTextId: jest.fn(),
  getPlatformFormSections: jest.fn(async () => ({ rows: [] })),
  getPlatformFormFields: jest.fn(async () => ({ rows: [] })),
  getLatestPlatformFormVersion: jest.fn(async () => ({ rows: [] })),
  listPlatformForms: jest.fn(async () => ({ rows: [] })),
  getPlatformFormById: jest.fn(async () => ({ rows: [] })),
  createPlatformFormVersion: jest.fn(async () => ({})),
  publishPlatformForm: jest.fn(async () => ({})),
  createPlatformForm: jest.fn(async () => ({ rows: [{ id: 7 }] })),
  updatePlatformFormSection: jest.fn(async () => ({})),
  createPlatformFormSection: jest.fn(async () => ({})),
  deletePlatformFormField: jest.fn(async () => ({})),
  updatePlatformFormField: jest.fn(async () => ({})),
  createPlatformFormField: jest.fn(async () => ({})),
  deletePlatformFormSection: jest.fn(async () => ({})),
  touchPlatformForm: jest.fn(async () => ({})),
  updatePlatformFormMetadata: jest.fn(async () => ({ rows: [{ id: 7 }] })),
  deletePlatformEmailLogsForForm: jest.fn(async () => ({})),
  deletePlatformSubmissionReviewsForForm: jest.fn(async () => ({})),
  deletePlatformSubmissionEvaluationsForForm: jest.fn(async () => ({})),
  deletePlatformForm: jest.fn(async () => ({})),
  archivePlatformForm: jest.fn(async () => ({})),
  getPlatformCollectionById: jest.fn(),
  listPlatformCollections: jest.fn(async () => ({ rows: [] })),
  getPlatformCollectionParentById: jest.fn(async () => ({ rows: [] })),
  createPlatformCollection: jest.fn(async () => ({ rows: [{ id: 3 }] })),
  getPlatformCollectionForUpdate: jest.fn(async () => ({ rows: [] })),
  updatePlatformCollection: jest.fn(async () => ({ rows: [{ id: 3 }] })),
  archivePlatformCollection: jest.fn(async () => ({ rows: [] })),
  createPlatformCollectionAuditLog: jest.fn(async () => ({})),
};
jest.mock("@/models/forms", () => mockForms);

const mockIntake = {
  assertSingleInvestorForm: jest.fn(async () => ({ ok: true })),
  ensureSingleInvestorFormIndex: jest.fn(async () => true),
};
jest.mock("@/models/investorIntake", () => mockIntake);

const {
  getFormDetail,
  saveFormBuilder,
  guardInvestorIntake,
} = require("@/services/platform/forms");
const { listCollections, createCollection } = require("@/services/platform/collections");

beforeEach(() => {
  jest.clearAllMocks();
  mockForms.getPlatformFormSections.mockResolvedValue({ rows: [] });
  mockForms.getPlatformFormFields.mockResolvedValue({ rows: [] });
  mockForms.getLatestPlatformFormVersion.mockResolvedValue({ rows: [] });
  mockForms.listPlatformForms.mockResolvedValue({ rows: [] });
  mockForms.createPlatformForm.mockResolvedValue({ rows: [{ id: 7 }] });
  mockForms.listPlatformCollections.mockResolvedValue({ rows: [] });
  mockForms.getPlatformCollectionParentById.mockResolvedValue({ rows: [] });
  mockForms.createPlatformCollection.mockResolvedValue({ rows: [{ id: 3 }] });
  mockIntake.assertSingleInvestorForm.mockResolvedValue({ ok: true });
});

describe("getFormDetail — the snapshot fallback", () => {
  test("a missing form is a 404", async () => {
    mockForms.getPlatformFormByTextId.mockResolvedValue({ rows: [] });
    const { status } = await getFormDetail("nope");
    expect(status).toBe(404);
  });

  test("a published, empty, not-edited-since-publish form falls back to its snapshot", async () => {
    mockForms.getPlatformFormByTextId.mockResolvedValue({
      rows: [{ status: "published", updated_at: "2026-01-01T00:00:00.000Z" }],
    });
    mockForms.getLatestPlatformFormVersion.mockResolvedValue({
      rows: [{ created_at: "2026-02-01T00:00:00.000Z", snapshot: { sections: [{ id: 1 }], fields: [{ id: 2 }] } }],
    });

    const { status, body } = await getFormDetail(5);
    expect(status).toBe(200);
    expect(body.sections).toEqual([{ id: 1 }]);
    expect(body.fields).toEqual([{ id: 2 }]);
  });

  test("a form edited AFTER the snapshot keeps its (intentionally cleared) live tables", async () => {
    mockForms.getPlatformFormByTextId.mockResolvedValue({
      rows: [{ status: "published", updated_at: "2026-03-01T00:00:00.000Z" }],
    });
    mockForms.getLatestPlatformFormVersion.mockResolvedValue({
      rows: [{ created_at: "2026-02-01T00:00:00.000Z", snapshot: { sections: [{ id: 1 }], fields: [{ id: 2 }] } }],
    });

    const { body } = await getFormDetail(5);
    expect(body.sections).toEqual([]);
    expect(body.fields).toEqual([]);
  });
});

describe("saveFormBuilder — FK-safe ordering", () => {
  test("a field that points at a section being deleted is nulled, and the section is deleted after", async () => {
    const calls = [];
    mockForms.updatePlatformFormField.mockImplementation(async (arg) => { calls.push(["field", arg.sectionId]); });

    const { status } = await saveFormBuilder({
      id: 1,
      sections: [{ id: 10, _delete: true }],
      fields: [{ id: 20, section_id: "10" }],
    });

    expect(status).toBe(200);
    // The field was re-pointed to null (its section is going away)...
    expect(calls).toEqual([["field", null]]);
    // ...and the section was deleted only afterwards.
    expect(mockForms.deletePlatformFormSection).toHaveBeenCalledWith({ formId: 1, sectionId: 10 });
  });

  test("a field with a non-numeric temp section id is nulled", async () => {
    mockForms.createPlatformFormField.mockResolvedValue({});
    await saveFormBuilder({ id: 1, fields: [{ id: null, section_id: "_tmp_x" }] });
    expect(mockForms.createPlatformFormField).toHaveBeenCalledWith(
      expect.objectContaining({ sectionId: null }),
    );
  });

  test("a missing id is a 400", async () => {
    const { status } = await saveFormBuilder({ fields: [] });
    expect(status).toBe(400);
  });
});

describe("guardInvestorIntake", () => {
  test("does nothing when the form does not claim the investor flag", async () => {
    const result = await guardInvestorIntake({ settings: { other: true } });
    expect(result.ok).toBe(true);
    expect(mockIntake.assertSingleInvestorForm).not.toHaveBeenCalled();
  });

  test("refuses a second investor form (409, SINGLE_INVESTOR_FORM)", async () => {
    mockIntake.assertSingleInvestorForm.mockResolvedValue({ ok: false, owner: { name: "Existing" } });
    const result = await guardInvestorIntake({ form_id: null, settings: { investor_application: true } });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(409);
    expect(result.body.code).toBe("SINGLE_INVESTOR_FORM");
    expect(result.body.error).toContain("Existing");
  });

  test("probing an existing flagged form re-flags it when nothing else owns the flag", async () => {
    const result = await guardInvestorIntake({ form_id: 9, settings: { investor_application: true } });
    expect(result.ok).toBe(true);
    expect(mockIntake.assertSingleInvestorForm).toHaveBeenCalledWith(9);
    expect(mockIntake.ensureSingleInvestorFormIndex).toHaveBeenCalled();
  });
});

describe("collections", () => {
  test("listCollections nests children at any depth", async () => {
    mockForms.listPlatformCollections.mockResolvedValue({
      rows: [
        { id: 1, parent_id: null },
        { id: 2, parent_id: 1 },
        { id: 3, parent_id: 2 },
      ],
    });

    const { body } = await listCollections({});
    expect(body.tree).toHaveLength(1);
    expect(body.tree[0].children[0].children[0].id).toBe(3);
    expect(body.collections).toHaveLength(3);
  });

  test("createCollection refuses a missing name and an unknown parent", async () => {
    const noName = await createCollection({ body: { name: "  " }, session: { cid: "U1" } });
    expect(noName.status).toBe(400);

    mockForms.getPlatformCollectionParentById.mockResolvedValue({ rows: [] });
    const badParent = await createCollection({ body: { name: "Ok", parent_id: 99 }, session: { cid: "U1" } });
    expect(badParent.status).toBe(400);
    expect(mockForms.createPlatformCollection).not.toHaveBeenCalled();
  });

  test("createCollection slugs the name with a time suffix", async () => {
    const { body } = await createCollection({ body: { name: "My Program!" }, session: { cid: "U1" } });
    expect(body.success).toBe(true);
    const arg = mockForms.createPlatformCollection.mock.calls[0][0];
    expect(arg.slug).toMatch(/^my-program-[a-z0-9]+$/);
    expect(arg.created_by).toBe("U1");
  });
});
