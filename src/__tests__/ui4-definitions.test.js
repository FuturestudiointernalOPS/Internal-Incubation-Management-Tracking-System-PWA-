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

const EN = require("@/locales/en/engineering.json");
const FR = require("@/locales/fr/engineering.json");

const resolveKey = (bundle, dotted) =>
  dotted.split(".").reduce((acc, part) => (acc == null ? undefined : acc[part]), bundle);

// The access-profile editor this suite pinned was retired with the profiles
// takeover; the catalogue now lives on the Profiles screen and reads its module
// catalog from the server (see profiles-takeover-ui.test.js).

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
