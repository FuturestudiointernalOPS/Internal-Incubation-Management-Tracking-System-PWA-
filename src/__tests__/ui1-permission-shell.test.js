/**
 * PHASE UI-1/UI-5 — Permission Center shell contract.
 *
 * Locks the things that silently rot in a redesigned admin area:
 *   1. Navigation ↔ routes: every nav item points at a real route page, and
 *      that page renders the shell with the matching `active` key.
 *   2. Navigation ↔ translations: every nav/sub-tab label resolves in BOTH
 *      English and French (no raw key leaking into the UI).
 *   3. The readability rules of the current centre: four places, never more than three
 *      sub-tasks under a tab, and a sub-tab is never named like its own tab.
 *   4. Retired doors keep forwarding, so old bookmarks never 404.
 */

const fs = require("fs");
const path = require("path");

const {
  PERMISSION_BASE,
  PERMISSION_NAV,
  routeSegmentFor,
} = require("@/components/permissions/permissionNav");
const { summarizeContextRoles } = require("@/components/permissions/overviewHelpers");

const EN = require("@/locales/en/engineering.json");
const FR = require("@/locales/fr/engineering.json");
const { readPermissionCenterSurface } = require("./helpers/permissionCenterSource");

const ROUTE_ROOT = path.join(process.cwd(), "src/app/admin/security/permissions");

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const resolveKey = (bundle, dotted) =>
  dotted
    .split(".")
    .reduce((acc, part) => (acc == null ? undefined : acc[part]), bundle);

const routeFileFor = (navItem) => {
  const segment = routeSegmentFor(navItem);
  return path.join(ROUTE_ROOT, segment, "page.js");
};

describe("UI-5 — navigation model", () => {
  test("keys and hrefs are unique and live under the Permission Center base", () => {
    const keys = PERMISSION_NAV.map((navItem) => navItem.key);
    const hrefs = PERMISSION_NAV.map((navItem) => navItem.href);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const href of hrefs) expect(href.startsWith(PERMISSION_BASE)).toBe(true);
  });

  test("the places, in the order an admin asks", () => {
    expect(PERMISSION_NAV.map((navItem) => navItem.key)).toEqual([
      "people",
      "templates",
      "rules",
      "history",
    ]);
  });

  test("sub-tabs are unique per item and defaultSub points at a real tab", () => {
    for (const item of PERMISSION_NAV) {
      if (!item.tabs) continue;
      const tabKeys = item.tabs.map((tab) => tab.key);
      expect(new Set(tabKeys).size).toBe(tabKeys.length);
      expect(tabKeys).toContain(item.defaultSub);
    }
  });

  test("never more than three sub-tasks under a tab", () => {
    for (const item of PERMISSION_NAV) {
      expect((item.tabs || []).length).toBeLessThanOrEqual(3);
    }
  });

  test("a sub-tab is never named like its own tab", () => {
    for (const item of PERMISSION_NAV) {
      for (const tab of item.tabs || []) {
        expect(tab.labelKey).not.toBe(item.labelKey);
      }
    }
  });

  test("every primary section has a route page that renders the approved prototype", () => {
    const prototypeSection = { people: "people", templates: "profiles", rules: "rules", history: "journal" };
    for (const item of PERMISSION_NAV) {
      const file = routeFileFor(item);
      expect(fs.existsSync(file)).toBe(true);
      const src = fs.readFileSync(file, "utf8");
      expect(src).toContain("PermissionPrototype");
      expect(src).toContain(`initialSection="${prototypeSection[item.key]}"`);
    }
  });

  test("the landed URL renders the approved permission-centre prototype", () => {
    const src = read("src/app/admin/security/permissions/page.js");
    expect(src).toContain("PermissionCenterLanding");
    expect(src).toContain("PermissionPrototype");
  });

  test("the retired Advanced door still forwards to the new homes", () => {
    const file = path.join(ROUTE_ROOT, "governance", "page.js");
    const src = fs.readFileSync(file, "utf8");
    // A pure forwarder: no shell, so this path can never render a navigation.
    expect(src).not.toContain("PermissionShell");
    for (const target of [
      "eligibility?sub=ceilings", // the catalog now lives under Rules
      "people?sub=jobs",
      "eligibility?sub=warnings",
      "context-scope?sub=memberships",
    ]) {
      expect(src).toContain(target);
    }
  });

  test("the profiles route is served by the approved prototype", () => {
    const src = read("src/app/admin/security/permissions/profiles/page.js");
    expect(src).toContain("PermissionPrototype");
    expect(src).toContain('initialSection="profiles"');
  });

  test("there is exactly one navigation: no legacy tab bar survives", () => {
    // The SURFACE, not the shim: this is an invariant about every screen in the
    // permission center. Pointing it at the shim would leave it vacuously green
    // the moment a tab bar moved into `permission-center/`.
    const src = readPermissionCenterSurface();
    expect(src).not.toContain("setActiveTab");
    expect(src).not.toContain("setSetupSection");
  });
});

describe("UI-1 — shell translations (en + fr parity)", () => {
  const allLabelKeys = PERMISSION_NAV.flatMap((item) => [
    item.labelKey,
    ...(item.tabs || []).map((tab) => tab.labelKey),
  ]);

  test.each(allLabelKeys)("%s resolves in English and French", (key) => {
    const english = resolveKey(EN, key);
    const french = resolveKey(FR, key);
    expect(typeof english).toBe("string");
    expect(typeof french).toBe("string");
    expect(english.length).toBeGreaterThan(0);
    expect(french.length).toBeGreaterThan(0);
  });
});

describe("UI-1 — overview governance math", () => {
  test("counts mapped roles and keeps unmapped ones as visible gaps", () => {
    const summary = summarizeContextRoles([
      { context: "program", role_key: "participant", profile_id: 2 },
      { context: "venture", role_key: "founder", profile_id: null },
      { context: "lms", role_key: "learner" },
    ]);
    expect(summary.total).toBe(3);
    expect(summary.mapped).toBe(1);
    expect(summary.gaps).toEqual([
      { context: "venture", role_key: "founder" },
      { context: "lms", role_key: "learner" },
    ]);
  });

  test("handles empty and malformed input without throwing", () => {
    expect(summarizeContextRoles()).toEqual({ total: 0, mapped: 0, gaps: [] });
    expect(summarizeContextRoles(null)).toEqual({ total: 0, mapped: 0, gaps: [] });
  });
});
