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
const {
  readPermissionCenterSurface,
  extractedFiles,
  count,
} = require("./helpers/permissionCenterSource");

const read = (file) => fs.readFileSync(path.join(DIR, file), "utf8");

/**
 * Every component file, RECURSIVELY.
 *
 * This used to be a flat `readdirSync(DIR)`, which meant the moment the center
 * was split into `permission-center/`, every extracted screen would have
 * silently dropped out of BOTH tests below — a screen could lose its card
 * companion and the parity guard would never see it. Recursing is what keeps the
 * promise of this suite.
 */
const componentFiles = [
  ...fs.readdirSync(DIR).filter((file) => file.endsWith(".js")),
  ...extractedFiles().map((file) => path.relative(DIR, file)),
];

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
    //
    // The permission center is one entry read as a WHOLE SURFACE: its two wide
    // tables live in the shim and in `permission-center/`, and the point of the
    // count is "the center still has exactly two table surfaces". Reading only
    // the shim would report 0 once the tables move, which is a false failure,
    // and reading only one file would miss one of them, which is a false pass.
    for (const [file, expected] of [
      [null, 2],
      ["people-view/PeopleMatrix.js", 1],
      ["ContextRolesView.js", 1],
    ]) {
      const src = file === null ? readPermissionCenterSurface() : read(file);
      expect(count(src, "md:hidden")).toBe(expected);
      expect(count(src, "hidden md:block")).toBe(expected);
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
