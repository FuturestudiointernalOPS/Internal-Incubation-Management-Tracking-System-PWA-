/**
 * PHASE 2 — Permission Center, capability families.
 *
 * Parent/children metadata, the CRUD set, and what "Full" means once
 * families are in play.
 *
 * Pure helpers — no database, no mocks.
 */

const {
  crudCapabilities,
  hasCrudCapabilities,
  filterSectionsToCrudModules,
  isModuleFull,
  toggleCapability,
  toggleFullCapabilities,
} = require("@/components/permissions/matrixHelpers");

// ─── Capability families (parent ▸ children) ─────────────────────────────────

describe("capability families — catalog metadata contract", () => {
  const {
    CAPABILITY_CATALOG,
    capabilityParent,
    capabilityChildren,
    moduleCapabilityParents,
    isCapabilityParent,
  } = require("@/models/authorization/capability-catalog");

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
  const { moduleCapabilityParents } = require("@/models/authorization/capability-catalog");
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
