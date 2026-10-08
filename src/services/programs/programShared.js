/**
 * Programs — the small pure helpers the lifecycle modules share (SERVICE layer).
 *
 * Layer (see docs/LAYER_SPLIT.md): pure shaping, no SQL, no HTTP, no models.
 */

/** A JSON-encoded map, or the value itself when it is already an object. */
export function parseJsonObject(value) {
  if (typeof value !== "string") return value || {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}
