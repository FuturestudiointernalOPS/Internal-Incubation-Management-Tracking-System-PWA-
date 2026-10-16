/**
 * One form-row lookup (Forms vs Runs cleanup, task 1).
 *
 * Twelve model functions used to repeat `SELECT * FROM platform_forms WHERE
 * id = ?`. They now all delegate to `selectFormRowById`; each keeps its name
 * for its callers. This pins that every one of them still issues exactly that
 * statement, with the id passed through untouched (no parseInt), and returns
 * the driver result as-is.
 */

const mockExecute = jest.fn();
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: (...args) => mockExecute(...args) },
}));

const SQL = "SELECT * FROM platform_forms WHERE id = ?";

const LOOKUPS = [
  ["@/models/forms/platform", "selectFormRowById"],
  ["@/models/forms/platform", "getPlatformFormById"],
  ["@/models/formRuns/readsAndHelpers/reviews", "getFormById"],
  ["@/models/formRuns/writesPost", "getFormForSubmissionAutomationById"],
  ["@/models/formRuns/writesPost", "getFormForInsertSubmissionAutomationById"],
  ["@/models/formRuns/writesPost", "getFormForManualAddAutomationById"],
  ["@/models/formRuns/writesPost", "getFormForActivationRetryById"],
  ["@/models/formRuns/writesPost", "getFormForActivationSendById"],
  ["@/models/investorApplication", "getFormByIdForInvestorSeed"],
  ["@/models/platformAi/evaluation", "getFormForAutoApprove"],
  ["@/models/platformAi/founderAssessment", "getFormForSnapshot"],
  ["@/models/platformAi/generation", "getFormForAiAnalysis"],
  ["@/models/publicFormRuns", "getFormById"],
];

beforeEach(() => mockExecute.mockReset());

describe.each(LOOKUPS)("%s → %s", (modulePath, name) => {
  test.each([7, "7", "abc"])("issues the one statement with id %p unchanged and returns the result", async (id) => {
    const result = { rows: [{ id: 7, name: "Form" }] };
    mockExecute.mockResolvedValue(result);

    const lookup = require(modulePath)[name];
    await expect(lookup(id)).resolves.toBe(result);

    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockExecute).toHaveBeenCalledWith({ sql: SQL, args: [id] });
  });
});

test("platformImport.getPlatformFormById is a different query and stays apart", async () => {
  mockExecute.mockResolvedValue({ rows: [] });
  const { getPlatformFormById } = require("@/models/platformImport");
  await getPlatformFormById("7");
  expect(mockExecute).toHaveBeenCalledWith(
    expect.objectContaining({ sql: "SELECT id, name FROM platform_forms WHERE id = ?" }),
  );
});
