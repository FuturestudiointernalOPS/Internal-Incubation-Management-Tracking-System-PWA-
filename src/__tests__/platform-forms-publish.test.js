/**
 * Publishing a form — save, snapshot, run.
 *
 * Publish used to write a snapshot of the CLIENT payload and nothing else: the
 * builder was never saved, so the snapshot could pin temporary section ids the
 * database never had, and no run carried the version it published. The three
 * behaviours pinned here are the contract:
 *   1. publish saves the builder first,
 *   2. the snapshot is the SAVED rows (real ids, real section links),
 *   3. a run pinned to that version is created, live, with a versioned name.
 */
jest.mock("@/models/forms", () => ({
  archivePlatformForm: jest.fn(),
  createPlatformForm: jest.fn(),
  createPlatformFormField: jest.fn(async () => ({ rows: [] })),
  createPlatformFormSection: jest.fn(async () => ({ rows: [{ id: 1 }] })),
  createPlatformFormVersion: jest.fn(async () => ({})),
  deletePlatformEmailLogsForForm: jest.fn(),
  deletePlatformForm: jest.fn(),
  deletePlatformFormField: jest.fn(async () => ({})),
  deletePlatformFormSection: jest.fn(async () => ({})),
  deletePlatformSubmissionEvaluationsForForm: jest.fn(),
  deletePlatformSubmissionReviewsForForm: jest.fn(),
  getLatestPlatformFormVersion: jest.fn(),
  getPlatformFormById: jest.fn(),
  getPlatformFormByTextId: jest.fn(),
  getPlatformFormFields: jest.fn(),
  getPlatformFormSections: jest.fn(),
  listPlatformForms: jest.fn(),
  publishPlatformForm: jest.fn(async () => ({})),
  touchPlatformForm: jest.fn(async () => ({})),
  updatePlatformFormField: jest.fn(async () => ({})),
  updatePlatformFormMetadata: jest.fn(),
  updatePlatformFormSection: jest.fn(async () => ({})),
}));

jest.mock("@/models/investorIntake", () => ({
  assertSingleInvestorForm: jest.fn(),
  ensureSingleInvestorFormIndex: jest.fn(),
}));

jest.mock("@/models/formRuns", () => ({
  createFormRun: jest.fn(),
}));

jest.mock("@/models/platform/automation", () => ({
  onRunCreated: jest.fn(),
}));

const {
  createPlatformFormVersion,
  publishPlatformForm,
  getPlatformFormById,
  getPlatformFormSections,
  getPlatformFormFields,
  createPlatformFormSection,
} = require("@/models/forms");
const { createFormRun } = require("@/models/formRuns");
const { onRunCreated } = require("@/models/platform/automation");
const { publishFormVersion } = require("@/services/platform/forms");

const LIVE_SECTIONS = [{ id: 1, form_id: 5, title: "Profile", sort_order: 0 }];
const LIVE_FIELDS = [{ id: 10, form_id: 5, section_id: 1, label: "Company name", field_type: "text", sort_order: 0 }];

beforeEach(() => {
  jest.clearAllMocks();
  getPlatformFormById.mockResolvedValue({
    rows: [{ id: 5, name: "Founder Application", description: "Apply", version: 1, settings: { scoring: { enabled: false } } }],
  });
  getPlatformFormSections.mockResolvedValue({ rows: LIVE_SECTIONS });
  getPlatformFormFields.mockResolvedValue({ rows: LIVE_FIELDS });
  createPlatformFormSection.mockResolvedValue({ rows: [{ id: 1 }] });
  createFormRun.mockResolvedValue({
    rows: [{ id: 77, form_id: 5, form_version: 2, name: "Founder Application v2", status: "active", public_slug: "r0123456789" }],
  });
});

describe("publishFormVersion — save, snapshot, run", () => {
  test("saves the builder before snapshotting, so temporary section ids are resolved", async () => {
    const { status } = await publishFormVersion({
      id: 5,
      sections: [{ id: null, _tmpId: "tmp-1-1", title: "Profile" }],
      fields: [{ id: null, label: "Company name", section_id: "tmp-1-1" }],
      session: { cid: "U-ADMIN" },
    });

    expect(status).toBe(200);
    // The section was INSERTED during the save…
    expect(createPlatformFormSection).toHaveBeenCalledTimes(1);
    // …and the snapshot pins the rows that were just written, not the payload.
    const snapshot = JSON.parse(createPlatformFormVersion.mock.calls[0][2]);
    expect(snapshot.fields).toEqual(LIVE_FIELDS);
    expect(snapshot.sections).toEqual(LIVE_SECTIONS);
    expect(createPlatformFormVersion.mock.calls[0].slice(0, 4)).toEqual([5, 2, expect.any(String), "U-ADMIN"]);
  });

  test("bumps the form to version 2 and creates a live run pinned to it", async () => {
    const { body } = await publishFormVersion({
      id: 5,
      fields: LIVE_FIELDS,
      sections: LIVE_SECTIONS,
      session: { cid: "U-ADMIN" },
    });

    expect(publishPlatformForm).toHaveBeenCalledWith(5, 2);
    expect(createFormRun).toHaveBeenCalledWith(
      expect.objectContaining({
        form_id: 5,
        form_version: 2,
        name: "Founder Application v2",
        status: "active",
        owner_id: "U-ADMIN",
      }),
    );
    expect(onRunCreated).toHaveBeenCalledTimes(1);
    expect(body).toMatchObject({ success: true, version: 2, run: { id: 77 } });
  });

  test("publishing without a builder payload still snapshots the stored form and creates its run", async () => {
    const { body } = await publishFormVersion({ id: 5, session: { cid: "U-ADMIN" } });

    expect(createPlatformFormSection).not.toHaveBeenCalled();
    expect(createPlatformFormVersion).toHaveBeenCalledTimes(1);
    expect(body.version).toBe(2);
  });

  test("a missing form is a 404 and creates nothing", async () => {
    getPlatformFormById.mockResolvedValue({ rows: [] });

    const { status } = await publishFormVersion({ id: 999, session: { cid: "U-ADMIN" } });

    expect(status).toBe(404);
    expect(createPlatformFormVersion).not.toHaveBeenCalled();
    expect(createFormRun).not.toHaveBeenCalled();
  });
});
