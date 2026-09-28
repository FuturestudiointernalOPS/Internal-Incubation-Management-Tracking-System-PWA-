/**
 * PLAN SHEET — reading an uploaded tracker into structured rows.
 *
 * The AI mapping needs ROWS, not prose: a tracker imported into the platform
 * is a table whose columns carry the meaning (Activity, Owner, Due, Depends
 * On …). So this module returns sheets of cells, in order, with only the
 * noise removed (trailing empties), and it reports honestly:
 *
 *   ok     — readable rows are attached;
 *   empty  — the document was read and genuinely has no row with any text
 *            (an empty workbook is not an error; it is empty);
 *   failed — the bytes could not be read (corrupt archive, unknown format).
 *
 * Caps exist so one upload cannot decide how big a table the platform must
 * hold; when a bound is reached the reading SAYS SO (truncated: true) instead
 * of silently losing rows. Dates a spreadsheet stores as serial NUMBERS are
 * returned as numbers — the interpreter flags unreadable dates rather than
 * pretending they are dates.
 */
import { unzipSync } from "fflate";
import {
  PLAN_SHEET_OK,
  PLAN_SHEET_EMPTY,
  PLAN_SHEET_FAILED,
  MAX_PLAN_SHEETS,
  MAX_PLAN_ROWS,
  MAX_PLAN_CELLS,
  MAX_PLAN_CELL_CHARS,
  planSheetKind,
} from "@/lib/venturePlanSheetRules";

// The format/size RULES live in venturePlanSheetRules (the upload form applies
// the same ones); re-exported here so this module stays the reader's one import.
export {
  PLAN_SHEET_OK,
  PLAN_SHEET_EMPTY,
  PLAN_SHEET_FAILED,
  MAX_PLAN_SHEETS,
  MAX_PLAN_ROWS,
  MAX_PLAN_CELLS,
  MAX_PLAN_CELL_CHARS,
  planSheetKind,
};

/** Decode the XML entities a spreadsheet uses, without tripping over a stray code point. */
function decodeXmlEntities(value) {
  const fromCode = (code) => {
    try {
      return String.fromCodePoint(code);
    } catch (_) {
      return "";
    }
  };
  return String(value)
    .replace(/&#x([0-9a-f]+);/gi, (_, hexDigits) => fromCode(parseInt(hexDigits, 16)))
    .replace(/&#(\d+);/g, (_, decimalDigits) => fromCode(parseInt(decimalDigits, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

const stripTags = (xml) => decodeXmlEntities(String(xml || "").replace(/<[^>]+>/g, ""));
/** One cell, cleaned and capped — whitespace collapsed so prompt lines are readable. */
const collapse = (value) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_PLAN_CELL_CHARS);

const columnIndex = (letters) => {
  let index = 0;
  for (const character of String(letters)) {
    index = index * 26 + (character.charCodeAt(0) - 64);
  }
  return index - 1;
};

/** Pick the delimiter the header line actually uses. */
export function detectDelimiter(text) {
  const firstLine = String(text || "").split(/\r?\n/, 1)[0] || "";
  const candidates = [",", ";", "\t"].map((delimiter) => ({
    delimiter,
    count: firstLine.split(delimiter).length - 1,
  }));
  candidates.sort((left, right) => right.count - left.count);
  return candidates[0].count > 0 ? candidates[0].delimiter : ",";
}

/**
 * Parse CSV/TSV text into rows of cells. Handles quoted cells with "" escapes
 * and CR/LF line endings; blank rows are dropped (they are spacing, not data).
 */
export function parsePlanCsv(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  const pushCell = () => {
    if (row.length < MAX_PLAN_CELLS) row.push(collapse(cell));
    cell = "";
  };
  const pushRow = () => {
    pushCell();
    if (row.some((value) => value !== "")) rows.push(row);
    row = [];
  };

  const source = String(text || "");
  for (let index = 0; index < source.length && rows.length < MAX_PLAN_ROWS; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === delimiter) {
      pushCell();
    } else if (character === "\n") {
      pushRow();
    } else if (character === "\r") {
      if (source[index + 1] === "\n") index += 1;
      pushRow();
    } else {
      cell += character;
    }
  }
  if (cell !== "" || row.length > 0) pushRow();
  return rows;
}

/** Read an .xlsx archive (shared strings + worksheet XML) into rows per sheet. */
export function readPlanXlsx(buffer) {
  const archive = unzipSync(new Uint8Array(buffer));
  const textOf = (name) => (archive[name] ? Buffer.from(archive[name]).toString("utf8") : "");

  const sharedStrings = [];
  const sharedXml = textOf("xl/sharedStrings.xml");
  const siPattern = /<si>([\s\S]*?)<\/si>/g;
  let siMatch;
  while ((siMatch = siPattern.exec(sharedXml))) sharedStrings.push(stripTags(siMatch[1]));

  const sheetNames = [...textOf("xl/workbook.xml").matchAll(/<sheet[^>]*name="([^"]*)"/g)].map((match) =>
    decodeXmlEntities(match[1]),
  );

  const sheetFiles = Object.keys(archive)
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort((left, right) => Number(/(\d+)/.exec(left)[1]) - Number(/(\d+)/.exec(right)[1]));

  const sheets = [];
  let truncated = false;

  for (const [index, sheetFile] of sheetFiles.entries()) {
    if (sheets.length >= MAX_PLAN_SHEETS) {
      truncated = true;
      break;
    }
    const xml = textOf(sheetFile);
    const rows = [];
    const rowPattern = /<row\b([^>]*)>([\s\S]*?)<\/row>/g;
    let rowMatch;

    while ((rowMatch = rowPattern.exec(xml))) {
      if (rows.length >= MAX_PLAN_ROWS) {
        truncated = true;
        break;
      }
      const content = rowMatch[2] || "";
      const cells = [];
      let nextColumn = 0;
      const cellPattern = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
      let cellMatch;

      while ((cellMatch = cellPattern.exec(content))) {
        const attributes = cellMatch[1] || "";
        const inner = cellMatch[2] || "";
        const reference = /r="([A-Z]+)\d+"/.exec(attributes);
        const column = reference ? columnIndex(reference[1]) : nextColumn;
        nextColumn = column + 1;
        if (column >= MAX_PLAN_CELLS) continue;

        const type = /t="([^"]*)"/.exec(attributes)?.[1];
        let value = "";
        if (type === "s") {
          const pointer = /<v>(\d+)<\/v>/.exec(inner);
          value = pointer ? sharedStrings[Number(pointer[1])] ?? "" : "";
        } else if (type === "inlineStr") {
          value = stripTags(/<is>([\s\S]*?)<\/is>/.exec(inner)?.[1] || "");
        } else {
          value = decodeXmlEntities(/<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] || "");
        }
        cells[column] = collapse(value);
      }

      const row = [];
      for (let column = 0; column < Math.min(cells.length, MAX_PLAN_CELLS); column += 1) {
        row.push(cells[column] ?? "");
      }
      if (row.some((value) => value !== "")) rows.push(row);
    }

    sheets.push({ name: sheetNames[index] || `Sheet ${index + 1}`, rows });
  }

  return { sheets, truncated };
}

/**
 * Read an uploaded tracker into `{ status, kind, sheets, truncated, error }`.
 * `buffer` is the file's bytes.
 */
export function readPlanSheet({ name, mime, buffer } = {}) {
  const kind = planSheetKind({ name, mime });
  if (!kind) {
    return {
      status: PLAN_SHEET_FAILED,
      kind: null,
      sheets: [],
      truncated: false,
      error: "Unsupported file type — upload an .xlsx or .csv tracker.",
    };
  }
  try {
    let sheets = [];
    let truncated = false;

    if (kind === "csv") {
      const text = Buffer.from(buffer).toString("utf8");
      let rows = parsePlanCsv(text, detectDelimiter(text));
      if (rows.length >= MAX_PLAN_ROWS) {
        rows = rows.slice(0, MAX_PLAN_ROWS);
        truncated = true;
      }
      sheets = [{ name: String(name || "Sheet"), rows }];
    } else {
      const result = readPlanXlsx(buffer);
      sheets = result.sheets;
      truncated = result.truncated;
    }

    const hasAnyText = sheets.some((sheet) =>
      sheet.rows.some((row) => row.some((cell) => String(cell).trim() !== "")),
    );
    if (!hasAnyText) {
      return { status: PLAN_SHEET_EMPTY, kind, sheets, truncated, error: null };
    }
    return { status: PLAN_SHEET_OK, kind, sheets, truncated, error: null };
  } catch (error) {
    return {
      status: PLAN_SHEET_FAILED,
      kind,
      sheets: [],
      truncated: false,
      error: `The file could not be read (${error.message || "unknown error"}).`,
    };
  }
}

export default { readPlanSheet, planSheetKind, parsePlanCsv, detectDelimiter, readPlanXlsx };
