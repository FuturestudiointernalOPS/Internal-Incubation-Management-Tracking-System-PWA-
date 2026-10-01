/**
 * Characterisation tests for the remaining platform controllers.
 *
 * Pins the DECISIONS of the notifications, integrations, investor-run,
 * evaluation-config and report-file use-cases, so the suite stays valid after
 * the logic moved from the routes to `@/services/platform/*`. All repositories,
 * libs and integrations are mocked.
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [] })) },
  initDb: jest.fn(async () => true),
}));

jest.mock("@/lib/deepseek", () => ({
  deepseekIntelligence: { chat: jest.fn() },
  default: { chat: jest.fn() },
}));

jest.mock("@/lib/appUrl", () => ({ resolveAppUrl: jest.fn(() => "https://app.test") }));

const mockForms = {
  listPlatformNotifications: jest.fn(async () => ({ rows: [] })),
  markAllPlatformNotificationsRead: jest.fn(async () => ({})),
  markPlatformNotificationRead: jest.fn(async () => ({})),
};
jest.mock("@/models/forms", () => mockForms);

const mockCalendar = {
  checkCalendarHealth: jest.fn(async () => ({ provider: "google", configured: true })),
  syncRunDeadlines: jest.fn(async () => ({ synced: 2 })),
  unsyncRunDeadlines: jest.fn(async () => ({ removed: 1 })),
  syncAllRunDeadlines: jest.fn(async () => ({ runs: 3 })),
};
jest.mock("@/lib/integrations/calendar/sync", () => mockCalendar);

const mockNotion = {
  checkNotionHealth: jest.fn(() => ({ configured: false })),
  syncSubmission: jest.fn(async () => ({ synced: 1 })),
  syncAllSubmissions: jest.fn(async () => ({ submitted: 5 })),
};
jest.mock("@/lib/integrations/notion/sync", () => mockNotion);

const mockAi = {
  getEvaluationFrameworkByFormId: jest.fn(async () => ({ rows: [] })),
  upsertFormEvaluationFramework: jest.fn(async () => ({})),
  deleteEvaluationFrameworkByFormId: jest.fn(async () => ({})),
};
jest.mock("@/models/platformAi", () => mockAi);

const mockInvestorApplication = { resolveInvestorRun: jest.fn(async () => null) };
jest.mock("@/models/investorApplication", () => mockInvestorApplication);

const mockFormRuns = { getRunById: jest.fn(async () => ({ rows: [] })) };
jest.mock("@/models/formRuns", () => mockFormRuns);

const mockReportFilesModel = {
  getRunReportFileByRunId: jest.fn(async () => null),
  getRunReportFileTextByRunId: jest.fn(async () => ({ text: "body" })),
  upsertRunReportFile: jest.fn(async () => ({ id: 1, file_name: "deck.pdf" })),
  deleteRunReportFileByRunId: jest.fn(async () => null),
  runReportFileDescriptor: jest.fn((row, url) => ({ name: row.file_name, url: url || null })),
};
jest.mock("@/models/platform/reportFiles", () => mockReportFilesModel);

const mockReportFilesLib = {
  validateRunReportFile: jest.fn(() => ({ success: true })),
  uploadRunReportFileObject: jest.fn(async () => ({ success: true, storage_path: "runs/1/new.pdf" })),
  signRunReportFilePath: jest.fn(async (path) => `signed:${path}`),
  removeRunReportFileObject: jest.fn(async () => ({})),
};
jest.mock("@/lib/platform/runReportFiles", () => mockReportFilesLib);

jest.mock("@/lib/platform/runReportFileText", () => ({
  extractReportFileText: jest.fn(async () => ({ text: "extracted", status: "ok" })),
}));

const { listNotifications, markNotificationsRead } = require("@/services/platform/notifications");
const { runCalendarAction, getCalendarHealth, runNotionAction } = require("@/services/platform/integrations");
const { getInvestorRunReference } = require("@/services/platform/investorIntake");
const {
  getEvaluationFramework,
  saveEvaluationFramework,
  removeEvaluationFramework,
} = require("@/services/platform/evaluationConfig");
const {
  attachRunReportFile,
  getRunReportFilePayload,
  detachRunReportFile,
} = require("@/services/platform/reportFiles");

beforeEach(() => {
  jest.clearAllMocks();
  mockForms.listPlatformNotifications.mockResolvedValue({ rows: [] });
  mockCalendar.checkCalendarHealth.mockResolvedValue({ provider: "google", configured: true });
  mockNotion.checkNotionHealth.mockReturnValue({ configured: false });
  mockAi.getEvaluationFrameworkByFormId.mockResolvedValue({ rows: [] });
  mockInvestorApplication.resolveInvestorRun.mockResolvedValue(null);
  mockFormRuns.getRunById.mockResolvedValue({ rows: [] });
  mockReportFilesModel.getRunReportFileByRunId.mockResolvedValue(null);
  mockReportFilesLib.validateRunReportFile.mockReturnValue({ success: true });
  mockReportFilesLib.uploadRunReportFileObject.mockResolvedValue({ success: true, storage_path: "runs/1/new.pdf" });
});

describe("notifications", () => {
  test("lists with the caller's cid and the all flag", async () => {
    await listNotifications({ cid: "U1", all: true });
    expect(mockForms.listPlatformNotifications).toHaveBeenCalledWith("U1", true);
  });

  test("mark_all clears everything", async () => {
    const { status } = await markNotificationsRead({ body: { mark_all: true }, cid: "U1" });
    expect(status).toBe(200);
    expect(mockForms.markAllPlatformNotificationsRead).toHaveBeenCalledWith("U1");
  });

  test("a single id clears one", async () => {
    await markNotificationsRead({ body: { id: 9 }, cid: "U1" });
    expect(mockForms.markPlatformNotificationRead).toHaveBeenCalledWith(9, "U1");
  });

  test("neither id nor mark_all is a 400", async () => {
    const { status } = await markNotificationsRead({ body: {}, cid: "U1" });
    expect(status).toBe(400);
  });
});

describe("integrations", () => {
  test("calendar health returns the provider state", async () => {
    const { status, body } = await getCalendarHealth();
    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true, provider: "google" });
  });

  test("calendar sync without a runId is a 400", async () => {
    const { status } = await runCalendarAction({ action: "sync" });
    expect(status).toBe(400);
    expect(mockCalendar.syncRunDeadlines).not.toHaveBeenCalled();
  });

  test("calendar sync-all reports the sweep", async () => {
    const { body } = await runCalendarAction({ action: "sync-all" });
    expect(body).toMatchObject({ success: true, runs: 3 });
  });

  test("an unknown calendar action is a 400", async () => {
    const { status, body } = await runCalendarAction({ action: "wat" });
    expect(status).toBe(400);
    expect(body.error).toContain("wat");
  });

  test("notion sync requires a submissionId, sync-all does not", async () => {
    expect((await runNotionAction({ action: "sync" })).status).toBe(400);
    const { body } = await runNotionAction({ action: "sync-all" });
    expect(body).toMatchObject({ success: true, submitted: 5 });
  });
});

describe("investor-run reference", () => {
  test("a configured run yields the public URL", async () => {
    mockInvestorApplication.resolveInvestorRun.mockResolvedValue({
      id: 4,
      name: "Investor Application",
      status: "active",
      public_slug: "abc123",
    });
    const { status, body } = await getInvestorRunReference();
    expect(status).toBe(200);
    expect(body.url).toBe("https://app.test/s/abc123");
  });

  test("an unconfigured intake is a 404", async () => {
    const { status } = await getInvestorRunReference();
    expect(status).toBe(404);
  });
});

describe("evaluation-config", () => {
  test("a missing form_id is a 400", async () => {
    expect((await getEvaluationFramework({ formId: null })).status).toBe(400);
    expect((await removeEvaluationFramework({ formId: null })).status).toBe(400);
  });

  test("no stored framework answers framework: null", async () => {
    const { status, body } = await getEvaluationFramework({ formId: "5" });
    expect(status).toBe(200);
    expect(body.framework).toBeNull();
  });

  test("save requires both form_id and framework", async () => {
    expect((await saveEvaluationFramework({ form_id: 5 })).status).toBe(400);
    expect(mockAi.upsertFormEvaluationFramework).not.toHaveBeenCalled();
    expect((await saveEvaluationFramework({ form_id: 5, framework: { a: 1 } })).status).toBe(200);
  });
});

describe("run report file", () => {
  test("a missing runId is a 400 (all three verbs)", async () => {
    expect((await attachRunReportFile({ runId: NaN, file: {} })).status).toBe(400);
    expect((await getRunReportFilePayload({ runId: NaN })).status).toBe(400);
    expect((await detachRunReportFile({ runId: NaN })).status).toBe(400);
  });

  test("an invalid file is refused BEFORE anything is uploaded", async () => {
    mockReportFilesLib.validateRunReportFile.mockReturnValue({ success: false, error: "too big" });
    const { status, body } = await attachRunReportFile({ runId: 1, file: {} });
    expect(status).toBe(400);
    expect(body.error).toBe("too big");
    expect(mockReportFilesLib.uploadRunReportFileObject).not.toHaveBeenCalled();
  });

  test("an unknown run is a 404", async () => {
    const { status } = await attachRunReportFile({ runId: 1, file: {} });
    expect(status).toBe(404);
  });

  test("attaching replaces and removes the previous object only after success", async () => {
    mockFormRuns.getRunById.mockResolvedValue({ rows: [{ id: 1 }] });
    mockReportFilesModel.getRunReportFileByRunId.mockResolvedValue({ storage_path: "runs/1/old.pdf" });

    const { status, body } = await attachRunReportFile({
      runId: 1,
      file: { name: "deck.pdf", type: "application/pdf", size: 10 },
      session: { cid: "U1" },
    });

    expect(status).toBe(200);
    expect(body.file).toEqual({ name: "deck.pdf", url: null });
    expect(mockReportFilesLib.removeRunReportFileObject).toHaveBeenCalledWith("runs/1/old.pdf");
  });

  test("reading with no attachment answers file: null", async () => {
    const { status, body } = await getRunReportFilePayload({ runId: 1 });
    expect(status).toBe(200);
    expect(body.file).toBeNull();
  });

  test("reading asks for text only when requested, and reports the prompt limit", async () => {
    mockReportFilesModel.getRunReportFileByRunId.mockResolvedValue({ storage_path: "runs/1/x.pdf", file_name: "x.pdf" });

    const { body } = await getRunReportFilePayload({ runId: 1, includeText: true });
    expect(body.file.url).toBe("signed:runs/1/x.pdf");
    expect(body.text).toBe("body");
    expect(body.prompt_limit).toBeGreaterThan(0);
  });

  test("detaching removes the object only when a path came back", async () => {
    await detachRunReportFile({ runId: 1 });
    expect(mockReportFilesLib.removeRunReportFileObject).not.toHaveBeenCalled();

    mockReportFilesModel.deleteRunReportFileByRunId.mockResolvedValue("runs/1/gone.pdf");
    await detachRunReportFile({ runId: 1 });
    expect(mockReportFilesLib.removeRunReportFileObject).toHaveBeenCalledWith("runs/1/gone.pdf");
  });
});
