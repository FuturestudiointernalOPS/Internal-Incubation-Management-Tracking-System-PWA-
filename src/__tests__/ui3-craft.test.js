/**
 * PHASE UI-3b — craft pass contracts (accessibility + i18n of the shell).
 *
 * These are source-level contracts on purpose: they are the things that
 * silently regress when new screens are added to the Permission Centre.
 */

const fs = require("fs");
const path = require("path");

const EN = require("@/locales/en/engineering.json");
const FR = require("@/locales/fr/engineering.json");

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const resolveKey = (bundle, dotted) =>
  dotted.split(".").reduce((acc, part) => (acc == null ? undefined : acc[part]), bundle);

const SHELL = "src/components/permissions/PermissionCenter.js";
const UI = "src/components/permissions/center/centerUi.js";
const SECTIONS = "src/components/permissions/center/sections";

const sectionFiles = fs
  .readdirSync(path.join(process.cwd(), SECTIONS))
  .filter((name) => name.endsWith(".js"))
  .map((name) => `${SECTIONS}/${name}`);

describe("UI-3b — shell accessibility", () => {
  test("the active route is announced and the tab set has roles", () => {
    const shell = read(SHELL);
    expect(shell).toContain('aria-current={active ? "page" : undefined}');
    expect(shell).toContain("shellNavAria");

    const ui = read(UI);
    expect(ui).toContain('role="tablist"');
    expect(ui).toContain('role="tab"');
    expect(ui).toContain("aria-selected={active}");
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
  test("every screen with a focusable control has a visible focus ring", () => {
    for (const relativePath of [SHELL, UI, ...sectionFiles]) {
      const src = read(relativePath);
      // A read-only table has nothing to focus; the rule applies as soon as
      // the screen renders a control.
      if (!/<(button|input|select|textarea|a)\b/.test(src)) continue;
      expect(src).toContain("focus-visible:ring-2");
    }
  });

  test("shared labels exist in English and French", () => {
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
