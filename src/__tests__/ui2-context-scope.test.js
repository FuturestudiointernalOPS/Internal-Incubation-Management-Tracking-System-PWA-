/**
 * PHASE UI-2a — Context & Scope screen contracts.
 *
 * Locks:
 *   1. The verdict mapping stays honest (no data ≠ deny ≠ allow; pending
 *      policies never render green).
 *   2. Every verdict label exists in English AND French.
 *   3. The screen is wired to the real endpoints and components (no
 *      speculative UI).
 */

const fs = require("fs");
const path = require("path");

const { describeScopeCheck } = require("@/components/permissions/scopeCheckHelpers");

const EN = require("@/locales/en/engineering.json");
const FR = require("@/locales/fr/engineering.json");

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const resolveKey = (bundle, dotted) =>
  dotted.split(".").reduce((acc, part) => (acc == null ? undefined : acc[part]), bundle);

describe("UI-2a — scope check verdict mapping", () => {
  test("no result at all is neutral (nothing was decided)", () => {
    expect(describeScopeCheck(null)).toEqual({
      variant: "neutral",
      labelKey: "engineering.permissions.liveCheckNoResult",
    });
  });

  test("an unimplemented policy is pending — never green", () => {
    const out = describeScopeCheck({ implemented: false, within_scope: false });
    expect(out.variant).toBe("pending");
    expect(out.labelKey).toBe("engineering.permissions.liveCheckUnsupported");
  });

  test("a check without a record id decided nothing (neutral)", () => {
    const out = describeScopeCheck({ implemented: true, within_scope: null });
    expect(out.variant).toBe("neutral");
    expect(out.labelKey).toBe("engineering.permissions.liveCheckNoResource");
  });

  test("within scope / outside scope map to allowed / denied", () => {
    expect(
      describeScopeCheck({ implemented: true, within_scope: true }).variant,
    ).toBe("mapped");
    expect(
      describeScopeCheck({ implemented: true, within_scope: false }),
    ).toEqual({
      variant: "denied",
      labelKey: "engineering.permissions.liveCheckDenied",
    });
  });

  test("every verdict label exists in English and French", () => {
    const keys = [
      "engineering.permissions.liveCheckNoResult",
      "engineering.permissions.liveCheckUnsupported",
      "engineering.permissions.liveCheckNoResource",
      "engineering.permissions.liveCheckAllowed",
      "engineering.permissions.liveCheckDenied",
      "engineering.permissions.liveCheckTitle",
      "engineering.permissions.liveCheckHint",
      "engineering.permissions.liveCheckRun",
      "engineering.permissions.liveCheckResolved",
      "engineering.permissions.contextRolesStatus",
      "engineering.permissions.contextRolesStatusMapped",
      "engineering.permissions.contextRolesStatusGap",
    ];
    for (const key of keys) {
      expect(typeof resolveKey(EN, key)).toBe("string");
      expect(typeof resolveKey(FR, key)).toBe("string");
    }
  });
});

describe("UI-2a — screen wiring", () => {
  test("the route renders the new Context & Scope screen (not the legacy center)", () => {
    const src = read("src/app/admin/security/permissions/context-scope/page.js");
    expect(src).toContain("ContextScopeView");
    expect(src).not.toContain("PermissionCenter");
  });

  test("the screen composes the registry, the policy catalogue and the live check", () => {
    const src = read("src/components/permissions/ContextScopeView.js");
    expect(src).toContain("ContextRolesView");
    expect(src).toContain("ScopePoliciesView");
    expect(src).toContain("LiveCheckPanel");
  });

  test("the live check uses the real verification endpoint", () => {
    const src = read("src/components/permissions/LiveCheckPanel.js");
    expect(src).toContain("/api/engineering/permissions/scope-check");
  });

  test("the badge set includes a denied variant", () => {
    const src = read("src/components/permissions/ui/Badge.js");
    expect(src).toContain("denied:");
  });
});
