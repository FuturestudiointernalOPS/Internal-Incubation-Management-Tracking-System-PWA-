/**
 * Lane L2 — the sheet choice moved out of the plan-import controller
 * (`services/ventures/planImportFlow.js`, choosePlanSheet).
 */
jest.mock("@/models/venturePlanImport", () => ({}));

const { choosePlanSheet } = require("@/services/ventures/planImportFlow");

const sheet = (name) => ({ name, rows: [] });

describe("choosePlanSheet", () => {
  test("the caller's answer wins, matched by normalised name", () => {
    expect(choosePlanSheet([sheet("Budget"), sheet("Activities")], "activities")).toEqual({ ok: true, name: "Activities" });
  });

  test("an answer that names no sheet is a question, with the sheet list", () => {
    expect(choosePlanSheet([sheet("Budget"), sheet("Activities")], "Plan")).toEqual({
      ok: false,
      error: 'This workbook has no sheet named "Plan".',
      needsSheetChoice: true,
      sheets: ["Budget", "Activities"],
    });
  });

  test("a sheet called Tracker is taken without asking", () => {
    expect(choosePlanSheet([sheet("Budget"), sheet("Tracker")], "")).toEqual({ ok: true, name: "Tracker" });
  });

  test("a single sheet is taken without asking", () => {
    expect(choosePlanSheet([sheet("Sheet1")], "")).toEqual({ ok: true, name: "Sheet1" });
  });

  test("several sheets and none named Tracker is a question", () => {
    const result = choosePlanSheet([sheet("A"), sheet("B")], "");
    expect(result).toMatchObject({ ok: false, needsSheetChoice: true, sheets: ["A", "B"] });
    expect(result.error).toMatch(/none of them is named "Tracker"/);
  });
});
