/**
 * PHASE 3 — Retired-LMS capability scan (static, no DB).
 *
 * Policy (Decision 5): lms.assign / lms.enroll / lms.publish are RETIRED.
 *   - no NEW grants (blocked by the retirement backfill + this scan);
 *   - existing route enforcement is inventoried below until each site
 *     migrates to its canonical capability (governance backlog);
 *   - permanent removal happens only after zero runtime dependency proof
 *     (Phase 6), never before.
 *
 * Usage: node scripts/phase3-lms-retired-scan.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const RETIRED = ["assign", "enroll", "publish"];
const SRC_DIRS = ["src/app", "src/models", "src/lib"];

function walk(directory, collected = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) walk(entryPath, collected);
    else if (/\.(js|mjs)$/.test(entry.name)) collected.push(entryPath);
  }
  return collected;
}

// 1. Enforcement sites — requireAuthorization("lms", <retired>).
const sites = [];
for (const root of SRC_DIRS) {
  for (const file of walk(join(ROOT, root))) {
    const src = readFileSync(file, "utf8");
    for (const match of src.matchAll(/requireAuthorization\(\s*"lms"\s*,\s*"(assign|enroll|publish)"\)/g)) {
      sites.push({
        file: file.replace(ROOT + "/", "").replace(/\\/g, "/"),
        capability: `lms.${match[1]}`,
      });
    }
  }
}

// 2. Grant sources — any seed/INSERT writing a retired cap into a grant table.
const offenders = [];
for (const root of SRC_DIRS) {
  for (const file of walk(join(ROOT, root))) {
    const src = readFileSync(file, "utf8");
    if (!/INSERT INTO (access_profile_capabilities|user_capabilities|role_capabilities)/.test(src)) continue;
    for (const match of src.matchAll(
      /INSERT INTO (access_profile_capabilities|user_capabilities|role_capabilities)[^;]*?/gs,
    )) {
      const block = match[0];
      for (const capability of RETIRED) {
        if (new RegExp(`["']lms["']\\s*,\\s*["']${capability}["']|lms\\.${capability}`).test(block)) {
          offenders.push(`${file.replace(ROOT + "/", "").replace(/\\/g, "/")} writes lms.${capability} in a grant INSERT`);
        }
      }
    }
  }
}

mkdirSync("scratch", { recursive: true });
const timestamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
const outputFile = `scratch/phase3-lms-retired-${timestamp}.json`;
writeFileSync(outputFile, JSON.stringify({ scannedAt: new Date().toISOString(), sites, grantOffenders: offenders }, null, 2));

console.log(`retired-lms enforcement sites: ${sites.length}`);
for (const site of sites) console.log(`  [${site.capability}] ${site.file}`);
console.log(`grant-source offenders: ${offenders.length}`);
for (const offender of offenders) console.log(`  !! ${offender}`);
console.log("report:", outputFile);
if (offenders.length > 0) process.exit(1);
