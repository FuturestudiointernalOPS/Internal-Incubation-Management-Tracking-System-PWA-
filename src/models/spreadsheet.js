import { readSheet } from "read-excel-file/node";
import Papa from "papaparse";

/**
 * src/models/spreadsheet.js — external read-only spreadsheet collector
 * powering the Fundraising card on /admin/intelligence.
 *
 * The supervisor maintains fundraising data in a Microsoft Excel file shared
 * with a view-only link. The link is configured server-side via the
 * FUNDRAISING_SPREADSHEET_URL env var (a constant fallback can be filled in
 * below). The site never writes to the file — it only fetches and parses it.
 *
 * Refresh model: the file is pulled on every metric call with a short-lived
 * in-memory cache (15s by default, override with FUNDRAISING_SPREADSHEET_TTL_MS),
 * so editing the spreadsheet is reflected on the page within that window.
 *
 * Parsing is column-agnostic: it returns every non-empty row as-is, serialized
 * to strings, so any column layout is rendered adaptively.
 */

const DEFAULT_SPREADSHEET_URL = "";
const SPREADSHEET_URL = process.env.FUNDRAISING_SPREADSHEET_URL || DEFAULT_SPREADSHEET_URL;
const FETCH_TIMEOUT_MS = parseInt(process.env.FUNDRAISING_SPREADSHEET_TIMEOUT_MS || "15000", 10);
const CACHE_TTL_MS = parseInt(process.env.FUNDRAISING_SPREADSHEET_TTL_MS || "15000", 10);

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

let cache = null; // { fetchedAt, payload }

function toDisplay(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    const mm = String(value.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(value.getUTCDate()).padStart(2, "0");
    return `${value.getUTCFullYear()}-${mm}-${dd}`;
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

async function fetchBytes(url) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "User-Agent": BROWSER_UA, Accept: "*/*" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.arrayBuffer();
}

function isXlsxBuffer(buffer) {
  const head = new Uint8Array(buffer);
  return head.length > 2 && head[0] === 0x50 && head[1] === 0x4b; // "PK" zip magic
}

async function loadRows(url) {
  const buffer = await fetchBytes(url);
  if (isXlsxBuffer(buffer)) {
    const rows = await readSheet(Buffer.from(buffer));
    return { rows, source: "xlsx" };
  }
  const text = new TextDecoder().decode(buffer);
  const parsed = Papa.parse(text, { skipEmptyLines: true });
  return { rows: parsed.data, source: "csv" };
}

/**
 * Fetch and parse the configured spreadsheet.
 * Returns an adaptive payload: ok / configured / rows (string[][]), first row
 * used as columns, last sync timestamp and a plain error message when reachable.
 */
export async function getSpreadsheetData(url = SPREADSHEET_URL) {
  const configured = Boolean(url);
  if (!configured) {
    return {
      ok: false,
      configured: false,
      rows: [],
      columns: [],
      source: null,
      updated_at: null,
      error: "FUNDRAISING_SPREADSHEET_URL not configured.",
    };
  }

  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.payload;

  let payload;
  try {
    const { rows, source } = await loadRows(url);
    const clean = rows
      .map((row) => row.map(toDisplay))
      .filter((row) => row.some((cell) => String(cell).trim() !== ""));
    if (clean.length === 0) {
      payload = {
        ok: true,
        configured,
        rows: [],
        columns: [],
        source,
        updated_at: new Date().toISOString(),
        error: null,
      };
    } else {
      payload = {
        ok: true,
        configured,
        rows: clean,
        columns: clean[0],
        source,
        updated_at: new Date().toISOString(),
        error: null,
      };
    }
  } catch (err) {
    payload = {
      ok: false,
      configured,
      rows: [],
      columns: [],
      source: null,
      updated_at: null,
      error: err && err.message ? err.message : String(err),
    };
  }

  if (payload.ok) cache = { fetchedAt: Date.now(), payload };
  return payload;
}