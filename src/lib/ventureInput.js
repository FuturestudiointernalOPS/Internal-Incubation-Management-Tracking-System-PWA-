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

/** True when an error looks like a missing column (schema drift on old DBs). */
export function isUnknownColumnError(error) {
  const message = String(error?.message || "");
  return /column .* does not exist/i.test(message);
}

export default { dateOrNull, textOrNull, isUnknownColumnError };
