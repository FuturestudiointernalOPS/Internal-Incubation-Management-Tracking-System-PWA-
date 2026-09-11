/**
 * PHASE 2 — Permission Center matrix derivation rules (pure helpers).
 *
 * Locks the architecture rules the matrices display:
 *  - Module access is DERIVED from capabilities (never stored).
 *  - Zero-capability modules stay visible ([—]).
 *  - Restrictions REMOVE a capability entirely (they beat grants) — the
 *    User Matrix must never collapse a mixed state.
 *  - Scope is never encoded into capability names.
 */
const {
  buildFeatureRows,
  groupModulesByFeature,
  deriveModuleCaps,
  deriveUserCapState,
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
    expect(rows.map((r) => r.feature)).toEqual(["crm", "ventures"]);
    expect(rows[0].modules.map((m) => m.module)).toEqual(["contacts", "duplicates"]);
    expect(rows[1].modules[0].module).toBe("journey");
  });

  test("surfaces locked modules without hiding them", () => {
    const rows = buildFeatureRows(FEATURES, MODULE_TO_FEATURE, CATALOG);
    const dups = rows[0].modules.find((m) => m.module === "duplicates");
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
    expect(sections.map((s) => s.feature)).toEqual(["crm", "org_membership"]);
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
    const orphan = sections.find((s) => s.feature === "org_membership");
    expect(orphan.unmapped).toBe(true);
    expect(orphan.modules).toEqual(["org_membership"]);
    expect(orphan.capabilities).toEqual(["view", "manage"]);
  });

  test("falls back to the module→feature map when no feature order is given", () => {
    const sections = groupModulesByFeature(MODULES, MAP, []);
    expect(sections.map((s) => s.feature)).toEqual(["crm", "org_membership"]);
  });

  test("skips a feature that owns no module", () => {
    const sections = groupModulesByFeature(
      { contacts: { capabilities: ["view"] } },
      { contacts: "crm" },
      ["crm", "finance"],
    );
    expect(sections.map((s) => s.feature)).toEqual(["crm"]);
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
    const s = deriveUserCapState(sources, "contacts", "edit");
    expect(s.profile).toBe(true);
    expect(s.restricted).toBe(true);
    expect(s.effective).toBe(false);
    expect(s.reason).toBe("restriction");
  });

  test("grant-only capability is effective", () => {
    const s = deriveUserCapState(sources, "contacts", "delete");
    expect(s.grant).toBe(true);
    expect(s.effective).toBe(true);
  });

  test("plain profile capability is effective without restriction", () => {
    const s = deriveUserCapState(sources, "contacts", "view");
    expect(s.profile).toBe(true);
    expect(s.effective).toBe(true);
    expect(s.reason).toBeNull();
  });

  test("unknown capability is empty across all sources", () => {
    const s = deriveUserCapState(sources, "journey", "publish");
    expect(s).toEqual({
      profile: false,
      group: false,
      grant: false,
      restricted: false,
      effective: false,
      reason: null,
    });
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
