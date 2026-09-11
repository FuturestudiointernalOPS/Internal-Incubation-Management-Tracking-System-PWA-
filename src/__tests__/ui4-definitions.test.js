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

  test("the 'Default for' control replaces the retired Role → Profile grid", () => {
    // The same guarantee the grid carried: every stored role default is visible
    // on the template that receives it, including names outside the identity
    // list (selectedIsDefaultFor is read from the unfiltered map).
    expect(src).toContain("defaultForTitle");
    expect(src).toContain("assignRoleDefault");
    expect(src).toContain("/api/access-profiles/role-defaults");
    expect(src).toContain("selectedIsDefaultFor");
  });
});

describe("UI-4b — the tabs say what they map", () => {
  const keys = [
    "engineering.permissions.navPeople",
    "engineering.permissions.navTemplates",
    "engineering.permissions.navRules",
    "engineering.permissions.navWhereItApplies",
    "engineering.permissions.navHistory",
    "engineering.permissions.questionPeople",
    "engineering.permissions.questionTemplates",
    "engineering.permissions.questionRules",
    "engineering.permissions.questionWhere",
    "engineering.permissions.questionHistory",
    "engineering.permissions.catalogUnavailable",
  ];

  test.each(keys)("%s exists in English and French", (key) => {
    expect(typeof resolveKey(EN, key)).toBe("string");
    expect(typeof resolveKey(FR, key)).toBe("string");
  });

  test("the five tab labels are distinguishable at a glance", () => {
    const labels = keys.slice(0, 5).map((key) => resolveKey(EN, key));
    expect(new Set(labels).size).toBe(labels.length);
  });
});
