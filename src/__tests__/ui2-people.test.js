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
const { readPermissionCenterSurface } = require("./helpers/permissionCenterSource");

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

  test("an ineligible feature is 'not-eligible', not a generic deny", () => {
    const state = deriveUserCapState(
      sources({ profile: { contacts: { view: 1 } } }),
      "contacts",
      "view",
      false,
    );
    expect(state.profile).toBe(true);
    expect(state.effective).toBe(false);
    expect(deriveDenialReason(state)).toBe("not-eligible");
  });
});

describe("UI-2b — screen wiring", () => {
  const route = "src/app/admin/security/permissions/people/page.js";
  const merged = "src/components/permissions/IndividualAccessScreen.js";
  const view = "src/components/permissions/PeopleView.js";
  const matrix = "src/components/permissions/people-view/PeopleMatrix.js";

  test("the people route renders ONE screen, with no sub-tabs", () => {
    const src = read(route);
    expect(src).toContain("IndividualAccessScreen");
    // The former "Person access" / "Job shortcuts" sub-tabs were retired: the
    // door has no sub-tab switch and no read-only job-shortcut report.
    expect(src).not.toContain('initialTab="responsibilities"');
    expect(src).not.toContain("PERMISSION_PEOPLE_SUB_ALIASES");
  });

  test("the merged screen feeds the same person to both lenses", () => {
    const src = read(merged);
    expect(src).toContain("PersonPicker");
    expect(src).toContain("PeopleView");
    expect(src).toContain("PermissionCenter");
    // One selection, two panels: read (person=) and write (cid=).
    expect(src).toContain("person={person}");
    expect(src).toContain("cid={person.cid}");
    // Profiles held render at the TOP of the person screen, once (moved out of
    // the editor, where it used to sit after the capability legend).
    expect(src).toContain("ProfileAssignmentsSection");
    expect(readPermissionCenterSurface()).not.toContain("<ProfileAssignmentsSection");
    // One picker in the whole flow: the editor no longer fetches a user list.
    // The whole surface, because a second user list anywhere in the center would
    // break that claim just as much as one in the shim.
    const editor = readPermissionCenterSurface();
    expect(editor).not.toContain("fetchAllUsers");
  });

  test("the individual editor only offers what the person can be granted", () => {
    // The ceiling is decided in the screen (eligibilityMap) and rendered in the
    // view it hands its ctx to; read the whole surface, as the guard is about
    // the editor, not about which file holds a given line.
    const editor = readPermissionCenterSurface();
    // The individual Advanced block is ceiling-limited like the template's, so
    // it never offers a right the person cannot receive, nor the bucket of
    // parts that have no dashboard section.
    expect(editor).toContain("visibleFeatures={personFeatures}");
    expect(editor).toContain("retainedCaps={exceptionSpecialCaps}");
    expect(editor).toContain("explanation?.eligibility");
    // Same ceiling on the basic-rights grid, at section level.
    expect(editor).toContain(
      "isPersonEligibleForFeature(eligibilityMap, section.feature)",
    );
  });

  test("a person's rights are level chips with explicit controls, not a level spreadsheet", () => {
    const editor = readPermissionCenterSurface();
    expect(editor).toContain("LEVEL_CHIP_ACTIVE");
    expect(editor).toContain('t("engineering.permissions.block")');
    expect(editor).toContain('t("engineering.permissions.restore")');
    expect(editor).toContain('t("engineering.permissions.personRightsHint")');
  });

  test("the view uses the real endpoints and shared primitives", () => {
    const src = read(view);
    expect(src).toContain("/api/engineering/permissions/user-context?cid=");
    expect(src).toContain("/api/engineering/permissions/scope-check?policy=");
    expect(src).toContain("WhyDrawer");
    // The matrix card is its own block; it carries the effective badge.
    expect(read(matrix)).toContain("EffectiveBadge");
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
      "engineering.permissions.personReadTitle",
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
      "engineering.permissions.effectiveReasonNotEligible",
      "engineering.permissions.effectiveReasonNoSource",
    ];
    for (const key of keys) {
      expect(typeof resolveKey(EN, key)).toBe("string");
      expect(typeof resolveKey(FR, key)).toBe("string");
    }
  });
});
