/**
 * Input normalization for venture writes.
 *
 * Postgres rejects an EMPTY STRING in a DATE/TIMESTAMP column
 * (`invalid input syntax for type date: ""`), but forms naturally send "" when
 * a date field is cleared. Any date-ish value must therefore become NULL.
 */

/** undefined → undefined (leave untouched); "" / null → null; else YYYY-MM-DD. */
export function dateOrNull(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  return raw.slice(0, 10);
}

/** "" / null / undefined → null; otherwise the trimmed string. */
export function textOrNull(value) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  return raw === "" ? null : raw;
}

/**
 * A person reference (cid) is a bounded string. Anything else — an object, an
 * array, an empty string, an over-long blob — is not a usable owner, so it
 * becomes null instead of being coerced with `String(value)` (which would store
 * "[object Object]" and make the owner unresolvable).
 */
export function cidOrNull(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw || raw.length > 64) return null;
  return raw;
}

/**
 * True when the value is a usable person reference, or ABSENT.
 *
 * "Absent" includes the empty string. That is not a loophole — it is the value
 * a form sends when a field is CLEARED, and `cidOrNull` already normalizes it to
 * NULL. Treating it as malformed was a real defect: a milestone whose owner is an
 * external NAME (or has no owner at all) arrives as `owner_cid: ""` beside
 * `owner_name: "Amina"`, and rejecting it made that milestone impossible to save
 * — the assignment is complete without a platform identity, and that is the whole
 * point of the name half.
 *
 * What stays invalid is anything that is not a bounded string at all: an object,
 * an array, a number, or an over-long blob (which `cidOrNull` would drop anyway,
 * silently turning a caller's mistake into "no owner").
 */
export function isValidCid(value) {
  if (value === null || value === undefined) return true;
  if (typeof value !== "string") return false;
  return value.trim().length <= 64;
}

/** True when an error looks like a missing column (schema drift on old DBs). */
export function isUnknownColumnError(error) {
  const message = String(error?.message || "");
  return /column .* does not exist/i.test(message);
}

export default { dateOrNull, textOrNull, cidOrNull, isValidCid, isUnknownColumnError };
