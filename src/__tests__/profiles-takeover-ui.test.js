/**
 * Tranche 5 — the Profiles screen is the SINGLE Templates screen
 * (docs/PROFILES_TAKEOVER_MIGRATION.md).
 *
 * Locks the one-screen navigation and the active centre's writes: the catalogue
 * is dynamic (create / delete / edit capabilities), and the on-person profile
 * cards go through the assignment registry. The retired editor and rollup are
 * gone; this suite must not resurrect them by pinning their files.
 */

const fs = require("fs");
const path = require("path");

const EN = require("@/locales/en/engineering.json");
const FR = require("@/locales/fr/engineering.json");
const { PERMISSION_NAV } = require("@/components/permissions/permissionNav");
const { CENTER_TABS } = require("@/components/permissions/center/centerNav");

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const resolveKey = (bundle, dotted) =>
  dotted.split(".").reduce((acc, part) => (acc == null ? undefined : acc[part]), bundle);

const PERMS = "src/components/permissions/";
const SECTION = `${PERMS}center/sections/ProfilesSection.js`;
const CREATE = `${PERMS}center/drawers/CreateProfileDrawer.js`;
const FEATURE = `${PERMS}center/drawers/ProfileFeatureDrawer.js`;
const PERSON_PROFILES = `${PERMS}center/PersonProfiles.js`;
const PAGE = "src/app/admin/security/permissions/profiles/page.js";

test("the Profiles door carries the capability matrix and the context-role mapping", () => {
  const templates = PERMISSION_NAV.find((item) => item.key === "templates");
  expect(templates).toBeTruthy();
  expect(CENTER_TABS.profiles).toEqual(["matrix", "contextRoles"]);
});

test("the route renders the active centre, not a retired editor or rollup", () => {
  const src = read(PAGE);
  expect(src).toContain("PermissionCenter");
  expect(src).toContain('initialSection="profiles"');
  expect(src).not.toContain("PermissionManager");
  expect(src).not.toContain("EntitlementRollup");
});

test("the capability editor reads a profile by key and saves its capabilities", () => {
  expect(read(FEATURE)).toContain("/api/engineering/permissions/profiles");
  expect(read(FEATURE)).toContain("capabilities: draft");
});

test("the catalogue is dynamic: create and delete go through the API", () => {
  expect(read(CREATE)).toContain('method: "POST"');
  expect(read(SECTION)).toContain('method: "DELETE"');
});

test("the on-person profile cards go through the assignment registry", () => {
  const src = read(PERSON_PROFILES);
  expect(src).toContain("/api/engineering/permissions/profile-assignments?cid=");
  expect(src).toContain("/api/engineering/permissions/profile-assignments");
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
    "engineering.permissions.contextRolesContexts.global",
    "engineering.permissions.contextRolesContexts.staff",
  ]) {
    expect(typeof resolveKey(EN, key)).toBe("string");
    expect(typeof resolveKey(FR, key)).toBe("string");
  }
});
