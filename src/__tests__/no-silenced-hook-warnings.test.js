/**
 * The React Hooks warnings are RECORDED, never silenced.
 *
 * The 2026-09 sweep converted every screen away from "write state from an
 * effect" and removed the four rule silences that were standing in for a fix
 * (each helper was moved into its only caller, or memoised and listed). Nothing
 * stops the pattern from creeping back one `disable-next-line` at a time, and a
 * silenced warning is invisible: it cannot be counted, reviewed or planned.
 *
 * This test is the guard. It reads every source file and fails on any line that
 * turns off a React Hooks rule. The two needles are built from pieces so this
 * file does not contain the literal it forbids and cannot match itself.
 */

const fs = require("fs");
const path = require("path");

const SRC = path.join(process.cwd(), "src");

// The two needles - a directive name and a rule namespace - are assembled from
// pieces at run time, so this file cannot match itself.
const DISABLE = ["eslint", "disable"].join("-");
const RULES = ["react", "hooks"].join("-");

// Generated trees that are not authored source.
const SKIP_DIRS = new Set(["graphify-out"]);

function jsFiles(dir) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      found.push(...jsFiles(path.join(dir, entry.name)));
    } else if (entry.name.endsWith(".js")) {
      found.push(path.join(dir, entry.name));
    }
  }
  return found;
}

describe("no React Hooks rule is silenced", () => {
  test("no source file disables a React Hooks rule", () => {
    const offences = [];
    for (const file of jsFiles(SRC)) {
      const lines = fs.readFileSync(file, "utf8").split("\n");
      lines.forEach((line, index) => {
        if (line.includes(DISABLE) && line.includes(RULES)) {
          offences.push(`${path.relative(process.cwd(), file)}:${index + 1}`);
        }
      });
    }

    expect(offences).toEqual([]);
  });

  test("the guard actually looks at the sources", () => {
    // A silent recursion bug would make the test above pass for the wrong
    // reason, which is exactly the failure mode it exists to prevent.
    expect(jsFiles(SRC).length).toBeGreaterThan(200);
  });
});
