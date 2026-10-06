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

const { readPermissionCenterSurface } = require("./helpers/permissionCenterSource");
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
  // Pinned to the file that owns the behaviour: the editor moved out of the
  // shim, so reading the shim would pass vacuously. It then split in two — the
  // panel keeps the state, the effects and the loaders, the writes and the
  // markup moved under `profiles/` — so an assertion about a write reads the
  // surface (every module, so duplicating it elsewhere still fails) and an
  // assertion about the panel's own effect reads the panel.
  const center = "src/components/permissions/permission-center/AccessProfilesView.js";
  const surface = readPermissionCenterSurface();

  test("the Templates door renders ONE screen: the profile catalogue", () => {
    const src = read(route);
    expect(src).toContain("ProfilesView");
    // The Access-profiles editor sub-tab and the role/group rollup were retired
    // (profiles takeover) — the profile IS the capability set now.
    expect(src).not.toContain("PermissionManager");
    expect(src).not.toContain("EntitlementRollup");
  });

  test("the editor preselection never auto-selects without a requested id", () => {
    const src = read(center);
    expect(src).toContain("initialProfileId");
    expect(src).toContain("if (!initialProfileId) return;");
  });

  test("profile writes carry the review reason (audited server-side)", () => {
    // the write lives in the save factory now, not in the panel
    expect(surface).toMatch(/reason: reason\.trim\(\) \|\| undefined/);
  });

  test("the impact preview comes from the real impact endpoint", () => {
    // the request is the panel's effect; the count it feeds is the detail block's
    expect(read(center)).toContain("/api/engineering/permissions/impact?profile_id=");
    expect(surface).toContain("impactAffects");
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
