/**
 * RUN REPORT FILE — the document a Run attaches to its report instructions.
 *
 * One document per Run. The row keeps the three things the rest of the platform
 * needs:
 *   • where the object lives (a private storage path — never returned to a
 *     browser, which receives a short-lived signed link instead);
 *   • what the report writer was actually given (the extracted text);
 *   • whether that text could be read at all (`extraction_status`) — a scanned
 *     PDF is a perfectly valid attachment that the report writer simply cannot
 *     use, and the screen must be able to say so instead of silently writing a
 *     report that ignored the document.
 *
 * Schema ships in `supabase/migrations/20260921_platform_run_report_files.sql`;
 * the same statements are issued here so a Run configured before that file is
 * applied keeps working. Every statement is a no-op when repeated, which the db
 * engine answers once per process (see `src/lib/db.js`) — so calling the guard
 * on each read costs a local lookup, not a round trip.
 */
import db, { initDb } from "@/lib/db";

/** How the document's text was obtained. */
export const RUN_REPORT_FILE_STATUSES = {
  /** Readable text was extracted. */
  OK: "ok",
  /** The document was read but contains no text the writer can use (a scan). */
  EMPTY: "empty",
  /** Extraction failed — the file is kept and openable, but not writable from. */
  FAILED: "failed",
};

/** The columns a descriptor needs. Never selects the text itself. */
const DESCRIPTOR_COLUMNS = `
  id, run_id, file_name, mime_type, file_size, storage_path,
  extraction_status, extraction_error, uploaded_by, uploaded_at,
  COALESCE(LENGTH(extracted_text), 0) AS text_length
`;

/** Create the table/index/column this module reads, if they are not there yet. */
async function ensureRunReportFilesSchema() {
  await initDb();
  await db.execute({
    sql: `CREATE TABLE IF NOT EXISTS platform_run_report_files (
            id SERIAL PRIMARY KEY,
            run_id INTEGER NOT NULL REFERENCES platform_form_runs(id) ON DELETE CASCADE,
            file_name TEXT NOT NULL,
            mime_type TEXT,
            file_size INTEGER,
            storage_path TEXT NOT NULL,
            extracted_text TEXT,
            extraction_status TEXT NOT NULL DEFAULT 'failed',
            extraction_error TEXT,
            uploaded_by TEXT,
            uploaded_at TIMESTAMP DEFAULT NOW()
          )`,
    args: [],
  });
  await db.execute({
    sql: "CREATE UNIQUE INDEX IF NOT EXISTS idx_run_report_files_run ON platform_run_report_files (run_id)",
    args: [],
  });
}

/**
 * The Run's document, without its text. Returns null when the Run has none.
 *
 * `text_length` rides along so a caller can tell "readable, N characters" from
 * "attached but empty" without loading the text.
 */
export async function getRunReportFileByRunId(runId) {
  await ensureRunReportFilesSchema();
  const result = await db.execute({
    sql: `SELECT ${DESCRIPTOR_COLUMNS} FROM platform_run_report_files WHERE run_id = ?`,
    args: [parseInt(runId)],
  });
  return result.rows[0] || null;
}

/**
 * The text the report writer must read, with the name it came from.
 *
 * A separate query from the descriptor because this is the only read that has to
 * move the document's content: the screen asks for it on demand, the writer asks
 * for it once per report.
 */
export async function getRunReportFileTextByRunId(runId) {
  await ensureRunReportFilesSchema();
  const result = await db.execute({
    sql: "SELECT file_name, extracted_text, extraction_status FROM platform_run_report_files WHERE run_id = ?",
    args: [parseInt(runId)],
  });
  const row = result.rows[0];
  if (!row) return null;
  return {
    fileName: row.file_name || "",
    status: row.extraction_status || RUN_REPORT_FILE_STATUSES.FAILED,
    text: typeof row.extracted_text === "string" ? row.extracted_text : "",
  };
}

/**
 * Store (or replace) the Run's document and return its descriptor.
 *
 * `ON CONFLICT (run_id)` is the whole "replace, never accumulate" rule: the
 * previous object path is returned by the caller's own read before this runs, so
 * it can be deleted from storage afterwards. Returns null when the Run vanished
 * mid-flight (the foreign key would otherwise throw instead).
 */
export async function upsertRunReportFile({
  runId,
  fileName,
  mimeType,
  fileSize,
  storagePath,
  extractedText,
  extractionStatus,
  extractionError,
  uploadedBy,
}) {
  await ensureRunReportFilesSchema();
  const result = await db.execute({
    sql: `INSERT INTO platform_run_report_files
            (run_id, file_name, mime_type, file_size, storage_path, extracted_text,
             extraction_status, extraction_error, uploaded_by, uploaded_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
          ON CONFLICT (run_id) DO UPDATE SET
            file_name = EXCLUDED.file_name,
            mime_type = EXCLUDED.mime_type,
            file_size = EXCLUDED.file_size,
            storage_path = EXCLUDED.storage_path,
            extracted_text = EXCLUDED.extracted_text,
            extraction_status = EXCLUDED.extraction_status,
            extraction_error = EXCLUDED.extraction_error,
            uploaded_by = EXCLUDED.uploaded_by,
            uploaded_at = NOW()
          RETURNING ${DESCRIPTOR_COLUMNS}`,
    args: [
      parseInt(runId),
      String(fileName || "document"),
      mimeType || null,
      Number.isFinite(Number(fileSize)) ? Number(fileSize) : null,
      String(storagePath),
      extractedText ?? null,
      extractionStatus || RUN_REPORT_FILE_STATUSES.FAILED,
      extractionError || null,
      uploadedBy || null,
    ],
  });
  return result.rows[0] || null;
}

/**
 * Drop the Run's document row and hand back the object path that goes with it.
 * Returns null when there was nothing to remove — so "remove" is idempotent and
 * the caller cannot delete an object belonging to another Run by mistake.
 */
export async function deleteRunReportFileByRunId(runId) {
  await ensureRunReportFilesSchema();
  const result = await db.execute({
    sql: "DELETE FROM platform_run_report_files WHERE run_id = ? RETURNING storage_path",
    args: [parseInt(runId)],
  });
  return result.rows[0]?.storage_path || null;
}

/**
 * Shape one row for a browser: what the document is, how readable it turned out,
 * and (when the caller signed it) a link that expires.
 *
 * Defined once, next to the columns it describes, so the Run screen and the file
 * screen can never drift into describing the same document differently. The
 * storage path deliberately never appears here.
 */
export function runReportFileDescriptor(row, url = null) {
  if (!row) return null;
  return {
    id: row.id,
    file_name: row.file_name,
    mime_type: row.mime_type || null,
    file_size: row.file_size == null ? null : Number(row.file_size),
    extraction_status: row.extraction_status,
    uploaded_by: row.uploaded_by || null,
    uploaded_at: row.uploaded_at || null,
    text_length: Number(row.text_length) || 0,
    url,
  };
}

export default {
  RUN_REPORT_FILE_STATUSES,
  getRunReportFileByRunId,
  getRunReportFileTextByRunId,
  upsertRunReportFile,
  deleteRunReportFileByRunId,
  runReportFileDescriptor,
};
