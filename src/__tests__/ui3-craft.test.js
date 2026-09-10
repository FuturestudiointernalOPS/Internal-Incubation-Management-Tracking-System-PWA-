/**
 * PHASE UI-3b — craft pass contracts (accessibility + i18n of the shell).
 *
 * These are source-level contracts on purpose: they are the things that
 * silently regress when new screens are added to the Permission Center.
 */

const fs = require("fs");
const path = require("path");

const EN = require("@/locales/en/engineering.json");
const FR = require("@/locales/fr/engineering.json");

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const resolveKey = (bundle, dotted) =>
  dotted.split(".").reduce((acc, part) => (acc == null ? undefined : acc[part]), bundle);

const SHELL = "src/components/permissions/PermissionShell.js";
const PEOPLE = "src/components/permissions/PeopleView.js";
const DRAWER = "src/components/permissions/ui/WhyDrawer.js";
const LIVE = "src/components/permissions/LiveCheckPanel.js";
const CONTEXT = "src/components/permissions/ContextRolesView.js";
const OVERVIEW = "src/components/permissions/OverviewView.js";

describe("UI-3b — shell accessibility", () => {
  test("the active route is announced and the tab set has roles", () => {
    const src = read(SHELL);
    expect(src).toContain('aria-current={isActive ? "page" : undefined}');
    expect(src).toContain('role="tablist"');
    expect(src).toContain('role="tab"');
    expect(src).toContain("aria-selected={isActive}");
    expect(src).toContain("shellNavAria");
  });

  test("the shell's aria labels exist in English and French", () => {
    for (const key of [
      "engineering.permissions.shellNavAria",
      "engineering.permissions.shellSubTabsAria",
      "engineering.permissions.shellBreadcrumbAria",
    ]) {
      expect(typeof resolveKey(EN, key)).toBe("string");
      expect(typeof resolveKey(FR, key)).toBe("string");
    }
  });
});

describe("UI-3b — keyboard and screen-reader support", () => {
  test("matrix rows are keyboard-operable and labelled", () => {
    const src = read(PEOPLE);
    expect(src).toContain("tabIndex={0}");
    expect(src).toContain('e.key === "Enter"');
    expect(src).toContain('role="region"');
    expect(src).toContain("peopleRowAria");
  });

  test("the why drawer's close control is translated (no hardcoded English)", () => {
    const src = read(DRAWER);
    expect(src).toContain("whyClose");
    expect(src).not.toContain('aria-label="close"');
  });

  test("every focusable control in the new screens has a visible focus ring", () => {
    for (const rel of [SHELL, PEOPLE, LIVE, CONTEXT, OVERVIEW]) {
      expect(read(rel)).toContain("focus-visible:ring-2");
    }
  });

  test("people row/table labels exist in English and French", () => {
    for (const key of [
      "engineering.permissions.peopleRowAria",
      "engineering.permissions.peopleTableAria",
      "engineering.permissions.whyClose",
    ]) {
      expect(typeof resolveKey(EN, key)).toBe("string");
      expect(typeof resolveKey(FR, key)).toBe("string");
    }
  });
});
