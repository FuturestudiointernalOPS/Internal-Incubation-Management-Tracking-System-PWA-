/**
 * PHASE UI-3 — follow-up contracts.
 *
 *  1. The pending-changes diff is truthful (adds, removals, no noise).
 *  2. Both review surfaces share ONE pending-changes presentation.
 *  3. Wide matrices ship a real card layout below md (no control or column
 *     silently hidden on small screens).
 *  4. Effects defer their first state write instead of writing synchronously
 *     during the commit (react-hooks/set-state-in-effect).
 */

const fs = require("fs");
const path = require("path");

const { diffCapabilities } = require("@/components/permissions/pendingChanges");

const EN = require("@/locales/en/engineering.json");
const FR = require("@/locales/fr/engineering.json");

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const resolveKey = (bundle, dotted) =>
  dotted.split(".").reduce((acc, part) => (acc == null ? undefined : acc[part]), bundle);

const PERMS = "src/components/permissions/";

describe("UI-3 — pending changes diff", () => {
  test("detects grants and revocations, ignores unchanged capabilities", () => {
    const saved = { contacts: { view: 1, edit: 3 }, ventures: { view: 1 } };
    const draft = { contacts: { view: 1, edit: 0 }, ventures: { view: 1, delete: 4 } };
    expect(diffCapabilities(saved, draft)).toEqual([
      { module: "contacts", capability: "edit", from: 3, to: 0, label: "contacts.edit" },
      { module: "ventures", capability: "delete", from: 0, to: 4, label: "ventures.delete" },
    ]);
  });

  test("an unchanged profile produces an empty list", () => {
    const caps = { lms: { view: 1, edit: 3 } };
    expect(diffCapabilities(caps, JSON.parse(JSON.stringify(caps)))).toEqual([]);
  });

  test("handles empty and malformed input without throwing", () => {
    expect(diffCapabilities()).toEqual([]);
    expect(diffCapabilities(null, {})).toEqual([]);
  });
});

describe("UI-3 — one pending-changes presentation", () => {
  test("the template editor uses the shared pending-changes list", () => {
    expect(read(`${PERMS}PermissionCenter.js`)).toContain("PendingChangesList");
    expect(read(`${PERMS}ui/PendingChangesList.js`)).toContain("pendingLevelOff");
  });

  test("the level labels exist in English and French", () => {
    for (const key of [
      "engineering.permissions.pendingLevelFull",
      "engineering.permissions.pendingLevelOff",
    ]) {
      expect(typeof resolveKey(EN, key)).toBe("string");
      expect(typeof resolveKey(FR, key)).toBe("string");
    }
  });
});

describe("UI-3 — card mode below md", () => {
  test("the people matrix renders cards on small screens", () => {
    const src = read(`${PERMS}PeopleView.js`);
    expect(src).toContain("hidden md:block");
    expect(src).toContain("md:hidden");
    // The effective result and the source layers must survive the card layout.
    expect(src).toContain("EffectiveBadge");
    expect(src).toContain("userMatrixRestriction");
  });

  test("the context-role registry renders cards on small screens", () => {
    const src = read(`${PERMS}ContextRolesView.js`);
    expect(src).toContain("hidden md:block");
    expect(src).toContain("md:hidden");
    // Every control stays available in the card layout.
    expect(src).toContain("contextRolesProfile");
    expect(src).toContain("contextRolesActive");
    expect(src).toContain("contextRolesNotes");
  });
});

describe("UI-3 — deferred effect writes", () => {
  test("mount loaders run through the deferred helper", () => {
    for (const file of [
      `${PERMS}PermissionShell.js`,
      `${PERMS}ContextRolesView.js`,
      `${PERMS}PeopleView.js`,
      `${PERMS}CatalogView.js`,
      `${PERMS}PermissionCenter.js`,
    ]) {
      expect(read(file)).toContain("effectUtils");
    }
  });
});
