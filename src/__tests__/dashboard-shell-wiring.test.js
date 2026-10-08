/**
 * The dashboard shell wiring.
 *
 * `src/components/layout/DashboardLayout.js` keeps the composition; the badge
 * reads/effects live in `shell/useDashboardBadges.js` and the sidebar accordion
 * lives in `shell/useDashboardNavigation.js`. Nothing type-checks the values the
 * parent destructures against the hooks' returned objects, so a key that is
 * renamed on one side - or a hook argument the parent stops passing - is
 * invisible to the behavioural suite. This pins the contract.
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const PARENT = path.join(ROOT, "components", "layout", "DashboardLayout.js");
const BADGES = path.join(ROOT, "components", "layout", "shell", "useDashboardBadges.js");
const NAV = path.join(ROOT, "components", "layout", "shell", "useDashboardNavigation.js");

const read = (file) => fs.readFileSync(file, "utf8");

const returnedKeys = (source) => {
  const match = source.match(/^ {2}return \{([\s\S]*?)\};/m);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const destructuredKeys = (parent, hook) => {
  const match = parent.match(new RegExp(`const \\{([^}]*)\\} =\\s*${hook}\\(`));
  if (!match) return [];
  return match[1]
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const calledWithKeys = (parent, hook) => {
  const match = parent.match(new RegExp(`${hook}\\(\\{([^}]*)\\}`));
  if (!match) return [];
  return match[1]
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

describe("the dashboard shell wiring", () => {
  const parent = read(PARENT);
  const badges = read(BADGES);
  const nav = read(NAV);

  test("every badge value the shell destructures is returned by the hook", () => {
    const available = new Set(returnedKeys(badges));
    expect(destructuredKeys(parent, "useDashboardBadges").filter((key) => !available.has(key))).toEqual(
      [],
    );
  });

  test("every navigation value the shell destructures is returned by the hook", () => {
    const available = new Set(returnedKeys(nav));
    expect(
      destructuredKeys(parent, "useDashboardNavigation").filter((key) => !available.has(key)),
    ).toEqual([]);
  });

  test("the shell feeds the badge hook the capability matrix and the route", () => {
    expect(calledWithKeys(parent, "useDashboardBadges").sort()).toEqual(["effectiveCaps", "pathname"]);
  });

  test("the shell feeds the navigation hook everything the sidebar derives from", () => {
    expect(calledWithKeys(parent, "useDashboardNavigation").sort()).toEqual([
      "effectiveCaps",
      "pathname",
      "pmPrograms",
      "relationships",
      "role",
      "user",
      "ventureAssignCount",
    ]);
  });
});
