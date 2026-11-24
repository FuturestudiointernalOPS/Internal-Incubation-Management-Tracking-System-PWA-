/**
 * Étape 3 — the menu derives from rights (behind the default-off flag).
 *
 * These tests pin the new projection for the staff and admin spaces:
 *   - a right opens its leaf, and the absence of the right closes it;
 *   - a staff address override still collapses a section to a leaf;
 *   - the owner can open admin + staff + shared surfaces, never the member
 *     context doors;
 *   - an explicit cross-space address (finance profile) still wins.
 *
 * The flag-off behaviour is pinned separately by navigation.test.js.
 */

const { buildAccessNav, CAPABILITY_CATALOG } = (() => {
  const nav = require("@/lib/masterNavigation");
  const catalogue = require(
    "@/models/authorization/constants/feature-module-capability",
  );
  return { ...nav, CAPABILITY_CATALOG: catalogue.CAPABILITY_CATALOG };
})();

const FLAG = "AUTHZ_NAV_FROM_RIGHTS";
const originalFlag = process.env[FLAG];

beforeAll(() => {
  process.env[FLAG] = "true";
});

afterAll(() => {
  if (originalFlag === undefined) delete process.env[FLAG];
  else process.env[FLAG] = originalFlag;
});

function flattenIds(items, out = []) {
  for (const item of items || []) {
    out.push(item.id);
    flattenIds(item.subItems, out);
  }
  return out;
}

function find(items, id) {
  for (const item of items || []) {
    if (item.id === id) return item;
    const nested = find(item.subItems, id);
    if (nested) return nested;
  }
  return null;
}

function fullMatrix() {
  const matrix = {};
  for (const [module, definition] of Object.entries(CAPABILITY_CATALOG)) {
    matrix[module] = {};
    for (const capability of Object.keys(definition.capabilities || {})) {
      matrix[module][capability] = 5;
    }
  }
  return matrix;
}

describe("menu derived from rights — staff space", () => {
  test("a held right opens its leaf; the other rights stay closed", () => {
    const nav = buildAccessNav("staff", { contacts: { view: 1 } });
    const ids = flattenIds(nav);
    expect(ids).toContain("crm");
    expect(ids).toContain("all_contacts");
    expect(ids).not.toContain("crm_organizations"); // crm.view is not held
    expect(find(nav, "all_contacts").href).toBe("/staff/crm/contacts");
  });

  test("a section with an unreachable role address collapses to a leaf", () => {
    const nav = buildAccessNav("staff", { programs: { view: 1 } });
    const programs = find(nav, "programs");
    expect(programs).toBeDefined();
    expect(programs.href).toBe("/staff/program-manager/programs");
    expect(programs.subItems).toBeUndefined();
  });

  test("member context doors never leak into the staff menu", () => {
    const nav = buildAccessNav("staff", { programs: { view: 1 } });
    const ids = flattenIds(nav);
    for (const personal of ["my_programs", "learning", "certificates", "portfolio", "activity"]) {
      expect(ids).not.toContain(personal);
    }
  });

  test("the flag off keeps the role-mask Forms door while the matrix loads", () => {
    // The Forms screens carry their own rights (forms_*), so a LOADED matrix
    // without them closes the door in both modes; what the role mask keeps is
    // its own doors while the matrix is still unknown.
    process.env[FLAG] = "false";
    try {
      const ids = flattenIds(buildAccessNav("staff", null));
      expect(ids).toContain("forms");
      expect(ids).toContain("forms_list");
    } finally {
      process.env[FLAG] = "true";
    }
  });

  test("the flag on derives the menu from rights only", () => {
    const nav = buildAccessNav("staff", { messaging: { view: 1 } });
    const ids = flattenIds(nav);
    expect(ids).toContain("messages");
    expect(ids).not.toContain("forms"); // forms.view is not held
  });
});

describe("menu derived from rights — admin space", () => {
  test("the owner opens admin + staff surfaces", () => {
    const nav = buildAccessNav("super_admin", fullMatrix());
    const ids = flattenIds(nav);
    expect(ids).toContain("crm");
    expect(ids).toContain("all_contacts");
    expect(ids).toContain("weekly_ops"); // staff address, reachable by the owner
    expect(ids).toContain("permissions");
  });

  test("the owner does not get the member context doors", () => {
    const nav = buildAccessNav("super_admin", fullMatrix());
    const ids = flattenIds(nav);
    for (const personal of ["my_programs", "learning", "certificates", "portfolio", "activity", "profile"]) {
      expect(ids).not.toContain(personal);
    }
  });
});

describe("menu derived from rights — explicit cross-space address", () => {
  test("the finance role keeps its personal profile door", () => {
    const nav = buildAccessNav("finance", { finance: { view: 1 } });
    const profile = find(nav, "profile");
    expect(profile).toBeDefined();
    expect(profile.href).toBe("/member/participant/profile");
  });
});

describe("menu derived from rights — an unloaded matrix means no rights", () => {
  test("an unknown matrix and an empty one produce the same menu", () => {
    for (const role of ["staff", "super_admin"]) {
      expect(flattenIds(buildAccessNav(role, null))).toEqual(
        flattenIds(buildAccessNav(role, {})),
      );
    }
  });

  test("a public destination still renders while the matrix is unknown", () => {
    expect(flattenIds(buildAccessNav("staff", null))).toContain("dashboard");
  });
});
