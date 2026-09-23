/**
 * RUN REPORT FILE — validation, private storage and signed reads.
 *
 * The document a Run attaches to its report instructions lives in a PRIVATE
 * bucket. The database keeps the storage path; a browser only ever receives a
 * short-lived signed link, minted on demand for someone who already passed the
 * runs gate — the platform never hands out a permanent address for an internal
 * document.
 *
 * Two rules are enforced HERE, before anything reaches storage, so a rejected
 * document never becomes an orphan object:
 *   • accepted types — the formats the report writer can actually read (PDF with
 *     a text layer, Word .docx, plain text). Legacy .doc is refused on purpose:
 *     it is a proprietary binary the writer cannot read, and accepting it would
 *     silently produce a report that ignored the document.
 *   • a size ceiling, the app-wide 5 MB upload limit.
 *
 * Errors come back as i18n KEYS (never English prose), so the screen can show
 * them in the reader's own language exactly like every other runs message.
 */
import { createClient } from "@supabase/supabase-js";
import { safeStorageName, safeStoragePath } from "@/lib/storageNames";

export const RUN_REPORT_FILE_BUCKET = "run-report-files";

/**
 * How long a signed link to an attached document stays valid. Sized to a work
 * session rather than a page view: the administrator opens the document from a
 * screen they may leave open for hours.
 */
export const RUN_REPORT_FILE_URL_TTL_SECONDS = 60 * 60 * 6; // 6 hours

/** The app-wide upload ceiling, mirrored by the message `reportFileTooLarge`. */
export const MAX_RUN_REPORT_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

/** Accepted extensions — the formats the report writer can extract text from. */
export const RUN_REPORT_FILE_EXTENSIONS = /\.(pdf|docx|txt|md|markdown)$/i;

/** Accepted MIME types (a browser does not always know the type; the name decides then). */
export const RUN_REPORT_FILE_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
];

/**
 * Is this a file the platform can accept at all? Checks type AND size, so the
 * caller can refuse before reading a byte.
 *
 * @returns {{success: true} | {success: false, error: string}}
 */
export function validateRunReportFile(file) {
  if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function") {
    return { success: false, error: "platformMisc.runs.reportFileRequired" };
  }

  const mimeType = String(file.type || "").toLowerCase();
  const name = String(file.name || "");
  // A legacy .doc is refused even though its MIME type is listed above: some
  // browsers report an empty type, and the extension is the honest signal.
  if (/\.doc$/i.test(name)) {
    return { success: false, error: "platformMisc.runs.reportFileLegacyDoc" };
  }
  if (!RUN_REPORT_FILE_MIME_TYPES.includes(mimeType) && !RUN_REPORT_FILE_EXTENSIONS.test(name)) {
    return { success: false, error: "platformMisc.runs.reportFileTypeInvalid" };
  }

  if (Number(file.size) > MAX_RUN_REPORT_FILE_BYTES) {
    return { success: false, error: "platformMisc.runs.reportFileTooLarge" };
  }

  return { success: true };
}

/** Storage client — service role, so the private bucket needs no RLS policy. */
function storageClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}

/**
 * Object paths this domain owns always live under `runs/…`. Anything else is not
 * a run document and must never be signed or deleted on a caller's word.
 */
export function isManagedRunReportFilePath(path) {
  const value = String(path || "").trim();
  return value.startsWith("runs/") && !value.includes("..");
}

/**
 * Upload one document for a Run.
 *
 * @returns {Promise<{success: true, storage_path: string, file_name: string}
 *                 | {success: false, error: string}>}
 */
export async function uploadRunReportFileObject({ file, runId, fileName }) {
  const validation = validateRunReportFile(file);
  if (!validation.success) return validation;

  const client = storageClient();
  if (!client) return { success: false, error: "platformMisc.runs.reportFileStorageUnavailable" };

  const buffer = Buffer.from(await file.arrayBuffer());
  // The stored key is written by the code, never from the browser's file name
  // (lib/storageNames.js); `file_name` below keeps the readable one.
  const name = safeStorageName(fileName || file.name, "document");
  const path = safeStoragePath(
    `runs/${String(runId || "unknown").replace(/[^A-Za-z0-9_-]/g, "_")}/${Date.now()}-${name}`,
  );

  let upload = await client.storage
    .from(RUN_REPORT_FILE_BUCKET)
    .upload(path, buffer, { contentType: file.type || undefined, upsert: true });

  if (upload.error && /bucket.*not found|does not exist/i.test(upload.error.message)) {
    // Auto-create the bucket once — PRIVATE, unlike the public buckets.
    await client.storage.createBucket(RUN_REPORT_FILE_BUCKET, { public: false });
    upload = await client.storage
      .from(RUN_REPORT_FILE_BUCKET)
      .upload(path, buffer, { contentType: file.type || undefined, upsert: true });
  }
  if (upload.error) {
    console.error("[Run report file] upload failed:", upload.error.message);
    return { success: false, error: "platformMisc.runs.reportFileUploadFailed" };
  }

  return { success: true, storage_path: path, file_name: file.name || "document" };
}

/** Mint a short-lived link to one stored document. Null when it cannot be signed. */
export async function signRunReportFilePath(
  storagePath,
  expiresIn = RUN_REPORT_FILE_URL_TTL_SECONDS,
) {
  const path = String(storagePath || "").trim();
  if (!isManagedRunReportFilePath(path)) return null;
  const client = storageClient();
  if (!client) return null;
  try {
    const { data, error } = await client.storage
      .from(RUN_REPORT_FILE_BUCKET)
      .createSignedUrl(path, expiresIn);
    if (error) return null;
    return data?.signedUrl || null;
  } catch (error) {
    console.error("[Run report file] signing failed:", error.message);
    return null;
  }
}

/**
 * Best-effort removal of one stored document. Never throws: the database row is
 * the source of truth, and a storage hiccup must not block removing it.
 */
export async function removeRunReportFileObject(storagePath) {
  const path = String(storagePath || "").trim();
  if (!isManagedRunReportFilePath(path)) return false;
  const client = storageClient();
  if (!client) return false;
  try {
    const { error } = await client.storage.from(RUN_REPORT_FILE_BUCKET).remove([path]);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("[Run report file] removal failed:", error.message);
    return false;
  }
}

export default {
  RUN_REPORT_FILE_BUCKET,
  RUN_REPORT_FILE_URL_TTL_SECONDS,
  MAX_RUN_REPORT_FILE_BYTES,
  validateRunReportFile,
  uploadRunReportFileObject,
  signRunReportFilePath,
  removeRunReportFileObject,
  isManagedRunReportFilePath,
};
