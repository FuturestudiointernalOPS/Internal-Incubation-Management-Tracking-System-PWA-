/**
 * Sidebar navigation — single-logic contract.
 *
 * buildSidebarNav({ role, responsibilities }) is the ONLY sidebar builder:
 *   - the role provides the Dashboard home,
 *   - the held responsibilities provide the features (+ subsections),
 *   - super_admin / developer see every feature without holding them,
 *   - a responsibility is shown only when held (nothing leaks from other
 *     role matrices — there are no role matrices anymore).
 */

const {
  buildSidebarNav,
  responsibilityRequiredForPath,
  RESPONSIBILITY_NAV,
  RESPONSIBILITY_ORDER,
  SUPERUSER_ROLES,
} = require("@/lib/masterNavigation");

const topIds = (items) => (items || []).map((i) => i.id);

const EVERY_FEATURE_IDS = RESPONSIBILITY_ORDER.map((k) => RESPONSIBILITY_NAV[k].id);

describe("buildSidebarNav", () => {
  test("always opens with a Dashboard whose href follows the role", () => {
    expect(buildSidebarNav({ role: "super_admin", responsibilities: [] })[0]).toMatchObject({
      id: "dashboard",
      href: "/admin",
    });
    expect(buildSidebarNav({ role: "staff", responsibilities: [] })[0].href).toBe("/staff");
    expect(buildSidebarNav({ role: "program_manager", responsibilities: [] })[0].href).toBe("/pm");
    expect(buildSidebarNav({ role: "team", responsibilities: [] })[0].href).toBe("/team");
    expect(buildSidebarNav({ role: "crm", responsibilities: [] })[0].href).toBe("/crm");
  });

  test("super_admin and developer see every feature, without holding responsibilities", () => {
    for (const role of SUPERUSER_ROLES) {
      const ids = topIds(buildSidebarNav({ role, responsibilities: [] }));
      expect(ids[0]).toBe("dashboard");
      for (const featureId of EVERY_FEATURE_IDS) {
        expect(ids).toContain(featureId);
      }
    }
  });

  test("a role with no responsibilities sees only its Dashboard", () => {
    const ids = topIds(buildSidebarNav({ role: "staff", responsibilities: [] }));
    expect(ids).toEqual(["dashboard"]);
  });

  test("roles without responsibilities keep their personal pages", () => {
    expect(topIds(buildSidebarNav({ role: "participant", responsibilities: [] }))).toEqual([
      "dashboard",
      "learning",
      "programs",
      "certificates",
      "ventures",
    ]);
    expect(topIds(buildSidebarNav({ role: "facilitator", responsibilities: [] }))).toEqual([
      "dashboard",
      "my_programs",
      "reviews",
    ]);
    expect(topIds(buildSidebarNav({ role: "investor", responsibilities: [] }))).toEqual([
      "dashboard",
      "pipeline",
      "portfolio",
      "activity",
    ]);
    expect(topIds(buildSidebarNav({ role: "founder", responsibilities: [] }))).toEqual([
      "dashboard",
      "programs",
      "ventures",
    ]);
    expect(topIds(buildSidebarNav({ role: "crm", responsibilities: [] }))).toEqual([
      "dashboard",
      "crm_dashboard",
      "forms",
    ]);
  });

  test("personal pages still combine with held responsibility features", () => {
    const items = buildSidebarNav({ role: "participant", responsibilities: [{ key: "crm" }] });
    expect(topIds(items)).toEqual([
      "dashboard",
      "learning",
      "programs",
      "certificates",
      "ventures",
      "crm",
    ]);
  });

  test("held responsibilities become features, in canonical order, nothing else", () => {
    const items = buildSidebarNav({
      role: "staff",
      responsibilities: [
        { key: "finance" },
        { key: "knowledge_base" },
        { key: "communication" },
        { key: "crm" },
      ],
    });
    expect(topIds(items)).toEqual([
      "dashboard",
      "crm",
      "communication",
      "finance",
      "knowledge",
    ]);

    // Legacy personal leaves of other roles must NEVER leak in.
    const allIds = new Set();
    const visit = (nodes) =>
      (nodes || []).forEach((n) => {
        allIds.add(n.id);
        visit(n.children || n.subItems);
      });
    visit(items);
    for (const leaked of [
      "my_programs",
      "reviews",
      "notifications",
      "learning",
      "certificates",
      "timeline",
      "pipeline",
      "portfolio",
      "activity",
    ]) {
      expect(allIds.has(leaked)).toBe(false);
    }
  });

  test("each feature carries its subsections (or a direct href)", () => {
    const items = buildSidebarNav({ role: "staff", responsibilities: RESPONSIBILITY_ORDER.map((k) => ({ key: k })) });
    for (const item of items.slice(1)) {
      if (item.children && item.children.length > 0) {
        expect(item.children.every((c) => c.href && c.id)).toBe(true);
      } else {
        expect(item.href).toBeTruthy();
      }
    }
  });

  test("unmapped responsibilities and lowercased string keys are tolerated", () => {
    const items = buildSidebarNav({ role: "staff", responsibilities: ["CRM", { key: "nope" }] });
    expect(topIds(items)).toEqual(["dashboard", "crm"]);
  });

  test("the superuser variant uses /admin hrefs when the feature has one", () => {
    const sa = buildSidebarNav({ role: "super_admin", responsibilities: [] });
    const staff = buildSidebarNav({ role: "staff", responsibilities: ["finance"] });
    expect(sa.find((i) => i.id === "finance").href).toBe("/admin/finance");
    expect(staff.find((i) => i.id === "finance").href).toBe("/finance");
  });
});

describe("responsibilityRequiredForPath", () => {
  test("maps each /admin page to its owning responsibility", () => {
    expect(responsibilityRequiredForPath("/admin/finance")).toBe("finance");
    expect(responsibilityRequiredForPath("/admin/access")).toBe("user_management");
    expect(responsibilityRequiredForPath("/admin/programs")).toBe("program_management");
    expect(responsibilityRequiredForPath("/admin/knowledge")).toBe("knowledge_base");
    expect(responsibilityRequiredForPath("/admin/security/permissions")).toBe("user_management");
    expect(responsibilityRequiredForPath("/admin/blockers")).toBe("tasks");
  });

  test("returns null for paths outside /admin coverage", () => {
    expect(responsibilityRequiredForPath("/staff/dashboard")).toBeNull();
    expect(responsibilityRequiredForPath("/")).toBeNull();
    expect(responsibilityRequiredForPath(null)).toBeNull();
  });
});
