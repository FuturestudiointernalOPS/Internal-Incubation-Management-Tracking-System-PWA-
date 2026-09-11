/**
 * PHASE UI-4b — one definition of every feature.
 *
 * Locks the third class of defect the intern report surfaced:
 *   • the access-profile editor served itself a locally hardcoded 11-module
 *     copy of an 18-module catalog, through a `window` global — so the same
 *     feature had different names and different coverage depending on which
 *     screen you were on;
 *   • the Role → Profile grid only listed the eligibility identities, so a
 *     stored default for any other name (developer, teacher, program_manager)
 *     was configured, stored and never shown.
 */

const fs = require("fs");
const path = require("path");

const { roleDefaultRows } = require("@/components/permissions/matrixHelpers");

const EN = require("@/locales/en/engineering.json");
const FR = require("@/locales/fr/engineering.json");

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const resolveKey = (bundle, dotted) =>
  dotted.split(".").reduce((acc, part) => (acc == null ? undefined : acc[part]), bundle);

const CENTER = "src/components/permissions/PermissionCenter.js";

describe("UI-4b — the editor reads the server catalog", () => {
  const src = read(CENTER);

  test("no local copy of the module catalog survives", () => {
    // The global that fed the fallback is gone…
    expect(src).not.toContain("window.availableModules");
    // …and so is the literal it fell back to.
    expect(src).not.toContain('capabilities: ["view", "create", "edit", "delete", "archive"]');
    expect(src).not.toContain('name: "Internal Communication"');
  });

  test("the catalog comes from the response, and a failure is stated", () => {
    expect(src).toContain("setModuleCatalog(data.modules || {})");
    expect(src).toContain("const availableModules = moduleCatalog || {};");
    // A missing catalog must not masquerade as "this profile has no features".
    expect(src).toContain("catalogUnavailable");
    expect(src).toContain("moduleCatalog && visibleModules.length === 0");
  });

  test("the Role → Profile grid shows stored defaults outside the identity list", () => {
    expect(src).toContain("roleDefaultRows(");
    expect(src).toContain("roleDefaultsNotIdentity");
  });
});

describe("UI-4b — roleDefaultRows", () => {
  test("identities keep their order, extras follow alphabetically", () => {
    const rows = roleDefaultRows(
      ["super_admin", "staff", "member"],
      { member: 1, teacher: 2, developer: 3, admin: 4 },
    );
    expect(rows).toEqual([
      { name: "super_admin", isIdentity: true },
      { name: "staff", isIdentity: true },
      { name: "member", isIdentity: true },
      { name: "admin", isIdentity: false },
      { name: "developer", isIdentity: false },
      { name: "teacher", isIdentity: false },
    ]);
  });

  test("an identity with a default is not duplicated as an extra", () => {
    const rows = roleDefaultRows(["staff"], { staff: 7 });
    expect(rows).toEqual([{ name: "staff", isIdentity: true }]);
  });

  test("nothing configured means nothing extra is invented", () => {
    expect(roleDefaultRows(["staff"], {})).toEqual([{ name: "staff", isIdentity: true }]);
  });

  test("empty and malformed input is safe", () => {
    expect(roleDefaultRows()).toEqual([]);
    expect(roleDefaultRows(null, null)).toEqual([]);
    expect(roleDefaultRows(undefined, { teacher: 1 })).toEqual([
      { name: "teacher", isIdentity: false },
    ]);
  });
});

describe("UI-4b — the tabs say what they map", () => {
  const keys = [
    "engineering.permissions.tabAccessProfiles",
    "engineering.permissions.tabRoleDefaults",
    "engineering.permissions.tabDefaultsMatrix",
    "engineering.permissions.tabCatalog",
    "engineering.permissions.roleDefaultsNotIdentity",
    "engineering.permissions.catalogUnavailable",
  ];

  test.each(keys)("%s exists in English and French", (key) => {
    expect(typeof resolveKey(EN, key)).toBe("string");
    expect(typeof resolveKey(FR, key)).toBe("string");
  });

  test("the four profile tabs are distinguishable at a glance", () => {
    const label = (key) => resolveKey(EN, key);
    const labels = [
      "engineering.permissions.tabAccessProfiles",
      "engineering.permissions.tabRoleDefaults",
      "engineering.permissions.tabDefaultsMatrix",
      "engineering.permissions.tabCatalog",
    ].map(label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
