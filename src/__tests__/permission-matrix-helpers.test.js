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
  buildSectionColumns,
  extraCapabilities,
  capabilityLevel,
  toggleCapability,
  toggleFullCapabilities,
  isModuleFull,
  filterSectionsByRoleEligibility,
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

// ─── UI-6 — checkbox columns + View dependency ──────────────────────────────

describe("buildSectionColumns (fixed level ladder + named extras)", () => {
  // The section shape produced by groupModulesByFeature for `communication`.
  const SECTION = {
    feature: "communication",
    modules: ["internal_comms", "messaging"],
    capabilities: ["view", "delete", "create_announcements", "moderate", "send"],
    unmapped: false,
  };

  test("renders View · Edit · Create · Delete · Full, then named extras alphabetically", () => {
    expect(buildSectionColumns(SECTION).map((c) => c.key)).toEqual([
      "view",
      "edit",
      "create",
      "delete",
      "full",
      "create_announcements",
      "moderate",
      "send",
    ]);
  });

  test("the level ladder is fixed even when a section carries none of them", () => {
    const columns = buildSectionColumns({ capabilities: ["grant", "view_matrix"] });
    expect(columns.map((c) => c.key)).toEqual([
      "view",
      "edit",
      "create",
      "delete",
      "full",
      "grant",
      "view_matrix",
    ]);
    expect(columns.find((c) => c.key === "full").kind).toBe("full");
  });

  test("extraCapabilities keeps only non-CRUD capabilities", () => {
    expect(extraCapabilities(SECTION)).toEqual([
      "create_announcements",
      "moderate",
      "send",
    ]);
  });

  test("canonical levels: view=1, create=2, edit=3, delete=4, extras=1", () => {
    expect(capabilityLevel("view")).toBe(1);
    expect(capabilityLevel("create")).toBe(2);
    expect(capabilityLevel("edit")).toBe(3);
    expect(capabilityLevel("delete")).toBe(4);
    expect(capabilityLevel("send")).toBe(1);
  });
});

describe("toggleCapability (View is the base capability)", () => {
  const CAPS = ["view", "send", "delete"]; // messaging

  test("checking an action capability also checks View", () => {
    expect(toggleCapability({}, "messaging", "send", true, CAPS)).toEqual({
      messaging: { send: 1, view: 1 },
    });
  });

  test("checking a CRUD capability stores its canonical level", () => {
    expect(toggleCapability({}, "contacts", "edit", true, ["view", "edit"])).toEqual({
      contacts: { edit: 3, view: 1 },
    });
  });

  test("unchecking a non-view capability only clears that one", () => {
    const next = toggleCapability(
      { messaging: { view: 1, send: 1, delete: 1 } },
      "messaging",
      "delete",
      false,
      CAPS,
    );
    expect(next).toEqual({ messaging: { view: 1, send: 1, delete: 0 } });
  });

  test("unchecking View clears every other capability of the module", () => {
    const next = toggleCapability(
      { messaging: { view: 1, send: 1, delete: 1 } },
      "messaging",
      "view",
      false,
      CAPS,
    );
    expect(next).toEqual({ messaging: { view: 0, send: 0, delete: 0 } });
  });

  test("never mutates the input matrix", () => {
    const input = { messaging: { view: 1 } };
    toggleCapability(input, "messaging", "send", true, CAPS);
    expect(input).toEqual({ messaging: { view: 1 } });
  });

  test("modules without a view capability get no phantom View", () => {
    const next = toggleCapability({}, "permissions", "grant", true, ["view_matrix", "grant"]);
    expect(next).toEqual({ permissions: { grant: 1 } });
  });
});

describe("toggleFullCapabilities (Full = every capability at level 5)", () => {
  const CAPS = ["view", "send", "delete"];

  test("checks every capability of the module at level 5", () => {
    const next = toggleFullCapabilities({}, "messaging", true, CAPS);
    expect(next).toEqual({ messaging: { view: 5, send: 5, delete: 5 } });
    expect(isModuleFull(next, "messaging", CAPS)).toBe(true);
  });

  test("unchecking clears every capability of the module", () => {
    const next = toggleFullCapabilities(
      { messaging: { view: 5, send: 5, delete: 5 } },
      "messaging",
      false,
      CAPS,
    );
    expect(next).toEqual({ messaging: { view: 0, send: 0, delete: 0 } });
  });

  test("isModuleFull is false on a partial grant", () => {
    expect(isModuleFull({ messaging: { view: 1, send: 1 } }, "messaging", CAPS)).toBe(false);
  });
});

describe("filterSectionsByRoleEligibility (strict role-driven display)", () => {
  const SECTIONS = [
    { feature: "communication", modules: ["messaging"], capabilities: ["view"], unmapped: false },
    { feature: "ventures", modules: ["ventures"], capabilities: ["view"], unmapped: false },
    { feature: "org_membership", modules: ["org_membership"], capabilities: ["view"], unmapped: true },
  ];
  // Only `staff` is eligible for communication; only `founder` for ventures.
  const eligible = (role, feature) =>
    (role === "staff" && feature === "communication") ||
    (role === "founder" && feature === "ventures");

  test("no assigned role shows nothing (ceiling cannot be derived)", () => {
    expect(filterSectionsByRoleEligibility(SECTIONS, [], eligible)).toEqual([]);
  });

  test("a feature shows only when one of the assigned roles is eligible for it", () => {
    const out = filterSectionsByRoleEligibility(SECTIONS, ["staff"], eligible);
    expect(out.map((s) => s.feature)).toEqual(["communication", "org_membership"]);
  });

  test("the union across roles is used (not the intersection)", () => {
    const out = filterSectionsByRoleEligibility(SECTIONS, ["staff", "founder"], eligible);
    expect(out.map((s) => s.feature)).toEqual([
      "communication",
      "ventures",
      "org_membership",
    ]);
  });

  test("a role with no eligibility hides every feature", () => {
    const out = filterSectionsByRoleEligibility(SECTIONS, ["mentor"], eligible);
    // only the unmapped module survives (it carries no feature ceiling)
    expect(out.map((s) => s.feature)).toEqual(["org_membership"]);
  });
});
