/**
 * The bug this guards: a renamed, emptied or restructured finance sheet used to
 * surface as silent zeros. Nothing threw, the sync "succeeded", and the finance
 * screens simply showed 0. These tests pin the warnings that turn that into a
 * visible log line, and pin the deliberate silence when a sheet is genuinely
 * absent (optional project sheets are skipped on purpose).
 */
jest.mock("read-excel-file/node", () => ({ readSheet: jest.fn() }));

const { readSheet } = require("read-excel-file/node");
const { getSheetJSON, getSheetData, getTransactions, getSummary } = require("@/lib/finance");

const warnMock = () => global.console.warn;

beforeEach(() => {
  readSheet.mockReset();
  global.fetch = jest.fn(async () => ({
    arrayBuffer: async () => new ArrayBuffer(4),
  }));
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("a sheet that exists but carries no data", () => {
  test("warns instead of quietly returning nothing", async () => {
    readSheet.mockResolvedValue([["TRIBU FUTURE STUDIO"]]);

    const rows = await getSheetJSON("Réalisations globales");

    expect(rows).toEqual([]);
    expect(warnMock()).toHaveBeenCalledTimes(1);
    expect(warnMock().mock.calls[0][0]).toContain("Réalisations globales");
    expect(warnMock().mock.calls[0][0]).toContain("no data rows");
  });

  test("applies to the positional read as well", async () => {
    readSheet.mockResolvedValue([["Header"]]);

    await getSheetData("Suivi budgétaire");

    expect(warnMock()).toHaveBeenCalledTimes(1);
  });

  test("does not fire when only blank rows follow the first row", async () => {
    readSheet.mockResolvedValue([["Header"], [null, null], [null]]);

    await getSheetJSON("Suivi budgétaire");

    expect(warnMock()).toHaveBeenCalledTimes(1);
  });
});

describe("a sheet whose layout no longer matches what the code reads", () => {
  test("warns that the figures will read as zero", async () => {
    // Rows exist, but none of the columns the summary reads carry anything.
    readSheet.mockResolvedValue([["Unexpected"], ["1"]]);

    const summary = await getSummary("all");

    expect(summary).toEqual({ totalPlanned: 0, totalActual: 0, remaining: 0, rate: 0 });
    expect(warnMock()).toHaveBeenCalledTimes(1);
    expect(warnMock().mock.calls[0][0]).toContain("Suivi budgétaire");
    expect(warnMock().mock.calls[0][0]).toContain("read as zero");
  });

  test("stays silent when at least one watched column carries a value", async () => {
    readSheet.mockResolvedValue([
      ["TRIBU FUTURE STUDIO", null, null, null, null],
      ["2026-01-15", "supplier", "desc", "cat", 100],
    ]);

    const transactions = await getTransactions("all");

    expect(transactions).toHaveLength(1);
    expect(transactions[0].amountSpent).toBe(100);
    expect(warnMock()).not.toHaveBeenCalled();
  });
});

describe("a genuinely absent sheet", () => {
  test("stays silent — optional project sheets are skipped on purpose", async () => {
    const notFound = new Error("no such sheet");
    notFound.name = "SheetNotFoundError";
    readSheet.mockRejectedValue(notFound);

    const rows = await getSheetJSON("SEME CITY");

    expect(rows).toEqual([]);
    expect(warnMock()).not.toHaveBeenCalled();
  });
});
