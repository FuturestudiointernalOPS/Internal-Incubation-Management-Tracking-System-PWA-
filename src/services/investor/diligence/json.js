/**
 * Investor service — the diligence JSON-column helper.
 *
 * `version_history` and `follow_up_questions` arrive as a JSON string, a parsed
 * value, or nothing. No SQL, no HTTP.
 */

/** Parse a JSON column that may arrive as a string, a value, or nothing. */
export function toArray(value) {
  let parsed = value || [];
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch (_) {
      parsed = [];
    }
  }
  return Array.isArray(parsed) ? parsed : [];
}