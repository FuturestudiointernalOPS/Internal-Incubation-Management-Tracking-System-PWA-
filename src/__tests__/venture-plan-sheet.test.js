/**
 * Plan sheet reading — CSV and XLSX into rows, with honest outcomes.
 */
const writeXlsxFile = require("write-excel-file/node");
const {
  readPlanSheet,
  planSheetKind,
  parsePlanCsv,
  detectDelimiter,
  PLAN_SHEET_OK,
  PLAN_SHEET_EMPTY,
  PLAN_SHEET_FAILED,
  MAX_PLAN_ROWS,
} = require("@/lib/venturePlanSheet");

const csvBuffer = (text) => Buffer.from(text, "utf8");

describe("planSheetKind", () => {
  test("names beat types; unknown stays unknown", () => {
    expect(planSheetKind({ name: "tracker.xlsx" })).toBe("xlsx");
    expect(planSheetKind({ name: "tracker.CSV" })).toBe("csv");
    expect(
      planSheetKind({ name: "x", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    ).toBe("xlsx");
    expect(planSheetKind({ name: "notes.pdf", mime: "application/pdf" })).toBe(null);
  });
});

describe("CSV reading", () => {
  test("delimiter is detected from the header line", () => {
    expect(detectDelimiter("a;b;c\n1;2;3")).toBe(";");
    expect(detectDelimiter("a\tb\n1\t2")).toBe("\t");
  });

  test("quotes, escapes and CRLF survive", () => {
    const rows = parsePlanCsv('ID,Activity\r\nMS01,"Quoted, with comma"\r\nMS01,"say ""hi"" now"', ",");
    expect(rows).toEqual([
      ["ID", "Activity"],
      ["MS01", "Quoted, with comma"],
      ["MS01", 'say "hi" now'],
    ]);
  });

  test("a CSV upload reads end to end; blank rows are spacing, not data", () => {
    const out = readPlanSheet({ name: "t.csv", buffer: csvBuffer("A,B\n\n1,2\n,,\n") });
    expect(out.status).toBe(PLAN_SHEET_OK);
    expect(out.sheets[0].rows).toEqual([
      ["A", "B"],
      ["1", "2"],
    ]);
  });

  test("a header-only CSV is ok; an all-blank CSV is empty", () => {
    expect(readPlanSheet({ name: "t.csv", buffer: csvBuffer("A,B\n") }).status).toBe(PLAN_SHEET_OK);
    expect(readPlanSheet({ name: "t.csv", buffer: csvBuffer("\n,\n\n") }).status).toBe(PLAN_SHEET_EMPTY);
  });

  test("an unsupported type fails with a readable reason", () => {
    const out = readPlanSheet({ name: "notes.pdf", buffer: csvBuffer("x") });
    expect(out.status).toBe(PLAN_SHEET_FAILED);
    expect(out.error).toMatch(/xlsx or \.csv/i);
  });

  test("the row cap is reported, not silently applied", () => {
    const lines = ["H"];
    for (let index = 0; index <= MAX_PLAN_ROWS; index += 1) lines.push(`r${index}`);
    const out = readPlanSheet({ name: "t.csv", buffer: csvBuffer(lines.join("\n")) });
    expect(out.status).toBe(PLAN_SHEET_OK);
    expect(out.truncated).toBe(true);
    expect(out.sheets[0].rows.length).toBe(MAX_PLAN_ROWS);
  });
});

describe("XLSX reading", () => {
  test("a workbook written by the platform's own writer reads back", async () => {
    // v4 returns a handle: `.toBuffer()` is how the writer hands back bytes.
    const buffer = await writeXlsxFile(
      [
        ["ID", "Pillar", "Activity / Task", "Owner", "Due"],
        ["MS01", "Product & Customer Readiness", "Interview 10 active customers", "Amina", "2026-10-14"],
        ["MS02", "Go-to-Market System", "Define ideal customer profile", "Fatou", "2026-10-15"],
      ],
      { sheet: "Tracker" },
    ).toBuffer();
    const out = readPlanSheet({ name: "tracker.xlsx", buffer: Buffer.from(buffer) });
    expect(out.status).toBe(PLAN_SHEET_OK);
    expect(out.sheets[0].name).toBe("Tracker");
    const rows = out.sheets[0].rows;
    expect(rows[0]).toEqual(["ID", "Pillar", "Activity / Task", "Owner", "Due"]);
    expect(rows[1]).toEqual([
      "MS01",
      "Product & Customer Readiness",
      "Interview 10 active customers",
      "Amina",
      "2026-10-14",
    ]);
    expect(rows[2][1]).toBe("Go-to-Market System");
  });

  test("bytes that are not a workbook fail honestly", () => {
    const out = readPlanSheet({ name: "broken.xlsx", buffer: Buffer.from("not a zip") });
    expect(out.status).toBe(PLAN_SHEET_FAILED);
    expect(out.error).toMatch(/could not be read/i);
  });
});
