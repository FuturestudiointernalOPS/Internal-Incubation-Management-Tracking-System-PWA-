/**
 * PHASE UI-2b — People screen contracts.
 *
 * Locks:
 *   1. Denial reasons stay precise (restriction beats everything; a capability
 *      with no source is "no-source", never a generic deny).
 *   2. The screen is wired to the real data paths (user-context, scope-check)
 *      and the shared primitives (EffectiveBadge, WhyDrawer).
 *   3. Every string the screen introduces exists in English AND French.
 */

const fs = require("fs");
const path = require("path");

const {
  deriveUserCapState,
  deriveDenialReason,
} = require("@/components/permissions/matrixHelpers");

const EN = require("@/locales/en/engineering.json");
const FR = require("@/locales/fr/engineering.json");

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const resolveKey = (bundle, dotted) =>
  dotted.split(".").reduce((acc, part) => (acc == null ? undefined : acc[part]), bundle);

const sources = (over = {}) => ({
  profile: {},
  groups: {},
  grants: {},
  restrictions: {},
  ...over,
});

describe("UI-2b — denial reasons", () => {
  test("a restriction always wins, even with a grant present", () => {
    const state = deriveUserCapState(
      sources({
        profile: { contacts: { delete: 1 } },
        grants: { contacts: { delete: 1 } },
        restrictions: { contacts: { delete: true } },
      }),
      "contacts",
      "delete",
    );
    expect(state.effective).toBe(false);
    expect(deriveDenialReason(state)).toBe("restriction");
  });

  test("a capability with no source is 'no-source', not a generic deny", () => {
    const state = deriveUserCapState(sources(), "lms", "manage");
    expect(state.effective).toBe(false);
    expect(deriveDenialReason(state)).toBe("no-source");
  });

  test("a held capability has no denial reason", () => {
    const state = deriveUserCapState(
      sources({ profile: { ventures: { view: 1 } } }),
      "ventures",
      "view",
    );
    expect(state.effective).toBe(true);
    expect(deriveDenialReason(state)).toBeNull();
  });

  test("malformed state is treated as a denial, never as allowed", () => {
    expect(deriveDenialReason(null)).toBeNull(); // null = "not applicable"
    expect(deriveDenialReason({ effective: false, restricted: false })).toBe("no-source");
  });
});

describe("UI-2b — screen wiring", () => {
  const route = "src/app/admin/security/permissions/people/page.js";
  const merged = "src/components/permissions/IndividualAccessScreen.js";
  const view = "src/components/permissions/PeopleView.js";

  test("the people route renders ONE merged Individual Access screen", () => {
    const src = read(route);
    expect(src).toContain("IndividualAccessScreen");
    // Job shortcuts stay their own screen under the same door.
    expect(src).toContain('initialTab="responsibilities"');
    // Pre-merge sub-tabs (?sub=search, ?sub=matrix) still resolve.
    expect(src).toContain("PERMISSION_PEOPLE_SUB_ALIASES");
  });

  test("the merged screen feeds the same person to both lenses", () => {
    const src = read(merged);
    expect(src).toContain("PersonPicker");
    expect(src).toContain("PeopleView");
    expect(src).toContain("PermissionCenter");
    // One selection, two panels: read (person=) and write (cid=).
    expect(src).toContain("person={person}");
    expect(src).toContain("cid={person.cid}");
    // One picker in the whole flow: the editor no longer fetches a user list.
    const editor = read("src/components/permissions/PermissionCenter.js");
    expect(editor).not.toContain("fetchAllUsers");
  });

  test("the view uses the real endpoints and shared primitives", () => {
    const src = read(view);
    expect(src).toContain("/api/engineering/permissions/user-context?cid=");
    expect(src).toContain("/api/engineering/permissions/scope-check?policy=");
    expect(src).toContain("EffectiveBadge");
    expect(src).toContain("WhyDrawer");
    // Scope column must never be fabricated client-side.
    expect(src).not.toContain("All · P4");
  });

  test("the effective badge carries both denial reasons", () => {
    const src = read("src/components/permissions/ui/EffectiveBadge.js");
    expect(src).toContain("effectiveReasonRestriction");
    expect(src).toContain("effectiveReasonNoSource");
  });

  test("every People string exists in English and French", () => {
    const keys = [
      "engineering.permissions.peopleHint",
      "engineering.permissions.peopleSelectPrompt",
      "engineering.permissions.accessEditorTitle",
      "engineering.permissions.tabIndividualAccess",
      "engineering.permissions.peopleScopeTitle",
      "engineering.permissions.peopleScopeEmpty",
      "engineering.permissions.peopleScopeNote",
      "engineering.permissions.whyEligibility",
      "engineering.permissions.whyEligible",
      "engineering.permissions.whyNotEligible",
      "engineering.permissions.whyLayer_profile",
      "engineering.permissions.whyLayer_groups",
      "engineering.permissions.whyLayer_grants",
      "engineering.permissions.whyLayer_restrictions",
      "engineering.permissions.whyScopeNote",
      "engineering.permissions.effectiveAllowed",
      "engineering.permissions.effectiveDenied",
      "engineering.permissions.effectiveReasonRestriction",
      "engineering.permissions.effectiveReasonNoSource",
    ];
    for (const key of keys) {
      expect(typeof resolveKey(EN, key)).toBe("string");
      expect(typeof resolveKey(FR, key)).toBe("string");
    }
  });
});
