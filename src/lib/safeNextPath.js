/**
 * A `next` destination is only ever accepted as an INTERNAL path.
 *
 * Anything that is not a bare path is refused: an absolute URL, a
 * protocol-relative `//host` (which the browser follows off-site), a `/\`
 * variant, or an embedded `scheme://`. A doubtful value yields null, and the
 * caller falls back to its normal destination — never an off-site redirect.
 */
export function safeNextPath(raw) {
  if (typeof raw !== "string") return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return null;
  if (raw.includes("://")) return null;
  return raw;
}
