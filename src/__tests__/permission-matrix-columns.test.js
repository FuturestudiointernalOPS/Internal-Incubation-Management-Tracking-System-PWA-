/**
 * PHASE 2 — Permission Center, the checkbox columns (UI-6).
 *
 * The CRUD ladder, the View dependency and the strict role-driven
 * section filter.
 *
 * Pure helpers — no database, no mocks.
 */

const {
  buildSectionColumns,
  extraCapabilities,
  capabilityLevel,
  isModuleFull,
  toggleCapability,
  toggleFullCapabilities,
  filterSectionsByRoleEligibility,
} = require("@/components/permissions/matrixHelpers");

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
