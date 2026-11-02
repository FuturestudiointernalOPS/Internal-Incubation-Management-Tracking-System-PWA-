/**
 * The form builder save — a field may never point at a section that is gone.
 *
 * `platform_form_fields.section_id` is a foreign key. The client can still hold
 * a section id that was deleted in an earlier request (or in another tab), and
 * writing it used to reject the WHOLE save with
 * "platform_form_fields_section_id_fkey". A field with no section is
 * recoverable; a rejected save is not.
 */
jest.mock("@/models/forms", () => ({
  archivePlatformForm: jest.fn(),
  createPlatformForm: jest.fn(),
  createPlatformFormField: jest.fn(async () => ({ rows: [] })),
  createPlatformFormSection: jest.fn(async () => ({ rows: [{ id: 8 }] })),
  createPlatformFormVersion: jest.fn(),
  deletePlatformEmailLogsForForm: jest.fn(),
  deletePlatformForm: jest.fn(),
  deletePlatformFormField: jest.fn(),
  deletePlatformFormSection: jest.fn(),
  deletePlatformSubmissionEvaluationsForForm: jest.fn(),
  deletePlatformSubmissionReviewsForForm: jest.fn(),
  getLatestPlatformFormVersion: jest.fn(),
  getPlatformFormById: jest.fn(),
  getPlatformFormByTextId: jest.fn(),
  getPlatformFormFields: jest.fn(),
  getPlatformFormSections: jest.fn(),
  listPlatformForms: jest.fn(),
  publishPlatformForm: jest.fn(),
  touchPlatformForm: jest.fn(),
  updatePlatformFormField: jest.fn(async () => ({ rows: [] })),
  updatePlatformFormMetadata: jest.fn(),
  updatePlatformFormSection: jest.fn(),
}));

jest.mock("@/models/investorIntake", () => ({
  assertSingleInvestorForm: jest.fn(),
  ensureSingleInvestorFormIndex: jest.fn(),
}));

const {
  getPlatformFormSections,
  createPlatformFormField,
  createPlatformFormSection,
  updatePlatformFormField,
  updatePlatformFormSection,
} = require("@/models/forms");
const { saveFormBuilder } = require("@/services/platform/forms");

beforeEach(() => {
  jest.clearAllMocks();
  // Section 7 is the only section this form actually has.
  getPlatformFormSections.mockResolvedValue({ rows: [{ id: 7 }] });
});

test("a field pointing at a section that no longer exists is saved without a section", async () => {
  const result = await saveFormBuilder({
    id: 42,
    sections: [],
    // 99 was deleted in an earlier request; the page still holds it.
    fields: [{ id: 5, label: "Company name", section_id: 99 }],
  });

  expect(result.status).toBe(200);
  expect(createPlatformFormField).not.toHaveBeenCalled();
  expect(updatePlatformFormField).toHaveBeenCalledTimes(1);
  expect(updatePlatformFormField.mock.calls[0][0]).toMatchObject({ sectionId: null });
});

test("a field pointing at a live section keeps it", async () => {
  await saveFormBuilder({
    id: 42,
    sections: [],
    fields: [{ id: 5, label: "Company name", section_id: 7 }],
  });

  expect(updatePlatformFormField.mock.calls[0][0]).toMatchObject({ sectionId: 7 });
});

test("a brand new field follows the same rule", async () => {
  await saveFormBuilder({
    id: 42,
    sections: [],
    fields: [
      { label: "Live", section_id: 7 },
      { label: "Orphan", section_id: 404 },
    ],
  });

  expect(createPlatformFormField).toHaveBeenCalledTimes(2);
  expect(createPlatformFormField.mock.calls[0][0]).toMatchObject({ sectionId: 7 });
  expect(createPlatformFormField.mock.calls[1][0]).toMatchObject({ sectionId: null });
});

test("the save still succeeds when a section is deleted in the same request", async () => {
  const result = await saveFormBuilder({
    id: 42,
    sections: [{ id: 7, _delete: true }],
    fields: [{ id: 5, label: "Company name", section_id: 7 }],
  });

  expect(result.status).toBe(200);
  expect(updatePlatformFormField.mock.calls[0][0]).toMatchObject({ sectionId: null });
});

test("a field in a section that was just added keeps that section", async () => {
  // The builder has not saved the section yet, so its id is a temporary string.
  // createPlatformFormSection is mocked to return id 8.
  const result = await saveFormBuilder({
    id: 42,
    sections: [{ id: null, _tmpId: "tmp-1-2", title: "Legal" }],
    fields: [{ id: null, label: "Registration number", section_id: "tmp-1-2" }],
  });

  expect(result.status).toBe(200);
  expect(createPlatformFormSection).toHaveBeenCalledTimes(1);
  expect(createPlatformFormField.mock.calls[0][0]).toMatchObject({ sectionId: 8 });
});

test("a section still carrying its temporary id is INSERTED, not silently dropped", async () => {
  const result = await saveFormBuilder({
    id: 42,
    sections: [{ id: "tmp-9-1", title: "Impact" }],
    fields: [{ id: null, label: "Beneficiaries", section_id: "tmp-9-1" }],
  });

  expect(result.status).toBe(200);
  expect(createPlatformFormSection).toHaveBeenCalledTimes(1);
  expect(updatePlatformFormSection).not.toHaveBeenCalled();
  expect(createPlatformFormField.mock.calls[0][0]).toMatchObject({ sectionId: 8 });
});

test("a duplicated form re-links its fields to the copied sections", async () => {
  createPlatformFormSection
    .mockResolvedValueOnce({ rows: [{ id: 8 }] })
    .mockResolvedValueOnce({ rows: [{ id: 9 }] });

  const result = await saveFormBuilder({
    id: 42,
    // The copy's sections carry keys derived from the source ids.
    sections: [
      { id: null, _tmpId: "dup-11", title: "Profile" },
      { id: null, _tmpId: "dup-12", title: "Market" },
    ],
    fields: [
      { id: null, label: "Company name", section_id: "dup-11" },
      { id: null, label: "Customers", section_id: "dup-12" },
    ],
  });

  expect(result.status).toBe(200);
  const createdSections = createPlatformFormSection.mock.calls.length;
  expect(createdSections).toBe(2);
  const mappedIds = createPlatformFormField.mock.calls.map((call) => call[0].sectionId);
  expect(mappedIds).toEqual([8, 9]);
});
