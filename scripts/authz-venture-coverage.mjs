/**
 * AUTHZ COVERAGE — venture API gate census.
 *
 * Answers "is everything on the NEW system yet?" by classifying every
 * venture API route file under src/app/api/ventures:
 *
 *   scoped → uses requireVentureScopedAccess (new system; legacy fallback only
 *            while AUTHZ_VENTURE_STRICT is off)
 *   legacy → still calls requireAuth / requireVentureAccess directly (old gate)
 *   none   → no venture gate at all on this file (SA-only or custom guard)
 *
 * Exit code 1 while any `legacy` file remains, so the count only goes one way.
 * Run: node scripts/authz-venture-coverage.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = "src/app/api/ventures";

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name === "route.js") files.push(p);
  }
})(ROOT);

const buckets = { scoped: [], legacy: [], none: [] };

for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  const rel = file.replace(/\\/g, "/");
  if (src.includes("requireVentureScopedAccess")) buckets.scoped.push(rel);
  else if (src.includes("requireVentureAccess(") || src.includes("requireAuth("))
    buckets.legacy.push(rel);
  else buckets.none.push(rel);
}

const list = (arr) => arr.map((f) => `    ${f}`).join("\n");

console.log(`AUTHZ VENTURE COVERAGE — ${files.length} route files\n`);
console.log(`  NEW SYSTEM (scoped) : ${buckets.scoped.length}`);
console.log(`  OLD GATE (legacy)   : ${buckets.legacy.length}`);
console.log(`  NO VENTURE GATE     : ${buckets.none.length}`);
if (buckets.legacy.length) {
  console.log(`\n  Still on the old gate:\n${list(buckets.legacy)}`);
}
if (buckets.none.length) {
  console.log(`\n  No venture gate (SA-only / custom guard):\n${list(buckets.none)}`);
}
console.log(
  `\nSTRICT MODE: ${process.env.AUTHZ_VENTURE_STRICT === "1" ? "ON — fallback disabled" : "off — fallback active (parity)"}`,
);

process.exit(buckets.legacy.length > 0 ? 1 : 0);
