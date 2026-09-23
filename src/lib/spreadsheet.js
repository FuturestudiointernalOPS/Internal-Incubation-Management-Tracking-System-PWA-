/**
 * IMPACTOS SPREADSHEET HELPERS
 *
 * Pure helpers shared by every place that reads or writes `.xlsx` files. They
 * live here so the browser and the server can both use them: this module has no
 * imports, so bundling it into a client component is always safe. The actual
 * file decoding/encoding is done by the caller, which imports the reader or
 * writer entry point that matches its environment.
 *
 * The naming rules below deliberately reproduce the historical behaviour of the
 * spreadsheet library this project used before, so switching the underlying
 * library does not change a single value that the rest of the app sees:
 *
 *  - A header cell that is MISSING gets the generated name `__EMPTY`, then
 *    `__EMPTY_1`, `__EMPTY_2`, … in column order.
 *  - A header cell that is present but empty gets the name `` (empty string),
 *    then `_1`, `_2`, … — a separate family from `__EMPTY`.
 *  - Any repeated name gets a numeric suffix: `A`, `A_1`, `A_2`, … and the
 *    suffix is appended to the (possibly already suffixed) base name.
 *  - Names are used exactly as written: no trimming, no normalisation.
 *  - Empty cells read as `""` by default rather than being dropped.
 */

/** Excel's day-0 offset between its serial dates and the Unix epoch. */
export const EXCEL_EPOCH_OFFSET_DAYS = 25569;

/** One day in milliseconds. */
const MS_PER_DAY = 86400000;

/** Marker used for a header cell that does not exist at all. */
const MISSING_HEADER = "__EMPTY";

/**
 * Turn a JavaScript date back into the spreadsheet serial number the rest of
 * the app expects (`excelDateToISO` in the finance module works on serials).
 */
export function dateToExcelSerial(date) {
  return date.getTime() / MS_PER_DAY + EXCEL_EPOCH_OFFSET_DAYS;
}

/**
 * Normalise one cell the way the historical reader did: absent cells read as
 * `""`, and date-formatted cells come back as serial numbers rather than as
 * `Date` objects.
 */
export function normalizeCell(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return dateToExcelSerial(value);
  return value;
}

/**
 * A row counts as blank when no cell holds a value. Trailing missing cells do
 * not make a row blank on their own.
 */
export function isBlankRow(row) {
  if (!Array.isArray(row) || row.length === 0) return true;
  return row.every((cell) => cell === null || cell === undefined || cell === "");
}

/** Widest row in the grid — the equivalent of the sheet's used range width. */
export function gridWidth(grid) {
  let width = 0;
  for (const row of grid || []) {
    const rowLength = Array.isArray(row) ? row.length : 0;
    if (rowLength > width) width = rowLength;
  }
  return width;
}

/**
 * Build the column keys for a header row, reproducing the generated-name and
 * duplicate-suffix rules described at the top of this file.
 */
export function buildHeaderKeys(headerRow, width) {
  const header = Array.isArray(headerRow) ? headerRow : [];
  const keys = [];
  const used = new Set();

  for (let column = 0; column < width; column += 1) {
    const raw = column < header.length ? header[column] : null;
    const base = raw === null || raw === undefined ? MISSING_HEADER : String(raw);

    let key = base;
    let suffix = 1;
    while (used.has(key)) {
      key = `${base}_${suffix}`;
      suffix += 1;
    }
    used.add(key);
    keys.push(key);
  }

  return keys;
}

/**
 * Read a grid (array of rows of cells) as an array of row objects keyed by the
 * first row. Fully blank rows are dropped, which is what the historical reader
 * did in this mode.
 */
export function gridToObjects(grid) {
  if (!Array.isArray(grid) || grid.length === 0) return [];

  const width = gridWidth(grid);
  const keys = buildHeaderKeys(grid[0], width);
  const objects = [];

  for (let index = 1; index < grid.length; index += 1) {
    const row = Array.isArray(grid[index]) ? grid[index] : [];
    if (isBlankRow(row)) continue;

    const object = {};
    for (let column = 0; column < width; column += 1) {
      object[keys[column]] = normalizeCell(column < row.length ? row[column] : null);
    }
    objects.push(object);
  }

  return objects;
}

/**
 * Read a grid as an array of rows of cells, with absent cells filled in.
 * Blank rows are KEPT here — the historical reader kept them in array mode, and
 * the finance module depends on row positions staying put.
 */
export function gridToRows(grid) {
  if (!Array.isArray(grid) || grid.length === 0) return [];

  const width = gridWidth(grid);
  return grid.map((row) => {
    const source = Array.isArray(row) ? row : [];
    const cells = [];
    for (let column = 0; column < width; column += 1) {
      cells.push(normalizeCell(column < source.length ? source[column] : null));
    }
    return cells;
  });
}

/**
 * Turn a list of row objects into a header row plus value rows, in first-seen
 * key order — the equivalent of the historical writer's object handling.
 */
export function objectsToAoa(objects) {
  const keys = [];
  const seen = new Set();

  for (const object of objects || []) {
    if (!object) continue;
    for (const key of Object.keys(object)) {
      if (!seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }
    }
  }

  const aoa = [keys];
  for (const object of objects || []) {
    aoa.push(
      keys.map((key) => {
        const value = object ? object[key] : undefined;
        return value === undefined ? null : normalizeCell(value);
      }),
    );
  }
  return aoa;
}
