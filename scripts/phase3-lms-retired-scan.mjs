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

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(js|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
}

// 1. Enforcement sites — requireAuthorization("lms", <retired>).
const sites = [];
for (const root of SRC_DIRS) {
  for (const f of walk(join(ROOT, root))) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/requireAuthorization\(\s*"lms"\s*,\s*"(assign|enroll|publish)"\)/g)) {
      sites.push({
        file: f.replace(ROOT + "/", "").replace(/\\/g, "/"),
        capability: `lms.${m[1]}`,
      });
    }
  }
}

// 2. Grant sources — any seed/INSERT writing a retired cap into a grant table.
const offenders = [];
for (const root of SRC_DIRS) {
  for (const f of walk(join(ROOT, root))) {
    const src = readFileSync(f, "utf8");
    if (!/INSERT INTO (access_profile_capabilities|user_capabilities|role_capabilities)/.test(src)) continue;
    for (const m of src.matchAll(
      /INSERT INTO (access_profile_capabilities|user_capabilities|role_capabilities)[^;]*?/gs,
    )) {
      const block = m[0];
      for (const cap of RETIRED) {
        if (new RegExp(`["']lms["']\\s*,\\s*["']${cap}["']|lms\\.${cap}`).test(block)) {
          offenders.push(`${f.replace(ROOT + "/", "").replace(/\\/g, "/")} writes lms.${cap} in a grant INSERT`);
        }
      }
    }
  }
}

mkdirSync("scratch", { recursive: true });
const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
const outFile = `scratch/phase3-lms-retired-${stamp}.json`;
writeFileSync(outFile, JSON.stringify({ scannedAt: new Date().toISOString(), sites, grantOffenders: offenders }, null, 2));

console.log(`retired-lms enforcement sites: ${sites.length}`);
for (const s of sites) console.log(`  [${s.capability}] ${s.file}`);
console.log(`grant-source offenders: ${offenders.length}`);
for (const o of offenders) console.log(`  !! ${o}`);
console.log("report:", outFile);
if (offenders.length > 0) process.exit(1);
