/**
 * PLAN SHEET RULES — the parts of the tracker reader a browser also needs.
 *
 * Which formats we accept and how big a table one upload may carry are RULES,
 * not reading. They live apart from the reader so the upload form can apply the
 * same rule the server will apply, without shipping an XLSX unzipper to the
 * browser. One definition, two callers — the alternative (a copy in the form)
 * drifts, and then the form promises what the route refuses.
 */

export const PLAN_SHEET_OK = "ok";
export const PLAN_SHEET_EMPTY = "empty";
export const PLAN_SHEET_FAILED = "failed";

export const MAX_PLAN_SHEETS = 10;
export const MAX_PLAN_ROWS = 500;
export const MAX_PLAN_CELLS = 40;
export const MAX_PLAN_CELL_CHARS = 2000;

/** The largest upload one tracker may be. */
export const MAX_PLAN_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Which reader a file needs, from its name first and its type second (a
 * browser often sends an empty or generic type, while the extension is
 * reliable). Returns null for a format this module cannot read. */
export function planSheetKind({ name, mime } = {}) {
  const fileName = String(name || "").toLowerCase();
  const mimeType = String(mime || "").toLowerCase();
  if (/\.xlsx$/.test(fileName) || mimeType.includes("spreadsheetml")) return "xlsx";
  if (/\.csv$/.test(fileName) || mimeType.includes("csv") || mimeType === "text/csv") return "csv";
  if (/\.(txt|tsv)$/.test(fileName) || mimeType.startsWith("text/")) return "csv";
  return null;
}

export default { planSheetKind, MAX_PLAN_UPLOAD_BYTES };
