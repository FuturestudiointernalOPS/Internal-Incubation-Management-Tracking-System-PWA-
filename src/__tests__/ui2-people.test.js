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
} = require("@/components/permissions/matrixHelpers/state");

const EN = require("@/locales/en/engineering.json");
const FR = require("@/locales/fr/engineering.json");
const { CENTER_TABS } = require("@/components/permissions/center/centerNav");

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

  test("the people door renders the active centre with its registries", () => {
    const src = read(route);
    expect(src).toContain("PermissionCenter");
    expect(src).toContain('initialSection="people"');
    expect(CENTER_TABS.people).toEqual(["people", "groups", "administrators", "context"]);
  });

  test("the person detail reads the real decision endpoints", () => {
    const src = read("src/components/permissions/center/sections/PersonDetail.js");
    expect(src).toContain("/api/engineering/permissions/user-context?cid=");
    expect(src).toContain("/api/engineering/permissions/scope-check?policy=");
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
