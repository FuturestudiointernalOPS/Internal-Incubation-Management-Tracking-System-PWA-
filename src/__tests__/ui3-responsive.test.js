/**
 * PHASE UI-3d — small-screen parity (Permission Center).
 *
 * The permission center is a table-heavy admin area. The rule this phase
 * settled: a wide table may scroll ONLY from md up; below md the same data and
 * the same controls must reflow into cards. Locking the pairing (every table
 * hidden below md has exactly one card companion in the same file) stops the
 * next redesign from shipping a scroll-only surface — which is how the
 * Defaults Matrix, the eligibility matrix, the audit log and the two level
 * grids behaved before Phase 3.
 */

const fs = require("fs");
const path = require("path");

const DIR = path.join(process.cwd(), "src/components/permissions");

const read = (file) => fs.readFileSync(path.join(DIR, file), "utf8");
const count = (src, needle) => src.split(needle).length - 1;

const componentFiles = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith(".js"));

describe("UI-3d — small-screen parity", () => {
  test("every table hidden below md has a card companion", () => {
    const offenders = [];
    for (const file of componentFiles) {
      const src = read(file);
      const tables = count(src, "hidden md:block");
      const cards = count(src, "md:hidden");
      if (tables !== cards) {
        offenders.push(`${file}: ${tables} wide table(s), ${cards} card block(s)`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test("the table-heavy surfaces are actually covered", () => {
    // Guards the counts above from silently passing because a surface lost its
    // table (e.g. a refactor that deletes the md+ branch).
    for (const [file, expected] of [
      ["PermissionCenter.js", 3],
      ["PeopleView.js", 1],
      ["ContextRolesView.js", 1],
    ]) {
      expect(count(read(file), "md:hidden")).toBe(expected);
      expect(count(read(file), "hidden md:block")).toBe(expected);
    }
  });

  test("every card block is labelled as the parity view", () => {
    for (const file of componentFiles) {
      const src = read(file);
      if (!src.includes("md:hidden")) continue;
      expect(src).toMatch(/Small screens/);
    }
  });
});
