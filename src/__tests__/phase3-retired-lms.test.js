/**
 * PHASE 3 — Retired-LMS freeze contract.
 *
 * Locks Decision 5: lms.assign / lms.enroll / lms.publish are retired —
 * no new grants, route enforcement inventoried (self-revealing when a site
 * migrates), removal only after zero-dependency proof (Phase 6).
 */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "..");
const RETIRED = ["assign", "enroll", "publish"];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(js|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
}

const SRC_DIRS = ["src/app", "src/models", "src/lib"];

describe("Phase 3 — retired LMS capabilities stay retired", () => {
  test("catalog marks assign/enroll/publish as retired", () => {
    const { CAPABILITY_CATALOG } = require("@/models/authorization/capability-catalog");
    for (const cap of RETIRED) {
      expect(CAPABILITY_CATALOG.lms.capabilities[cap]?.retired).toBe(true);
    }
  });

  test("no route enforces a retired capability anymore (migrated to lms.edit, Option A)", () => {
    const sites = [];
    for (const root of SRC_DIRS) {
      for (const f of walk(path.join(ROOT, root))) {
        const src = fs.readFileSync(f, "utf8");
        for (const m of src.matchAll(
          /requireAuthorization\(\s*"lms"\s*,\s*"(assign|enroll|publish)"\)/g,
        )) {
          sites.push(`${f.replace(/\\/g, "/").split("/src/")[1]}:lms.${m[1]}`);
        }
      }
    }
    // Phase 3 Option A migrated all six sites to lms.edit (rosters,
    // enrollment, publish, program requirements). If a retired gate appears
    // again this fails — migrate it, don't re-add.
    expect(sites).toEqual([]);
  });

  test("no grant seed writes a retired capability (no new grants)", () => {
    const offenders = [];
    for (const root of SRC_DIRS) {
      for (const f of walk(path.join(ROOT, root))) {
        const src = fs.readFileSync(f, "utf8");
        if (!/INSERT INTO (access_profile_capabilities|user_capabilities|role_capabilities)/.test(src)) continue;
        for (const m of src.matchAll(
          /INSERT INTO (access_profile_capabilities|user_capabilities|role_capabilities)[^;]*?/gs,
        )) {
          const block = m[0];
          for (const cap of RETIRED) {
            if (new RegExp(`["']lms["']\\s*,\\s*["']${cap}["']|lms\\.${cap}`).test(block)) {
              offenders.push(`${f}: lms.${cap}`);
            }
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
