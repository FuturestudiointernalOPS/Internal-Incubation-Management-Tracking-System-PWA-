import { createClient } from "@supabase/supabase-js";
import { LmsError } from "./errors";
import {
  LMS_DOCUMENT_MIME_TYPES,
  LMS_RESOURCE_EXTENSIONS,
  LMS_VIDEO_MIME_TYPES,
  lmsMaxBytesForKind,
  LMS_MAX_DOCUMENT_BYTES,
  LMS_MAX_VIDEO_BYTES,
} from "./constants";

/**
 * SESSION RESOURCE FILE STORAGE (Phase 8.1)
 *
 * Server-side upload/delete for files attached to a Program session
 * (`source = 'upload'` in lms_session_resources). Mirrors
 * `/api/lms/courses/thumbnail`: the service-role key is used so no storage-RLS
 * policy is required, and the bucket is auto-created on first use.
 *
 * Two families of files are accepted, each with its own ceiling (declared in
 * ./constants so the browser picker and the server enforce the SAME rules):
 *   - documents: PDF / Office / text / images — 5 MB (the app-wide upload limit)
 *   - videos:    mp4 / webm / mov / m4v      — 25 MB (video is heavier by nature)
 *
 * The size ceilings are enforced HERE and surfaced to the caller as i18n keys —
 * a file that is too big never reaches storage.
 */

export const SESSION_RESOURCE_BUCKET = "lms-session-resources";

/**
 * How long a learner's link to an uploaded file stays valid.
 *
 * Sized to a session rather than to a page view: the participant surface hands
 * the link out in the payload of a page that can stay open for hours, so a
 * one-hour link would expire under a learner who left the tab open — while a
 * copied link is still worth only that window. (Evidence files sign per read of
 * a flow fetched on demand, hence their shorter TTL.)
 */
export const SESSION_RESOURCE_URL_TTL_SECONDS = 60 * 60 * 6; // 6 hours

// Accepted types live in ./constants (shared with the picker); these aliases
// keep the historical server-side names.
export const DOCUMENT_MIME_TYPES = LMS_DOCUMENT_MIME_TYPES;
export const VIDEO_MIME_TYPES = LMS_VIDEO_MIME_TYPES;
export { LMS_MAX_DOCUMENT_BYTES, LMS_MAX_VIDEO_BYTES, lmsMaxBytesForKind };

/** Accepted `kind` values for an uploaded file (matches lms_session_resources.kind). */
export function normalizeFileKind(value) {
  const kind = String(value ?? "").trim().toLowerCase();
  if (!kind) return "document";
  if (kind !== "document" && kind !== "video") {
    throw new LmsError("lms.errors.invalidResourceKind", 400);
  }
  return kind;
}

/**
 * Validate a browser File for a given kind. Throws an LmsError with an i18n key
 * so the route can answer 400 without touching storage.
 */
export function assertUploadableFile(file, kind) {
  if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function") {
    throw new LmsError("lms.errors.fileRequired", 400);
  }
  const resolvedKind = normalizeFileKind(kind);
  const mimeTypes = resolvedKind === "video" ? VIDEO_MIME_TYPES : DOCUMENT_MIME_TYPES;

  const mimeOk = mimeTypes.includes(String(file.type || "").toLowerCase());
  const extensionOk = LMS_RESOURCE_EXTENSIONS[resolvedKind].test(file.name || "");
  if (!mimeOk && !extensionOk) {
    throw new LmsError(
      resolvedKind === "video" ? "lms.errors.invalidVideoFile" : "lms.errors.invalidDocumentFile",
      400,
    );
  }

  const maxBytes = lmsMaxBytesForKind(resolvedKind);
  if (Number(file.size) > maxBytes) {
    throw new LmsError("lms.errors.fileTooLarge", 400, {
      maxMb: Math.round(maxBytes / (1024 * 1024)),
    });
  }
  return resolvedKind;
}

/**
 * Object paths used by this domain always live under `sessions/…`. Anything else
 * is not a session-resource object and must never be deleted on a caller's word.
 */
export function isManagedStoragePath(storagePath) {
  const path = String(storagePath || "").trim();
  return path.startsWith("sessions/") && !path.includes("..");
}

/** Storage client — service role, same as the course-thumbnail upload. */
function storageClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}

function sanitizeFileName(name) {
  return String(name || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
}

/**
 * Upload one session resource file.
 * `programId` / `sessionId` only shape the object path (they are never trusted
 * for existence — the service validates that separately).
 *
 * @returns {Promise<{url: string, storage_path: string, file_name: string,
 *                    file_size: number, mime_type: string, kind: string}>}
 */
export async function uploadSessionResourceFile({ file, kind, programId, sessionId }) {
  const resolvedKind = assertUploadableFile(file, kind);

  const supabase = storageClient();
  if (!supabase) throw new LmsError("lms.errors.storageUnavailable", 500);

  const buffer = Buffer.from(await file.arrayBuffer());
  const folder = `sessions/${String(programId || "unassigned")}/${String(sessionId || "program")}`;
  const objectPath = `${folder}/${Date.now()}-${sanitizeFileName(file.name)}`;

  let upload = await supabase.storage
    .from(SESSION_RESOURCE_BUCKET)
    .upload(objectPath, buffer, { contentType: file.type || undefined, upsert: true });

  if (upload.error) {
    // Auto-create the public bucket once, then retry (same as course thumbnails).
    await supabase.storage.createBucket(SESSION_RESOURCE_BUCKET, { public: true });
    upload = await supabase.storage
      .from(SESSION_RESOURCE_BUCKET)
      .upload(objectPath, buffer, { contentType: file.type || undefined, upsert: true });
    if (upload.error) throw new LmsError("lms.errors.fileUploadFailed", 500);
  }

  const publicUrl = supabase.storage
    .from(SESSION_RESOURCE_BUCKET)
    .getPublicUrl(objectPath).data.publicUrl;

  return {
    url: publicUrl,
    storage_path: objectPath,
    file_name: file.name || "file",
    file_size: Number(file.size) || buffer.length,
    mime_type: file.type || null,
    kind: resolvedKind,
  };
}

/**
 * Mint a short-lived signed URL for one stored object.
 *
 * This is how a learner reads an uploaded file: the permanent public URL stays
 * on the row for the staff surfaces (where handing over a link is acceptable),
 * while a learner is given a link that stops working (see
 * SESSION_RESOURCE_URL_TTL_SECONDS). Returns null when there is nothing to sign
 * or when storage refuses — the caller decides what a missing URL means.
 */
export async function signSessionResourcePath(
  storagePath,
  expiresIn = SESSION_RESOURCE_URL_TTL_SECONDS,
) {
  const path = String(storagePath || "").trim();
  if (!isManagedStoragePath(path)) return null;
  const supabase = storageClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.storage
      .from(SESSION_RESOURCE_BUCKET)
      .createSignedUrl(path, expiresIn);
    if (error) return null;
    return data?.signedUrl || null;
  } catch (e) {
    console.error("[LMS] session resource signing failed:", e.message);
    return null;
  }
}

/**
 * Best-effort removal of an uploaded object. Never throws: a storage hiccup must
 * not block deleting the resource row (the DB stays the source of truth).
 */
export async function removeSessionResourceFile(storagePath) {
  const path = String(storagePath || "").trim();
  if (!path || !isManagedStoragePath(path)) return false;
  const supabase = storageClient();
  if (!supabase) return false;
  try {
    const { error } = await supabase.storage.from(SESSION_RESOURCE_BUCKET).remove([path]);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error("[LMS] session resource file removal failed:", e.message);
    return false;
  }
}
