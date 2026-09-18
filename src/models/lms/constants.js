/**
 * LMS DOMAIN CONSTANTS
 *
 * Single source of truth for the LMS vocabulary. Mirrors the CHECK-constraint
 * values in supabase/migrations/20260827_lms_foundation.sql — keep the two in
 * sync (src/__tests__/lms-foundation.test.js asserts the match).
 *
 * Values are lowercase strings because they are stored as-is in the database.
 */

export const LMS_COURSE_STATUSES = ["draft", "published", "archived"];

export const LMS_COURSE_VISIBILITY = ["public", "private"];

export const LMS_ENROLLMENT_SOURCES = ["admin", "program", "self", "purchase"];

export const LMS_ENROLLMENT_STATUSES = ["active", "completed", "suspended"];

export const LMS_PROGRESS_STATUSES = ["not_started", "in_progress", "completed"];

export const LMS_LESSON_CONTENT_TYPES = ["video"];

export const LMS_QUESTION_TYPES = ["multiple_choice", "true_false"];

export const LMS_CERTIFICATE_STATUSES = ["valid", "revoked"];

// ── Section resources ──────────────────────────────────────────────────────
// Mirrors the CHECK constraints in
// supabase/migrations/20260918_lms_section_resources.sql.
export const LMS_RESOURCE_KINDS = ["video", "document"];

export const LMS_RESOURCE_SOURCES = ["link", "upload"];

/**
 * Upload ceilings per resource kind. Documents follow the app-wide 5 MB limit
 * (see src/lib/storage.js); video files are heavier by nature.
 */
export const LMS_MAX_DOCUMENT_BYTES = 5 * 1024 * 1024; // 5 MB
export const LMS_MAX_VIDEO_BYTES = 25 * 1024 * 1024; // 25 MB

export function lmsMaxBytesForKind(kind) {
  return kind === "video" ? LMS_MAX_VIDEO_BYTES : LMS_MAX_DOCUMENT_BYTES;
}

/**
 * Accepted MIME types per resource kind. Declared here (pure, client-safe) so the
 * picker and the server enforce the SAME rules — see sectionResourceFiles.js.
 */
export const LMS_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.presentation",
  "text/plain",
  "text/csv",
  "text/markdown",
  "image/png",
  "image/jpeg",
  "image/webp",
];

export const LMS_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
];

/** Extensions accepted per kind (some browsers report an empty MIME type). */
export const LMS_RESOURCE_EXTENSIONS = {
  document: /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|odt|ods|odp|txt|csv|md|png|jpe?g|webp)$/i,
  video: /\.(mp4|webm|mov|m4v)$/i,
};

/** True when a browser File is acceptable for the given kind. */
export function isAcceptedResourceFile(file, kind) {
  const resolved = kind === "video" ? "video" : "document";
  const mimes = resolved === "video" ? LMS_VIDEO_MIME_TYPES : LMS_DOCUMENT_MIME_TYPES;
  return (
    mimes.includes(String(file?.type || "").toLowerCase()) ||
    LMS_RESOURCE_EXTENSIONS[resolved].test(file?.name || "")
  );
}

/**
 * Which inline preview — if any — a resource can offer on the learner surface.
 *
 * Only files uploaded through ImpactOS are previewed: an external link may
 * refuse to be embedded (X-Frame-Options / CSP) and downloading it from our own
 * storage keeps the read path predictable. Images, PDFs and video files get one;
 * anything else (Office documents) opens in a new tab, as before.
 *
 * @returns {"image" | "pdf" | "video" | null}
 */
export function resourcePreviewKind(resource) {
  if (!resource || resource.source !== "upload" || !resource.url) return null;
  const mime = String(resource.mime_type || "").toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("video/")) return "video";
  // Some browsers send no mime type: fall back to the stored filename.
  const name = String(resource.file_name || "").toLowerCase();
  if (/\.(png|jpe?g|webp)$/.test(name)) return "image";
  if (/\.pdf$/.test(name)) return "pdf";
  if (/\.(mp4|webm|mov|m4v)$/.test(name)) return "video";
  return null;
}

/** Browser `accept="…"` hints for the session-resource file picker. */
export const LMS_RESOURCE_ACCEPT = {
  document:
    ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.txt,.csv,.md,.png,.jpg,.jpeg,.webp",
  video: ".mp4,.webm,.mov,.m4v",
};

/** Human-readable file size (client-safe, no locale dependency). */
export function formatFileSize(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return "";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  // One decimal, but without a pointless ".0" (4 MB, not 4.0 MB).
  return `${Number((value / (1024 * 1024)).toFixed(1))} MB`;
}
