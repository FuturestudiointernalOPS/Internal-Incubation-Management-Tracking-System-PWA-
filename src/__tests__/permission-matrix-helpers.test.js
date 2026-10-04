/**
 * PHASE 2 — Permission Center matrix derivation rules (pure helpers).
 *
 * Locks the architecture rules the matrices display:
 *  - Module access is DERIVED from capabilities (never stored).
 *  - Zero-capability modules stay visible ([—]).
 *  - Restrictions REMOVE a capability entirely (they beat grants) — the
 *    User Matrix must never collapse a mixed state.
 *  - Scope is never encoded into capability names.
 *
 * Siblings: permission-matrix-person-editor.test.js (the per-person
 * ceiling), permission-matrix-columns.test.js (the checkbox columns) and
 * permission-matrix-capability-families.test.js (parent/child families).
 */
const {
  buildFeatureRows,
  groupModulesByFeature,
  deriveModuleCaps,
  deriveUserCapState,
  deriveDenialReason,
  collectContextModules,
} = require("@/components/permissions/matrixHelpers");

const FEATURES = ["crm", "ventures"];
const MODULE_TO_FEATURE = { contacts: "crm", duplicates: "crm", journey: "ventures" };
const CATALOG = {
  contacts: {
    capabilities: { view: {}, create: {}, edit: {}, delete: {}, import: {}, export: {} },
  },
  duplicates: { locked: true, capabilities: { view: {}, resolve: {} } },
  journey: { capabilities: { view: {}, edit: {}, publish: {}, approve: {} } },
};

describe("buildFeatureRows", () => {
  test("groups modules under their feature and keeps canonical feature order", () => {
    const rows = buildFeatureRows(FEATURES, MODULE_TO_FEATURE, CATALOG);
    expect(rows.map((row) => row.feature)).toEqual(["crm", "ventures"]);
    expect(rows[0].modules.map((module) => module.module)).toEqual(["contacts", "duplicates"]);
    expect(rows[1].modules[0].module).toBe("journey");
  });

  test("surfaces locked modules without hiding them", () => {
    const rows = buildFeatureRows(FEATURES, MODULE_TO_FEATURE, CATALOG);
    const dups = rows[0].modules.find((module) => module.module === "duplicates");
    expect(dups.locked).toBe(true);
    expect(dups.caps).toEqual(["resolve", "view"]);
  });

  test("skips modules unknown to the catalog (registry truth)", () => {
    const rows = buildFeatureRows(["crm"], { ghost: "crm" }, CATALOG);
    expect(rows[0].modules).toEqual([]);
  });
});

describe("groupModulesByFeature (feature sections of the Defaults Matrix)", () => {
  // PERMISSION_MODULES shape: capabilities are arrays, not the CAPABILITY_CATALOG
  // object maps buildFeatureRows consumes.
  const MODULES = {
    contacts: {
      name: "Contacts",
      capabilities: ["view", "create", "edit", "delete", "import", "export"],
    },
    duplicates: { name: "Duplicates", capabilities: ["view", "resolve"] },
    org_membership: {
      name: "Organizational Membership",
      capabilities: ["view", "manage"],
    },
  };
  const MAP = { contacts: "crm", duplicates: "crm" };

  test("orders capabilities with the CRUD base first, extras alphabetically", () => {
    const sections = groupModulesByFeature(MODULES, MAP, ["crm"]);
    expect(sections.map((section) => section.feature)).toEqual(["crm", "org_membership"]);
    expect(sections[0].modules).toEqual(["contacts", "duplicates"]);
    expect(sections[0].capabilities).toEqual([
      "view",
      "create",
      "edit",
      "delete",
      "export",
      "import",
      "resolve",
    ]);
  });

  test("modules without a feature mapping stay visible as their own section", () => {
    const sections = groupModulesByFeature(MODULES, MAP, ["crm"]);
    const orphan = sections.find((section) => section.feature === "org_membership");
    expect(orphan.unmapped).toBe(true);
    expect(orphan.modules).toEqual(["org_membership"]);
    expect(orphan.capabilities).toEqual(["view", "manage"]);
  });

  test("falls back to the module→feature map when no feature order is given", () => {
    const sections = groupModulesByFeature(MODULES, MAP, []);
    expect(sections.map((section) => section.feature)).toEqual(["crm", "org_membership"]);
  });

  test("skips a feature that owns no module", () => {
    const sections = groupModulesByFeature(
      { contacts: { capabilities: ["view"] } },
      { contacts: "crm" },
      ["crm", "finance"],
    );
    expect(sections.map((section) => section.feature)).toEqual(["crm"]);
  });
});

describe("deriveModuleCaps (module access is derived)", () => {
  test("no stored module grant — only capabilities count", () => {
    const state = deriveModuleCaps({ contacts: { view: 1, edit: 3 } }, "contacts");
    expect(state.accessible).toBe(true);
    expect(state.held).toEqual(["edit", "view"]);
    expect(state.heldCount).toBe(2);
  });

  test("zero capabilities => module shows [—] but remains derivable", () => {
    const state = deriveModuleCaps({ contacts: { view: 1 } }, "duplicates");
    expect(state.accessible).toBe(false);
    expect(state.heldCount).toBe(0);
  });

  test("level 0 means not held", () => {
    const state = deriveModuleCaps({ contacts: { view: 0 } }, "contacts");
    expect(state.accessible).toBe(false);
  });
});

describe("deriveUserCapState (mixed sources, restriction wins)", () => {
  const sources = {
    profile: { contacts: { view: 1, edit: 1 } },
    groups: {},
    grants: { contacts: { delete: 1 } },
    restrictions: { contacts: { edit: 1 } },
  };

  test("profile + restriction keeps BOTH visible and effective=false with reason", () => {
    const capState = deriveUserCapState(sources, "contacts", "edit");
    expect(capState.profile).toBe(true);
    expect(capState.restricted).toBe(true);
    expect(capState.effective).toBe(false);
    expect(capState.reason).toBe("restriction");
  });

  test("grant-only capability is effective", () => {
    const capState = deriveUserCapState(sources, "contacts", "delete");
    expect(capState.grant).toBe(true);
    expect(capState.effective).toBe(true);
  });

  test("plain profile capability is effective without restriction", () => {
    const capState = deriveUserCapState(sources, "contacts", "view");
    expect(capState.profile).toBe(true);
    expect(capState.effective).toBe(true);
    expect(capState.reason).toBeNull();
  });

  test("unknown capability is empty across all sources", () => {
    const capState = deriveUserCapState(sources, "journey", "publish");
    expect(capState).toEqual({
      profile: false,
      group: false,
      grant: false,
      restricted: false,
      eligible: true,
      effective: false,
      reason: null,
    });
  });

  // Eligibility is the OUTER gate (mirrors authorize()): a held capability is
  // still not effective for a feature the person is not eligible for.
  test("an ineligible feature makes a held capability ineffective", () => {
    const capState = deriveUserCapState(sources, "contacts", "view", false);
    expect(capState.profile).toBe(true); // the right is still HELD...
    expect(capState.eligible).toBe(false);
    expect(capState.effective).toBe(false); // ...but not effective
    expect(deriveDenialReason(capState)).toBe("not-eligible");
  });

  test("an explicit restriction does not hide ineligibility (outer gate first)", () => {
    const capState = deriveUserCapState(sources, "contacts", "edit", false);
    expect(capState.restricted).toBe(true);
    expect(deriveDenialReason(capState)).toBe("not-eligible");
  });

  test("an eligible caller keeps the previous semantics (Super Admin path)", () => {
    const held = deriveUserCapState(sources, "contacts", "view", true);
    expect(held.effective).toBe(true);
    expect(deriveDenialReason(held)).toBeNull();
  });
});

describe("collectContextModules", () => {
  test("unions modules across profile/group/grant AND restriction-only modules", () => {
    const sources = {
      profile: { contacts: {} },
      groups: { journey: {} },
      grants: {},
      restrictions: { finance: {} },
    };
    expect(collectContextModules(sources)).toEqual(["contacts", "finance", "journey"]);
  });
});
