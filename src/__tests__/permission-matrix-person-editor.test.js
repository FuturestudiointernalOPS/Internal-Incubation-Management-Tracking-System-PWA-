/**
 * PHASE 2 — Permission Center, the per-person ceiling.
 *
 * C1: the stored capabilities the editable matrix is not showing, and
 * which features a given person may hold at all.
 *
 * Pure helpers — no database, no mocks.
 */

const {
  collectHiddenStoredCaps,
  eligibleFeaturesForPerson,
  isPersonEligibleForFeature,
} = require("@/components/permissions/matrixHelpers");

// ─── C1 — stored capabilities the editable matrix is not showing ─────────────

describe("collectHiddenStoredCaps (C1 — stored but not shown)", () => {
  const saved = {
    finance: { view: 1, edit: 3 }, // module not offered at all
    contacts: { view: 1, retire: 2 }, // the "retire" capability is gone
    lms: { view: 0 }, // zero level = not held
    journey: { publish: 1 }, // fully offered
  };
  const editable = {
    contacts: ["view", "create", "edit", "delete"],
    journey: ["publish"],
  };

  test("returns the held capabilities the editable set does not offer", () => {
    expect(collectHiddenStoredCaps(saved, editable)).toEqual([
      { module: "contacts", capabilities: ["retire"] },
      { module: "finance", capabilities: ["edit", "view"] },
    ]);
  });

  test("nothing is hidden when every held capability is offered", () => {
    const full = {
      contacts: ["view", "retire"],
      finance: ["view", "edit"],
      lms: ["view"],
      journey: ["publish"],
    };
    expect(collectHiddenStoredCaps(saved, full)).toEqual([]);
  });

  test("a profile with no offered capability hides everything it holds", () => {
    const out = collectHiddenStoredCaps(saved, {});
    expect(out.map((entry) => entry.module)).toEqual([
      "contacts",
      "finance",
      "journey",
    ]);
  });

  test("accepts Set values for the offered capabilities", () => {
    const out = collectHiddenStoredCaps(
      { contacts: { view: 1, retire: 2 } },
      { contacts: new Set(["view"]) },
    );
    expect(out).toEqual([{ module: "contacts", capabilities: ["retire"] }]);
  });

  test("empty / null stored caps are safe", () => {
    expect(collectHiddenStoredCaps(null, {})).toEqual([]);
    expect(collectHiddenStoredCaps({}, {})).toEqual([]);
  });
});

// ─── C — the person editor's ceiling ─────────────────────────────────────────

describe("eligibleFeaturesForPerson (person editor ceiling)", () => {
  const MAP = { contacts: "crm", journey: "ventures", lms: "lms" };

  test("keeps the eligible features (boolean and {eligible} shapes)", () => {
    const eligibleFeatures = eligibleFeaturesForPerson(
      { crm: true, ventures: { eligible: false }, lms: { eligible: true } },
      MAP,
      [],
    );
    expect([...eligibleFeatures].sort()).toEqual(["crm", "lms"]);
  });

  test("retains the feature of a module holding a personal exception", () => {
    const eligibleFeatures = eligibleFeaturesForPerson({ crm: true, ventures: false }, MAP, [
      "journey",
    ]);
    expect(eligibleFeatures.has("ventures")).toBe(true);
    expect(eligibleFeatures.has("crm")).toBe(true);
  });

  test("accepts the Super Admin shape", () => {
    const eligibleFeatures = eligibleFeaturesForPerson(
      { crm: { eligible: true, source: "super_admin bypass" } },
      MAP,
      [],
    );
    expect([...eligibleFeatures]).toEqual(["crm"]);
  });

  test("a module with no feature never widens the set", () => {
    const eligibleFeatures = eligibleFeaturesForPerson({ crm: true }, MAP, ["org_membership"]);
    expect([...eligibleFeatures]).toEqual(["crm"]);
  });

  test("an unknown map hides nothing (returns undefined)", () => {
    expect(eligibleFeaturesForPerson(null, MAP, ["journey"])).toBeUndefined();
  });
});

describe("isPersonEligibleForFeature (person editor ceiling)", () => {
  test("true for a boolean true and for {eligible:true}", () => {
    expect(isPersonEligibleForFeature({ crm: true }, "crm")).toBe(true);
    expect(isPersonEligibleForFeature({ crm: { eligible: true } }, "crm")).toBe(
      true,
    );
  });

  test("false for an explicit deny, and for a missing row (fail closed)", () => {
    expect(isPersonEligibleForFeature({ crm: false }, "crm")).toBe(false);
    expect(isPersonEligibleForFeature({ crm: { eligible: false } }, "crm")).toBe(
      false,
    );
    expect(isPersonEligibleForFeature({}, "crm")).toBe(false);
  });

  test("fails OPEN on an unknown map and on a module with no feature", () => {
    expect(isPersonEligibleForFeature(null, "crm")).toBe(true);
    expect(isPersonEligibleForFeature({ crm: false }, null)).toBe(true);
  });
});
