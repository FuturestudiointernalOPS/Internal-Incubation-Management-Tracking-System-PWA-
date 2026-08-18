/**
 * Shared email validation/parsing helpers.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value) {
  return typeof value === "string" && EMAIL_RE.test(value.trim());
}

export function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/**
 * Extract unique valid email addresses from arbitrary pasted text.
 * Supports newlines, commas, semicolons, and spaces as separators.
 */
export function parseEmailList(input) {
  const seen = new Set();
  const valid = [];

  const raw = Array.isArray(input) ? input.join("\n") : String(input || "");
  const tokens = raw.split(/[\s,;]+/);

  for (const token of tokens) {
    const email = normalizeEmail(token);
    if (!email || !isValidEmail(email) || seen.has(email)) continue;
    seen.add(email);
    valid.push(email);
  }

  return valid;
}
