/**
 * Coarse, dependency-free User-Agent classification for the sign-in history the
 * admin Security console shows (its Device / Browser columns).
 *
 * This is PRESENTATION ONLY — never a security or authorization decision — so an
 * empty or unknown string degrades to `null` (or a plain "Desktop" device) rather
 * than throwing. The order of the tables matters: a Chromium browser advertises
 * "Chrome/" too, so Edge ("Edg/") and Opera ("OPR/") are matched first, and a
 * Chromium build is matched before the generic "Safari" that every Blink browser
 * also carries. Likewise an iPhone string contains "Mac OS X", so the Apple
 * mobile tokens are checked before the desktop macOS one.
 */

const BROWSERS = [
  [/Edg[A-Za-z]*\//, "Edge"],
  [/OPR\/|Opera\//, "Opera"],
  [/Chromium\//, "Chromium"],
  [/Chrome\//, "Chrome"],
  [/Firefox\//, "Firefox"],
  [/Safari\//, "Safari"],
];

const SYSTEMS = [
  [/Windows NT/, "Windows"],
  [/iPhone|iPad|iPod/, "iOS"],
  [/Android/, "Android"],
  [/Mac OS X/, "macOS"],
  [/CrOS/, "ChromeOS"],
  [/Linux/, "Linux"],
];

function matchFirst(value, table) {
  for (const [pattern, label] of table) {
    if (pattern.test(value)) return label;
  }
  return null;
}

function detectDevice(value) {
  if (/iPad|Tablet/i.test(value)) return "Tablet";
  if (/Mobi|iPhone|iPod|Android/i.test(value)) return "Mobile";
  return "Desktop";
}

/** Best-effort { browser, os, device } labels for a User-Agent header value. */
export function summarizeUserAgent(userAgent) {
  const value = typeof userAgent === "string" ? userAgent : "";
  if (!value) return { browser: null, os: null, device: null };
  return {
    browser: matchFirst(value, BROWSERS),
    os: matchFirst(value, SYSTEMS),
    device: detectDevice(value),
  };
}

export default { summarizeUserAgent };
