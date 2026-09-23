import { readSheet } from "read-excel-file/node";
import { gridToObjects, gridToRows, isBlankRow } from "./spreadsheet";

const GOOGLE_SHEETS_ID = "1h37lmF2HIqhWVZq4MwTuT72SHYVNeNcQ";
const EXPORT_URL = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEETS_ID}/export?format=xlsx`;

let cachedBuffer = null;

/**
 * Download the published workbook and return its bytes. The optional argument
 * is accepted for callers that pass a source URL; EXPORT_URL stays the one
 * actually fetched, as before.
 */
export async function fetchWorkbook(_sourceUrl) {
  const res = await fetch(EXPORT_URL);
  cachedBuffer = Buffer.from(await res.arrayBuffer());
  return cachedBuffer;
}

/**
 * Read one named sheet as a grid of rows. Returns null when the workbook has
 * no sheet under that name, which callers treat as “no data” rather than an
 * error.
 */
async function readSheetGrid(sheetName) {
  const buffer = await fetchWorkbook();
  try {
    return await readSheet(buffer, sheetName, { trim: false });
  } catch (error) {
    if (error && error.name === "SheetNotFoundError") return null;
    throw error;
  }
}

/**
 * A sheet that exists but carries nothing after its first row is the signature
 * of a sheet that was renamed, emptied or restructured. That used to surface as
 * silent zeros on the finance screens; say so instead.
 */
function warnIfSheetLooksEmpty(sheetName, grid) {
  const dataRows = (grid || []).slice(1).filter((row) => !isBlankRow(row));
  if (dataRows.length > 0) return;
  console.warn(
    `[Finance] Sheet "${sheetName}" was found but holds no data rows — it may have been renamed, emptied or restructured.`,
  );
}

/**
 * The columns a caller reads. When not ONE of them carries a value in any row,
 * the sheet's layout has moved under us and every figure derived from it will
 * silently read as zero. Report that instead of letting it pass.
 */
function warnIfNothingReadable(sheetName, rows, columns) {
  if (!rows || rows.length === 0) return;
  const anyValue = columns.some((column) =>
    rows.some((row) => row[column] !== undefined && row[column] !== ""),
  );
  if (anyValue) return;
  console.warn(
    `[Finance] Sheet "${sheetName}": none of the columns this code reads carry a value (${columns.join(
      ", ",
    )}) — the sheet layout may have changed, and the figures below will read as zero.`,
  );
}

export async function getSheetData(sheetName) {
  const grid = await readSheetGrid(sheetName);
  if (!grid) return [];
  warnIfSheetLooksEmpty(sheetName, grid);
  return gridToRows(grid);
}

export async function getSheetJSON(sheetName) {
  const grid = await readSheetGrid(sheetName);
  if (!grid) return [];
  warnIfSheetLooksEmpty(sheetName, grid);
  return gridToObjects(grid);
}

export function excelDateToISO(serial) {
  if (!serial || typeof serial !== "number") return serial || "";
  const utcDays = Math.floor(serial - 25569);
  const date = new Date(utcDays * 86400 * 1000);
  return isNaN(date.getTime())
    ? String(serial)
    : date.toISOString().split("T")[0];
}

export const PROJECT_SHEETS = {
  "Future Studio": "Réalisations globales",
  "MTN Innovation Lab": "MTN Innovation Lab_2",
  "Sème City": "SEME CITY",
  "Master Overview": "Suivi budgétaire",
};

const BUDGET_SHEET_MAP = {
  "Future Studio": "Suivi budgétaire",
  "MTN Innovation Lab": "MTN Innovation Lab_2",
  "Sème City": "SEME CITY",
};

/**
 * Get the sheet name for a given project.
 * Returns the master overview sheet for "all" or unknown projects.
 */
function getSheetForProject(project, type = "budget") {
  if (!project || project === "all") {
    return type === "transactions"
      ? "Réalisations globales"
      : "Suivi budgétaire";
  }
  if (type === "transactions") {
    return PROJECT_SHEETS[project] || "Réalisations globales";
  }
  return BUDGET_SHEET_MAP[project] || "Suivi budgétaire";
}

export async function getTransactions(project) {
  const sheetName = getSheetForProject(project, "transactions");
  const rows = await getSheetJSON(sheetName);
  warnIfNothingReadable(sheetName, rows, [
    "TRIBU FUTURE STUDIO",
    "__EMPTY",
    "__EMPTY_1",
    "__EMPTY_2",
    "__EMPTY_3",
    "__EMPTY_4",
  ]);
  return rows
    .map((row) => ({
      date: excelDateToISO(row["TRIBU FUTURE STUDIO"] || row.__EMPTY),
      supplier: row.__EMPTY || "",
      description: row.__EMPTY_1 || "",
      category: row.__EMPTY_2 || "",
      amountSpent: parseFloat(row.__EMPTY_3) || 0,
      amountReceived: parseFloat(row.__EMPTY_4) || 0,
      code: row.__EMPTY_6 || "",
    }))
    .filter((transaction) => transaction.date || transaction.supplier || transaction.description);
}

export async function getSummary(project) {
  const sheetName = getSheetForProject(project, "budget");
  const rows = await getSheetJSON(sheetName);
  warnIfNothingReadable(sheetName, rows, ["__EMPTY_33", "__EMPTY_34"]);
  let totalPlanned = 0;
  let totalActual = 0;

  rows.forEach((row) => {
    const planned = parseFloat(row.__EMPTY_33);
    const actual = parseFloat(row.__EMPTY_34);
    if (!isNaN(planned)) totalPlanned += planned;
    if (!isNaN(actual)) totalActual += actual;
  });

  const remaining = totalPlanned - totalActual;
  const rate =
    totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0;

  return { totalPlanned, totalActual, remaining, rate };
}

