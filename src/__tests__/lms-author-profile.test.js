/**
 * DELEGATED LMS AUTHORING — the `lms_author` profile.
 *
 * Product decision: a Program Manager may NOT publish courses, and the
 * `course_manager` profile keeps its manage-only bundle (D6: `lms.view` +
 * `lms.edit`, no create). What the studio asked for instead is a dedicated,
 * per-person right to CREATE and PUBLISH courses, assignable from the
 * permission screens.
 *
 * This suite locks:
 *   - the profile exists, staff-only, carrying view + create + edit;
 *   - it is in the assignable catalogue and aligns to the staff baseline;
 *   - the LMS feature ceiling admits it (a profile grant is inert without it);
 *   - the one-time migration writes it on databases seeded before it existed;
 *   - `course_manager` is unchanged and no Program Manager holds LMS writes;
 *   - both locales carry the label.
 *
 * Pure: no database, no network.
 */

const fs = require("node:fs");
const path = require("node:path");

const {
  PROFILE_CATALOGUE_SEED,
} = require("@/models/authorization/profileCatalogueSeed");
const {
  PROFILE_CATALOG,
  isValidProfileKey,
  baselineRoleForProfile,
} = require("@/models/authorization/profile-catalog");
const {
  FEATURE_ELIGIBILITY_PROFILE_DEFAULTS,
} = require("@/models/authorization/constants/eligibility-defaults");

const LMS_AUTHOR = "lms_author";
const ROOT = path.join(__dirname, "..", "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const seedEntry = PROFILE_CATALOGUE_SEED.find((def) => def.key === LMS_AUTHOR);

describe("the delegated LMS author profile", () => {
  test("is seeded staff-only, with view + create + edit", () => {
    expect(seedEntry).toBeTruthy();
    expect(seedEntry.allowedRoles).toEqual(["staff"]);
    expect(seedEntry.context).toBe("staff");
    expect(seedEntry.label).toBe("LMS Author");
    expect(seedEntry.capabilities.lms).toEqual({ view: 1, create: 2, edit: 3 });
  });

  test("is in the assignable catalogue and aligns to the staff baseline", () => {
    expect(PROFILE_CATALOG.some((profile) => profile.key === LMS_AUTHOR)).toBe(true);
    expect(isValidProfileKey(LMS_AUTHOR)).toBe(true);
    expect(baselineRoleForProfile(LMS_AUTHOR)).toBe("staff");
  });

  test("the LMS feature ceiling admits the profile", () => {
    // Eligibility is checked BEFORE the capability and fails closed: without
    // this row the profile's grants would be inert on a database that never
    // re-runs the eligibility seed.
    expect(FEATURE_ELIGIBILITY_PROFILE_DEFAULTS.lms).toContain(LMS_AUTHOR);
  });

  test("a one-time migration seeds it on existing databases", () => {
    const seed = read("src/models/authorization/profileCatalogueSeed.js");
    expect(seed).toMatch(/ensureLmsAuthorProfileSeed/);
    expect(seed).toMatch(/VALUES \('lms', 'profile', 'lms_author', 1\)/);
    expect(seed).toMatch(/ON CONFLICT[\s\S]{0,80}DO NOTHING/);
    expect(read("src/models/authorization/backfill.js")).toMatch(
      /lms-author-profile-seed-v1/,
    );
  });
});

describe("the decisions around it hold", () => {
  test("course_manager keeps its manage-only bundle (D6, unchanged)", () => {
    const courseManager = PROFILE_CATALOGUE_SEED.find(
      (def) => def.key === "course_manager",
    );
    expect(courseManager).toBeTruthy();
    expect(courseManager.capabilities.lms).toEqual({ view: 1, edit: 3 });
    expect(courseManager.capabilities.lms.create).toBeUndefined();
  });

  test("no Program Manager profile carries an LMS write", () => {
    // Product decision: a PM may not publish courses. The profile is
    // program-only; LMS is deliberately absent from it.
    const pm = PROFILE_CATALOGUE_SEED.find((def) => def.key === "program_manager");
    expect(pm).toBeTruthy();
    expect(pm.capabilities.lms).toBeUndefined();
  });
});

describe("both locales carry the label", () => {
  test("en and fr define profileLmsAuthor", () => {
    for (const lang of ["en", "fr"]) {
      const locale = JSON.parse(read(`src/locales/${lang}/engineering.json`));
      expect(
        locale.engineering.permissions.profileLmsAuthor,
      ).toBeTruthy();
    }
  });
});
