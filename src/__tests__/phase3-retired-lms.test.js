/**
 * PHASE 3+ — Retired LMS capabilities are GONE from the catalog.
 *
 * The retired caps (assign / enroll / publish) migrated to the canonical
 * lms.edit gate and have now been deleted from the catalog. This guard makes
 * re-adding them fail loudly: a retired capability is dead weight, not a
 * capability.
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

describe("Retired LMS capabilities stay removed", () => {
  test("catalog no longer exposes assign/enroll/publish", () => {
    const { CAPABILITY_CATALOG } = require("@/models/authorization/capability-catalog");
    for (const cap of RETIRED) {
      expect(CAPABILITY_CATALOG.lms.capabilities[cap]).toBeUndefined();
    }
  });

  test("PERMISSION_MODULES never lists a retired capability", () => {
    const { PERMISSION_MODULES } = require("@/lib/auth");
    for (const cap of RETIRED) {
      expect(PERMISSION_MODULES.lms.capabilities).not.toContain(cap);
    }
  });

  test("no route enforces a retired capability (migrated to lms.edit)", () => {
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
    expect(sites).toEqual([]);
  });
});
