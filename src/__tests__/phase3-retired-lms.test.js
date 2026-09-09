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

  test("enforcement sites are exactly the known inventory (self-revealing on migration)", () => {
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
    expect([...sites].sort()).toEqual(
      [
        "app/api/lms/courses/[id]/enrollments/route.js:lms.enroll",
        "app/api/lms/courses/[id]/publish/route.js:lms.publish",
        "app/api/lms/enrollments/route.js:lms.enroll",
        "app/api/lms/program-requirements/[id]/route.js:lms.assign",
        "app/api/lms/program-requirements/[id]/route.js:lms.assign",
        "app/api/lms/program-requirements/route.js:lms.assign",
      ].sort(),
    );
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
