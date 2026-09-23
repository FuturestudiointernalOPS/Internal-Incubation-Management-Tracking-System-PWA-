/**
 * RFC 4180-aware CSV helpers shared by the import flow (client + server).
 *
 * The previous parsers split the raw text on physical newlines BEFORE
 * handling quotes, so any cell containing an embedded newline (multi-line
 * text answers) was exploded into phantom rows — a 548-row document could
 * be counted as thousands of rows. These functions parse character by
 * character, so quoted newlines, escaped quotes and commas stay inside
 * their cells.
 */

/**
 * Parse CSV text into an array of rows; each row is an array of raw cell
 * strings (untrimmed). Handles:
 *  - quoted fields containing commas
 *  - escaped quotes ("")
 *  - embedded newlines inside quoted fields (multi-line cells)
 *  - CRLF and LF line endings
 *  - a trailing empty row produced by a final newline is dropped
 */
export function parseCSVRows(text) {
  const rows = [];
  if (typeof text !== "string") return rows;
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch; // includes \n and \r — part of the cell
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++; // CRLF as one break
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const last = rows[rows.length - 1];
  if (last && last.length === 1 && last[0] === "") rows.pop();
  return rows;
}

/**
 * Convert rows (arrays of cells) back into a minimal valid CSV string.
 * Cells containing commas, quotes or newlines are quoted.
 */
export function rowsToCsv(rows) {
  // A cell beginning with = + @ (or a control char) is interpreted as a FORMULA
  // by spreadsheet software — a CSV export is then an injection vector. Such a
  // cell is prefixed with an apostrophe so it is read as text. A plain negative
  // number (-12, -3.5, -1e-3) is left alone.
  const RISKY_START = /^[=+@\t\r]/;
  const CLEAN_NUMBER = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/;

  return (rows || [])
    .map((cells) =>
      (cells || [])
        .map((cell) => {
          let cellText = cell == null ? "" : String(cell);
          if (RISKY_START.test(cellText) || (cellText.startsWith("-") && !CLEAN_NUMBER.test(cellText))) {
            cellText = "'" + cellText;
          }
          if (/[",\r\n]/.test(cellText)) return '"' + cellText.replace(/"/g, '""') + '"';
          return cellText;
        })
        .join(",")
    )
    .join("\r\n");
}
