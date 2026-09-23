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

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath, files);
    else if (/\.(js|mjs)$/.test(entry.name)) files.push(fullPath);
  }
  return files;
}

const SRC_DIRS = ["src/app", "src/models", "src/lib"];

describe("Retired LMS capabilities stay removed", () => {
  test("catalog no longer exposes assign/enroll/publish", () => {
    const { CAPABILITY_CATALOG } = require("@/models/authorization/capability-catalog");
    for (const capability of RETIRED) {
      expect(CAPABILITY_CATALOG.lms.capabilities[capability]).toBeUndefined();
    }
  });

  test("PERMISSION_MODULES never lists a retired capability", () => {
    const { PERMISSION_MODULES } = require("@/lib/auth");
    for (const capability of RETIRED) {
      expect(PERMISSION_MODULES.lms.capabilities).not.toContain(capability);
    }
  });

  test("no route enforces a retired capability (migrated to lms.edit)", () => {
    const sites = [];
    for (const root of SRC_DIRS) {
      for (const file of walk(path.join(ROOT, root))) {
        const src = fs.readFileSync(file, "utf8");
        for (const match of src.matchAll(
          /requireAuthorization\(\s*"lms"\s*,\s*"(assign|enroll|publish)"\)/g,
        )) {
          sites.push(`${file.replace(/\\/g, "/").split("/src/")[1]}:lms.${match[1]}`);
        }
      }
    }
    expect(sites).toEqual([]);
  });
});
