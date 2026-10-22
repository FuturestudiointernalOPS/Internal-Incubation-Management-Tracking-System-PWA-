/**
 * CAPABILITY SOURCE CONSISTENCY — the one capability source stays coherent.
 *
 * The capability vocabulary is declared ONCE (the feature/module capability
 * registry) and every other view is derived from it. Two things could silently
 * drift apart, and neither would be visible from a feature route:
 *
 *   1. the feature grouping INSIDE the registry vs the module → feature map the
 *      resolver authorizes against — a module filed under the wrong section, a
 *      module with no section, or a section holding the wrong modules;
 *   2. the derived views (the module-keyed catalog, the flat vocabulary) vs the
 *      registry they claim to come from.
 *
 * This suite pins both directions so a hand-edit to one view can never diverge
 * from the source without failing here.
 */

const {
  FEATURE_MODULE_CAPABILITY,
  CAPABILITY_CATALOG,
  PERMISSION_MODULES,
} = require("@/models/authorization/constants/feature-module-capability");
const {
  FEATURE_ORDER,
  MODULE_TO_FEATURE,
} = require("@/models/authorization/constants");

const sorted = (values) => [...values].sort();

/** module → the feature it is filed under in the registry. */
const REGISTRY_MODULE_FEATURE = (() => {
  const map = {};
  for (const [feature, modules] of Object.entries(FEATURE_MODULE_CAPABILITY)) {
    for (const moduleKey of Object.keys(modules)) map[moduleKey] = feature;
  }
  return map;
})();

describe("feature grouping vs MODULE_TO_FEATURE", () => {
  test("the registry lists exactly the canonical features, in FEATURE_ORDER", () => {
    expect(Object.keys(FEATURE_MODULE_CAPABILITY)).toEqual(FEATURE_ORDER);
  });

  test("every registry module is filed under its MODULE_TO_FEATURE section", () => {
    const mislabeled = Object.entries(REGISTRY_MODULE_FEATURE)
      .filter(([moduleKey, feature]) => MODULE_TO_FEATURE[moduleKey] !== feature)
      .map(
        ([moduleKey, feature]) =>
          `${moduleKey}: registry=${feature} MODULE_TO_FEATURE=${MODULE_TO_FEATURE[moduleKey]}`,
      );
    expect(mislabeled).toEqual([]);
  });

  test("each section holds exactly the modules the map assigns to it", () => {
    for (const feature of FEATURE_ORDER) {
      const fromMap = Object.entries(MODULE_TO_FEATURE)
        .filter(([, mapped]) => mapped === feature)
        .map(([moduleKey]) => moduleKey);
      expect(sorted(Object.keys(FEATURE_MODULE_CAPABILITY[feature] || {}))).toEqual(sorted(fromMap));
    }
  });

  test("no module is left without a section", () => {
    expect(sorted(Object.keys(MODULE_TO_FEATURE))).toEqual(
      sorted(Object.keys(REGISTRY_MODULE_FEATURE)),
    );
  });
});

describe("derived views match the source", () => {
  test("the catalog holds exactly the registry's modules", () => {
    expect(sorted(Object.keys(CAPABILITY_CATALOG))).toEqual(
      sorted(Object.keys(REGISTRY_MODULE_FEATURE)),
    );
  });

  test("the catalog mirrors each module's name, risk, locked flag and capabilities", () => {
    for (const modules of Object.values(FEATURE_MODULE_CAPABILITY)) {
      for (const [moduleKey, definition] of Object.entries(modules)) {
        const entry = CAPABILITY_CATALOG[moduleKey];
        expect(entry).toBeDefined();
        expect(entry.name).toBe(definition.name);
        expect(entry.risk).toBe(definition.risk);
        expect(Boolean(entry.locked)).toBe(Boolean(definition.locked));
        // Same object by reference: the catalog cannot be a divergent copy.
        expect(entry.capabilities).toBe(definition.capabilities);
      }
    }
  });

  test("the flat vocabulary is every non-registryOnly module, capabilities in registry order", () => {
    const expectedOrder = [];
    const expectedCaps = {};
    for (const modules of Object.values(FEATURE_MODULE_CAPABILITY)) {
      for (const [moduleKey, definition] of Object.entries(modules)) {
        if (definition.registryOnly) continue;
        expectedOrder.push(moduleKey);
        expectedCaps[moduleKey] = Object.keys(definition.capabilities);
      }
    }
    expect(Object.keys(PERMISSION_MODULES)).toEqual(expectedOrder);
    for (const moduleKey of expectedOrder) {
      expect(PERMISSION_MODULES[moduleKey].capabilities).toEqual(expectedCaps[moduleKey]);
      expect(PERMISSION_MODULES[moduleKey].name).toBe(CAPABILITY_CATALOG[moduleKey].name);
    }
  });

  test("registryOnly modules stay out of the flat vocabulary", () => {
    const leaked = [];
    for (const modules of Object.values(FEATURE_MODULE_CAPABILITY)) {
      for (const [moduleKey, definition] of Object.entries(modules)) {
        if (definition.registryOnly && PERMISSION_MODULES[moduleKey] !== undefined) {
          leaked.push(moduleKey);
        }
      }
    }
    expect(leaked).toEqual([]);
  });

  test("every capability carries a label, a risk and a description", () => {
    const missing = [];
    for (const modules of Object.values(FEATURE_MODULE_CAPABILITY)) {
      for (const [moduleKey, definition] of Object.entries(modules)) {
        for (const [capability, meta] of Object.entries(definition.capabilities)) {
          if (!meta || !meta.label || !meta.risk || !meta.description) {
            missing.push(`${moduleKey}.${capability}`);
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
