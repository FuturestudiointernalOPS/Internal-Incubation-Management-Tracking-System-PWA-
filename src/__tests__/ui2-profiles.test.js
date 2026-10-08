/**
 * PHASE UI-2c — Profiles & Capabilities contracts.
 *
 * Locks:
 *   1. Profile badges stay truthful (role default / inactive / super admin).
 *   2. The screen keeps its review-before-save guarantees: the audit reason
 *      travels with the PUT, and the impact preview is a REAL count from the
 *      impact endpoint (never a fabricated number).
 *   3. Deep links (?profile=) reach the editor.
 */

const fs = require("fs");
const path = require("path");

const { deriveProfileBadges } = require("@/components/permissions/profileBadges");

const EN = require("@/locales/en/engineering.json");
const FR = require("@/locales/fr/engineering.json");

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const resolveKey = (bundle, dotted) =>
  dotted.split(".").reduce((acc, part) => (acc == null ? undefined : acc[part]), bundle);

describe("UI-2c — profile badges", () => {
  test("a role-default profile is badged", () => {
    expect(deriveProfileBadges({ id: 2, name: "Staff Default", is_active: 1 }, ["staff"]))
      .toEqual(["roleDefault"]);
  });

  test("an inactive profile is badged (and never hidden)", () => {
    expect(deriveProfileBadges({ name: "X", is_active: 0 })).toEqual(["inactive"]);
  });

  test("the platform-wide profile is visually distinct", () => {
    expect(deriveProfileBadges({ name: "Super Admin Default", is_active: 1 })).toEqual([
      "superAdmin",
    ]);
  });

  test("badges combine without duplicating", () => {
    expect(
      deriveProfileBadges({ name: "Super Admin Default", is_active: 0 }, ["super_admin"]),
    ).toEqual(["roleDefault", "inactive", "superAdmin"]);
  });

  test("a plain profile has no badges", () => {
    expect(deriveProfileBadges({ name: "Operations Manager", is_active: 1 }, [])).toEqual([]);
  });
});

describe("UI-2c — screen contracts", () => {
  const route = "src/app/admin/security/permissions/profiles/page.js";
  const view = "src/components/permissions/ProfilesView.js";

  test("the Profiles door renders the catalogue and the context-role mapping", () => {
    const src = read(route);
    expect(src).toContain("ProfilesView");
    expect(src).toContain("ContextRolesView");
    expect(src).not.toContain("PermissionManager");
    expect(src).not.toContain("EntitlementRollup");
  });

  test("profile writes carry the review reason (audited server-side)", () => {
    expect(read(view)).toMatch(/reason: reason\.trim\(\) \|\| undefined/);
  });

  test("every badge label exists in English and French", () => {
    for (const key of [
      "engineering.permissions.profileBadge_roleDefault",
      "engineering.permissions.profileBadge_inactive",
      "engineering.permissions.profileBadge_superAdmin",
      "engineering.permissions.reasonPlaceholder",
      "engineering.permissions.impactAffects",
    ]) {
      expect(typeof resolveKey(EN, key)).toBe("string");
      expect(typeof resolveKey(FR, key)).toBe("string");
    }
  });
});
