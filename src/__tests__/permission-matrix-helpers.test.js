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
  filterSectionsToCrudModules,
  crudCapabilities,
  hasCrudCapabilities,
  deriveModuleCaps,
  deriveUserCapState,
  deriveDenialReason,
  collectContextModules,
  collectHiddenStoredCaps,
  eligibleFeaturesForPerson,
  isPersonEligibleForFeature,
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

// ─── UI-6 — checkbox columns + View dependency ──────────────────────────────

describe("buildSectionColumns (CRUD ladder only)", () => {
  // The section shape produced by groupModulesByFeature for `communication`.
  const SECTION = {
    feature: "communication",
    modules: ["internal_comms", "messaging"],
    capabilities: ["view", "delete", "create_announcements", "moderate", "send"],
    unmapped: false,
  };

  test("renders exactly View · Edit · Create · Delete · Full", () => {
    expect(buildSectionColumns().map((column) => column.key)).toEqual([
      "view",
      "edit",
      "create",
      "delete",
      "full",
    ]);
  });

  test("the ladder is constant — a section can never add a non-CRUD column", () => {
    const columns = buildSectionColumns({
      capabilities: ["view", "delete", "grant", "view_matrix", "send"],
    });
    expect(columns.map((column) => column.key)).toEqual([
      "view",
      "edit",
      "create",
      "delete",
      "full",
    ]);
    expect(columns.find((column) => column.key === "full").kind).toBe("full");
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
    expect(out.map((section) => section.feature)).toEqual(["communication", "org_membership"]);
  });

  test("the union across roles is used (not the intersection)", () => {
    const out = filterSectionsByRoleEligibility(SECTIONS, ["staff", "founder"], eligible);
    expect(out.map((section) => section.feature)).toEqual([
      "communication",
      "ventures",
      "org_membership",
    ]);
  });

  test("a role with no eligibility hides every feature", () => {
    const out = filterSectionsByRoleEligibility(SECTIONS, ["mentor"], eligible);
    // only the unmapped module survives (it carries no feature ceiling)
    expect(out.map((section) => section.feature)).toEqual(["org_membership"]);
  });
});

// ─── Capability families (parent ▸ children) ─────────────────────────────────

describe("capability families — catalog metadata contract", () => {
  const {
    CAPABILITY_CATALOG,
    capabilityParent,
    capabilityChildren,
    moduleCapabilityParents,
    isCapabilityParent,
  } = require("@/lib/authorization/capability-catalog");

  test("every parent resolves to a capability of the SAME module", () => {
    for (const featureDef of Object.values(CAPABILITY_CATALOG)) {
      for (const meta of Object.values(featureDef.capabilities || {})) {
        if (!meta.parent) continue;
        expect(featureDef.capabilities[meta.parent]).toBeDefined();
      }
    }
  });

  test("families are one level deep (a parent is never itself a child)", () => {
    for (const featureDef of Object.values(CAPABILITY_CATALOG)) {
      for (const meta of Object.values(featureDef.capabilities || {})) {
        if (!meta.parent) continue;
        expect(featureDef.capabilities[meta.parent].parent).toBeUndefined();
      }
    }
  });

  test("pilot families: projects.edit ▸ archive and programs.edit ▸ publish", () => {
    expect(capabilityParent("projects", "archive")).toBe("edit");
    expect(capabilityChildren("projects", "edit")).toEqual(["archive"]);
    expect(capabilityParent("programs", "publish")).toBe("edit");
    expect(capabilityChildren("programs", "edit")).toEqual(["publish"]);
    expect(moduleCapabilityParents("programs")).toEqual({ publish: "edit" });
    expect(moduleCapabilityParents("contacts")).toEqual({});
    expect(isCapabilityParent("programs", "edit")).toBe(true);
    expect(isCapabilityParent("programs", "view")).toBe(false);
  });
});

describe("crudCapabilities / hasCrudCapabilities / filterSectionsToCrudModules", () => {
  test("crudCapabilities keeps only view/create/edit/delete", () => {
    expect(crudCapabilities(["view", "send", "grant", "edit", "view_matrix"])).toEqual([
      "view",
      "edit",
    ]);
  });

  test("hasCrudCapabilities is false for capability-only modules", () => {
    expect(hasCrudCapabilities(["view", "edit"])).toBe(true);
    expect(hasCrudCapabilities(["grant", "view_matrix"])).toBe(false);
    expect(hasCrudCapabilities([])).toBe(false);
    expect(hasCrudCapabilities()).toBe(false);
  });

  test("drops CRUD-less modules and the sections they leave empty", () => {
    const modules = {
      users: { capabilities: ["view", "create", "edit", "delete", "suspend", "assign_roles"] },
      permissions: { capabilities: ["view_matrix", "grant", "promote_super_admin"] },
      bulk_upload: { capabilities: ["execute"] },
    };
    const sections = [
      { feature: "user_management", modules: ["users", "permissions"], capabilities: [] },
      { feature: "crm", modules: ["bulk_upload"], capabilities: [] },
    ];
    const out = filterSectionsToCrudModules(sections, modules);
    expect(out.map((section) => section.feature)).toEqual(["user_management"]);
    expect(out[0].modules).toEqual(["users"]);
  });

  test("keeps a view-only module (it still carries a CRUD capability)", () => {
    const out = filterSectionsToCrudModules(
      [{ feature: "knowledge_base", modules: ["knowledge"], capabilities: [] }],
      { knowledge: { capabilities: ["view", "create", "edit", "delete"] } },
    );
    expect(out[0].modules).toEqual(["knowledge"]);
  });
});

describe("Full is scoped to the CRUD set", () => {
  test("toggleFullCapabilities only touches the capabilities it is handed", () => {
    const next = toggleFullCapabilities(
      { messaging: { view: 1, send: 2 } },
      "messaging",
      true,
      ["view", "create", "edit", "delete"],
    );
    expect(next.messaging.view).toBe(5);
    expect(next.messaging.delete).toBe(5);
    // `send` is not CRUD → Full never grants it (no hidden privilege grant).
    expect(next.messaging.send).toBe(2);
  });

  test("isModuleFull ignores non-CRUD capabilities", () => {
    expect(isModuleFull({}, "users", [])).toBe(false);
    expect(
      isModuleFull(
        { users: { view: 5, create: 5, edit: 5, delete: 5, suspend: 1 } },
        "users",
        ["view", "create", "edit", "delete"],
      ),
    ).toBe(true);
  });
});

describe("toggleCapability (capability families)", () => {
  const { moduleCapabilityParents } = require("@/lib/authorization/capability-catalog");
  const PROJECT_CAPS = ["view", "create", "edit", "delete", "archive"];
  const PROJECT_PARENTS = moduleCapabilityParents("projects");
  const PROGRAM_CAPS = ["view", "create", "edit", "delete", "publish"];
  const PROGRAM_PARENTS = moduleCapabilityParents("programs");

  test("checking a child also checks its parent (never the other way)", () => {
    expect(
      toggleCapability({}, "projects", "archive", true, PROJECT_CAPS, PROJECT_PARENTS),
    ).toEqual({ projects: { archive: 1, edit: 3, view: 1 } });

    // Granting the parent does NOT grant the child.
    expect(
      toggleCapability({}, "projects", "edit", true, PROJECT_CAPS, PROJECT_PARENTS),
    ).toEqual({ projects: { edit: 3, view: 1 } });
  });

  test("clearing a parent clears its children", () => {
    const next = toggleCapability(
      { programs: { view: 1, edit: 3, publish: 1 } },
      "programs",
      "edit",
      false,
      PROGRAM_CAPS,
      PROGRAM_PARENTS,
    );
    expect(next).toEqual({ programs: { view: 1, edit: 0, publish: 0 } });
  });

  test("clearing a child leaves the parent intact", () => {
    const next = toggleCapability(
      { programs: { view: 1, edit: 3, publish: 1 } },
      "programs",
      "publish",
      false,
      PROGRAM_CAPS,
      PROGRAM_PARENTS,
    );
    expect(next).toEqual({ programs: { view: 1, edit: 3, publish: 0 } });
  });

  test("a parent already held keeps its level when a child is checked", () => {
    const next = toggleCapability(
      { projects: { view: 1, edit: 5 } },
      "projects",
      "archive",
      true,
      PROJECT_CAPS,
      PROJECT_PARENTS,
    );
    expect(next).toEqual({ projects: { view: 1, edit: 5, archive: 1 } });
  });

  test("never mutates the input matrix", () => {
    const input = { projects: { view: 1 } };
    toggleCapability(input, "projects", "archive", true, PROJECT_CAPS, PROJECT_PARENTS);
    expect(input).toEqual({ projects: { view: 1 } });
  });
});
