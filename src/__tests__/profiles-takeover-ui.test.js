/**
 * Tranche 5 — the Profiles screen is the SINGLE Templates screen
 * (docs/PROFILES_TAKEOVER_MIGRATION.md).
 *
 * Locks the retirement of the "Access profiles" sub-tab and the rollup, the
 * one-screen navigation, and that the extracted markup islands stay wired to the
 * panel (a name that stops reaching a block would be invisible to a type check).
 */

const fs = require("fs");
const path = require("path");

const EN = require("@/locales/en/engineering.json");
const FR = require("@/locales/fr/engineering.json");
const { PERMISSION_NAV } = require("@/components/permissions/permissionNav");
const { PROTOTYPE_TABS } = require("@/components/permissions/prototype/prototypeNav");

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const resolveKey = (bundle, dotted) =>
  dotted.split(".").reduce((acc, part) => (acc == null ? undefined : acc[part]), bundle);

const PERMS = "src/components/permissions/";
const VIEW = `${PERMS}ProfilesView.js`;
const PAGE = "src/app/admin/security/permissions/profiles/page.js";

test("the Profiles door carries the capability matrix and the context-role mapping", () => {
  const templates = PERMISSION_NAV.find((item) => item.key === "templates");
  expect(templates).toBeTruthy();
  // The door's tabs live in the approved prototype: matrix first, then the
  // contextual role → profile mapping.
  expect(PROTOTYPE_TABS.profiles).toEqual(["matrix", "contextRoles"]);
});

test("the route renders the approved prototype, not the retired editor or rollup", () => {
  const src = read(PAGE);
  expect(src).toContain("PermissionPrototype");
  expect(src).toContain('initialSection="profiles"');
  expect(src).not.toContain("PermissionManager");
  expect(src).not.toContain("EntitlementRollup");
});

test("the panel composes the three extracted blocks", () => {
  const src = read(VIEW);
  for (const block of ["ProfileCatalogue", "ProfileCreateForm", "ProfileCapabilityEditor"]) {
    expect(src).toContain(block);
  }
});

test("the capability editor reads a profile by key and saves its capabilities", () => {
  const src = read(VIEW);
  // Read one profile with its capabilities.
  expect(src).toContain("/api/engineering/permissions/profiles?key=");
  // Write the whole capability set.
  expect(src).toContain("capabilities: draftCaps");
});

test("the catalogue is dynamic: create and delete go through the API", () => {
  const src = read(VIEW);
  expect(src).toContain('method: "POST"');
  expect(src).toContain('method: "DELETE"');
});

test("B1 — the screen can set a role's default profile", () => {
  const src = read(VIEW);
  expect(src).toContain("/api/engineering/permissions/profile-role-defaults");
  expect(read(`${PERMS}profiles-view/ProfileCapabilityEditor.js`)).toContain("defaultForTitle");
});

test("A1 — the on-person override goes through the profile key", () => {
  const src = read(`${PERMS}permission-center/PersonAccessScreen.js`);
  expect(src).toContain("/api/engineering/permissions/profile-override");
  expect(src).toContain("profile_key: profileKey || null");
});

test("every new string exists in English and French", () => {
  for (const key of [
    "engineering.permissions.profilesCreateToggle",
    "engineering.permissions.profilesCreateTitle",
    "engineering.permissions.profilesCreateKey",
    "engineering.permissions.profilesCreateLabel",
    "engineering.permissions.profilesCreateContext",
    "engineering.permissions.profilesCreateSubmit",
    "engineering.permissions.profileCreated",
    "engineering.permissions.profileCreateFailed",
    "engineering.permissions.profilesDeleteTitle",
    "engineering.permissions.profilesDeleteConfirm",
    "engineering.permissions.profileDeleted",
    "engineering.permissions.profileDeleteFailed",
    "engineering.permissions.profilesCapabilitiesTitle",
    "engineering.permissions.profilesCapabilitiesHint",
    "engineering.permissions.profilesCapsSave",
    "engineering.permissions.profilesCapsSaved",
    "engineering.permissions.profilesEditCapabilities",
    "engineering.permissions.roleDefaultSaved",
    "engineering.permissions.roleDefaultFailed",
    // The two contexts the takeover conversion introduces.
    "engineering.permissions.contextRolesContexts.global",
    "engineering.permissions.contextRolesContexts.staff",
  ]) {
    expect(typeof resolveKey(EN, key)).toBe("string");
    expect(typeof resolveKey(FR, key)).toBe("string");
  }
});
