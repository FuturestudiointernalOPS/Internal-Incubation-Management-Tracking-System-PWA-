/**
 * PHASE UI-1 — Permission Center shell contract.
 *
 * Locks the three things that silently rot in a redesigned admin area:
 *   1. Navigation ↔ routes: every nav item points at a real route page, and
 *      that page renders the shell with the matching `active` key.
 *   2. Navigation ↔ translations: every nav/sub-tab label resolves in BOTH
 *      English and French (no raw key leaking into the UI).
 *   3. Overview governance math stays honest (mapped vs. visible gaps).
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

const ROUTE_ROOT = path.join(process.cwd(), "src/app/admin/security/permissions");

const resolveKey = (bundle, dotted) =>
  dotted
    .split(".")
    .reduce((acc, part) => (acc == null ? undefined : acc[part]), bundle);

const routeFileFor = (navItem) => {
  const segment = routeSegmentFor(navItem);
  return path.join(ROUTE_ROOT, segment, "page.js");
};

describe("UI-1 — navigation model", () => {
  test("keys and hrefs are unique and live under the Permission Center base", () => {
    const keys = PERMISSION_NAV.map((n) => n.key);
    const hrefs = PERMISSION_NAV.map((n) => n.href);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const href of hrefs) expect(href.startsWith(PERMISSION_BASE)).toBe(true);
  });

  test("sub-tabs are unique per item and defaultSub points at a real tab", () => {
    for (const item of PERMISSION_NAV) {
      if (!item.tabs) continue;
      const tabKeys = item.tabs.map((tb) => tb.key);
      expect(new Set(tabKeys).size).toBe(tabKeys.length);
      expect(tabKeys).toContain(item.defaultSub);
    }
  });

  test("every nav item has a route page that renders the shell with the matching key", () => {
    for (const item of PERMISSION_NAV) {
      const file = routeFileFor(item);
      expect(fs.existsSync(file)).toBe(true);
      const src = fs.readFileSync(file, "utf8");
      expect(src).toContain("PermissionShell");
      expect(src).toContain(`active="${item.key}"`);
    }
  });

  test("the retired Advanced door forwards to the screens' new homes", () => {
    const file = path.join(ROUTE_ROOT, "governance", "page.js");
    const src = fs.readFileSync(file, "utf8");
    // A pure forwarder: no shell, so this path can never render a second
    // navigation for the same screen.
    expect(src).not.toContain("PermissionShell");
    for (const target of [
      "profiles?sub=catalog",
      "people?sub=jobs",
      "eligibility?sub=warnings",
      "context-scope?sub=memberships",
    ]) {
      expect(src).toContain(target);
    }
  });

  test("every relocation target is a real sub-tab of a nav item", () => {
    const subs = new Map(
      PERMISSION_NAV.map((n) => [n.key, (n.tabs || []).map((tb) => tb.key)]),
    );
    expect(subs.get("profiles")).toContain("catalog");
    expect(subs.get("people")).toContain("jobs");
    expect(subs.get("eligibility")).toContain("warnings");
    expect(subs.get("context")).toContain("memberships");
  });

  test("there is exactly one navigation: no legacy tab bar survives", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/components/permissions/PermissionCenter.js"),
      "utf8",
    );
    expect(src).not.toContain("setActiveTab");
    expect(src).not.toContain("setSetupSection");
    expect(src).not.toContain("tabAccessSetup");
  });

  test("primary order follows the admin cascade", () => {
    expect(PERMISSION_NAV.map((n) => n.key)).toEqual([
      "overview",
      "eligibility",
      "profiles",
      "people",
      "context",
      "audit",
    ]);
  });
});

describe("UI-1 — shell translations (en + fr parity)", () => {
  const allLabelKeys = PERMISSION_NAV.flatMap((item) => [
    item.labelKey,
    ...(item.tabs || []).map((tb) => tb.labelKey),
  ]);

  test.each(allLabelKeys)("%s resolves in English and French", (key) => {
    const en = resolveKey(EN, key);
    const fr = resolveKey(FR, key);
    expect(typeof en).toBe("string");
    expect(typeof fr).toBe("string");
    expect(en.length).toBeGreaterThan(0);
    expect(fr.length).toBeGreaterThan(0);
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
