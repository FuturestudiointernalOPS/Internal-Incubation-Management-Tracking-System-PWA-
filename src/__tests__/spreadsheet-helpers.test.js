/**
 * Spreadsheet helpers — the bug this guards:
 * the app reads the finance Google Sheets by COLUMN NAME, and the names of
 * columns whose header cell is missing are generated (`__EMPTY`, `__EMPTY_1`,
 * …). If that naming drifts, `getTransactions` / `getSummary` silently return
 * zeros instead of failing loudly. These tests pin the exact rules, and the
 * expected values were captured from the previous spreadsheet library before it
 * was replaced.
 *
 * A cell that is ABSENT (null/undefined, how a real file encodes emptiness)
 * yields `__EMPTY`, then `__EMPTY_1`, `__EMPTY_2`, … in column order.
 * A cell that is PRESENT but empty ("" ) belongs to a separate family: ``, `_1`.
 * Any repeated name gets a numeric suffix, appended to the already-suffixed base.
 */
const {
  dateToExcelSerial,
  normalizeCell,
  isBlankRow,
  buildHeaderKeys,
  gridToObjects,
  gridToRows,
  objectsToAoa,
} = require("@/lib/spreadsheet");

describe("buildHeaderKeys", () => {
  test("missing header cells are numbered in column order", () => {
    expect(buildHeaderKeys(["A", null, null, null], 4)).toEqual([
      "A",
      "__EMPTY",
      "__EMPTY_1",
      "__EMPTY_2",
    ]);
  });

  test("repeated names get an incrementing numeric suffix", () => {
    expect(buildHeaderKeys(["A", "A", "A"], 3)).toEqual(["A", "A_1", "A_2"]);
  });

  test("the suffix is appended to the base, even if it already ends in _1", () => {
    expect(buildHeaderKeys(["A", "A", "A_1"], 3)).toEqual(["A", "A_1", "A_1_1"]);
  });

  test("names are used verbatim — no trimming", () => {
    expect(buildHeaderKeys([" A ", "B "], 2)).toEqual([" A ", "B "]);
  });

  test("non-string header values are stringified", () => {
    expect(buildHeaderKeys([2026, true], 2)).toEqual(["2026", "true"]);
  });

  test("columns past the end of the header row are treated as missing", () => {
    expect(buildHeaderKeys(["A"], 3)).toEqual(["A", "__EMPTY", "__EMPTY_1"]);
  });
});

describe("gridToRows", () => {
  test("pads short rows so every row has the same width", () => {
    expect(gridToRows([["A", "B", "C"], ["a1"], ["a2", "b2", "c2"]])).toEqual([
      ["A", "B", "C"],
      ["a1", "", ""],
      ["a2", "b2", "c2"],
    ]);
  });

  test("keeps blank rows in place — the finance reader slices by position", () => {
    expect(gridToRows([["A"], ["a"], [null], ["b"]])).toEqual([
      ["A"],
      ["a"],
      [""],
      ["b"],
    ]);
  });

  test("converts absent cells to empty strings", () => {
    expect(gridToRows([["A", null], [1, undefined]])).toEqual([
      ["A", ""],
      [1, ""],
    ]);
  });

  test("an empty grid yields no rows", () => {
    expect(gridToRows([])).toEqual([]);
  });
});

describe("gridToObjects", () => {
  test("drops fully blank rows", () => {
    expect(gridToObjects([["A", "B"], ["1", "2"], [null, null], ["3", "4"]])).toEqual([
      { A: "1", B: "2" },
      { A: "3", B: "4" },
    ]);
  });

  test("fills padding cells with empty strings", () => {
    expect(gridToObjects([["A", "B", "C"], ["a1"], ["a2", "b2", "c2"]])).toEqual([
      { A: "a1", B: "", C: "" },
      { A: "a2", B: "b2", C: "c2" },
    ]);
  });

  test("keeps numbers, booleans and text as-is", () => {
    expect(gridToObjects([["n", "b", "t"], [42, true, "x"]])).toEqual([
      { n: 42, b: true, t: "x" },
    ]);
  });

  test("a header row with no data yields no objects", () => {
    expect(gridToObjects([["A", "B"]])).toEqual([]);
    expect(gridToObjects([])).toEqual([]);
  });

  test("reproduces the generated names the finance reader depends on", () => {
    // This is the shape of the "Réalisations globales" sheet: one real header,
    // a run of missing header cells, then another real header.
    const grid = [
      ["TRIBU FUTURE STUDIO", null, null, null, "code"],
      ["2026-01-15", "supplier", "description", "category", "ABC"],
    ];

    expect(gridToObjects(grid)).toEqual([
      {
        "TRIBU FUTURE STUDIO": "2026-01-15",
        __EMPTY: "supplier",
        __EMPTY_1: "description",
        __EMPTY_2: "category",
        code: "ABC",
      },
    ]);
  });
});

describe("isBlankRow", () => {
  test("only a row with no value at all is blank", () => {
    expect(isBlankRow([])).toBe(true);
    expect(isBlankRow([null, null])).toBe(true);
    expect(isBlankRow(["", ""])).toBe(true);
    expect(isBlankRow([" ", ""])).toBe(false);
    expect(isBlankRow([0, ""])).toBe(false);
  });
});

describe("normalizeCell", () => {
  test("absent values become empty strings", () => {
    expect(normalizeCell(null)).toBe("");
    expect(normalizeCell(undefined)).toBe("");
  });

  test("other values are left untouched", () => {
    expect(normalizeCell("")).toBe("");
    expect(normalizeCell("x")).toBe("x");
    expect(normalizeCell(42)).toBe(42);
    expect(normalizeCell(true)).toBe(true);
  });

  test("dates become spreadsheet serial numbers", () => {
    // 2023-07-16 is serial 45123 in the 1900 date system.
    expect(dateToExcelSerial(new Date(Date.UTC(2023, 6, 16)))).toBe(45123);
    expect(normalizeCell(new Date(Date.UTC(2023, 6, 16)))).toBe(45123);
  });
});

describe("objectsToAoa", () => {
  test("headers follow first-seen key order across all rows", () => {
    expect(objectsToAoa([{ b: 1, a: 2 }, { c: 3, a: 4 }])).toEqual([
      ["b", "a", "c"],
      [1, 2, null],
      [null, 4, 3],
    ]);
  });

  test("an empty list yields just an empty header row", () => {
    expect(objectsToAoa([])).toEqual([[]]);
  });
});
