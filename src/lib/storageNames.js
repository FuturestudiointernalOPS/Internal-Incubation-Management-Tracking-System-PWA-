/**
 * HOW AN UPLOADED FILE IS NAMED IN STORAGE — the key is written by the code,
 * never taken from the browser.
 *
 * The storage service accepts only a narrow ASCII subset in an object key:
 * letters, digits and a handful of punctuation marks. Everything else — an
 * accent, an en dash "–", "#", "%" — and it refuses the WHOLE upload
 * ("Invalid key"): a perfectly valid document could not be attached merely
 * because of the way it happened to be named on someone's desktop.
 *
 * Every upload therefore builds its key HERE. Characters the service refuses
 * become "_", the tail of the name is kept (and with it the extension, so the
 * object stays identifiable and a browser opens it with the right
 * application), and each segment is capped so a pathological file name cannot
 * produce an unusable key. The readable name is not lost: every upload flow
 * records it next to the link it stores (attachment name, file name, resource
 * name).
 */

/** Everything the storage service rejects in an object key. */
const UNSAFE_IN_KEY = /[^A-Za-z0-9._-]/g;

/** One key segment stays well inside every length the service enforces. */
const MAX_SEGMENT_LENGTH = 120;

/**
 * One storage-safe segment — a file name, or a single folder.
 *
 * Falls back to `fallback` when nothing usable is left: an empty segment would
 * move the object somewhere other than where the caller asked for it.
 */
export function safeStorageName(name, fallback = "file") {
  const cleaned = String(name || "")
    .replace(UNSAFE_IN_KEY, "_")
    .slice(-MAX_SEGMENT_LENGTH);
  return cleaned || fallback;
}

/**
 * A whole object key, sanitized segment by segment: a folder built from user
 * input fails an upload exactly like a file name does.
 */
export function safeStoragePath(path, fallback = "file") {
  const segments = String(path || "")
    .split("/")
    .filter((segment) => segment.trim() !== "")
    .map((segment) => safeStorageName(segment.trim(), fallback));
  // Nothing usable left — an empty key is one storage refuses outright.
  return segments.length > 0 ? segments.join("/") : safeStorageName(fallback);
}

export default { safeStorageName, safeStoragePath };
