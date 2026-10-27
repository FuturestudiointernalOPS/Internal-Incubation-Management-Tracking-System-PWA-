/**
 * Master navigation — behavior-neutrality contract.
 *
 * These fixtures are the EXACT navigation output that the legacy per-role
 * matrices produced. buildRoleNav(role) must reproduce them identically
 * (ids, hrefs, order, subtrees) for every role. If this test fails, a role's
 * sidebar changed — either intentionally (update the fixture with approval)
 * or accidentally (fix the projection).
 */
const { buildRoleNav } = require("@/lib/masterNavigation");

function serialize(items) {
  return (items || []).map((item) => ({
    id: item.id,
    href: item.href || null,
    subItems: item.subItems ? serialize(item.subItems) : null,
  }));
}

const FIXTURE = {
  super_admin: [
    { id: "dashboard", href: "/admin", subItems: null },
    {
      id: "crm",
      href: null,
      subItems: [
        { id: "crm_dashboard", href: "/crm", subItems: null },
        { id: "all_contacts", href: "/crm/contacts", subItems: null },
        { id: "crm_organizations", href: "/crm/organizations", subItems: null },
        { id: "crm_leads", href: "/crm/leads", subItems: null },
        { id: "crm_opportunities", href: "/crm/opportunities", subItems: null },
        { id: "crm_pipelines", href: "/crm/pipelines", subItems: null },
        { id: "crm_activities", href: "/crm/activities", subItems: null },
        { id: "crm_segments", href: "/crm/segments", subItems: null },
        { id: "crm_automations", href: "/crm/automations", subItems: null },
        { id: "crm_timeline", href: "/admin/crm/timeline", subItems: null },
        { id: "crm_membership", href: "/admin/crm/membership", subItems: null },
        { id: "crm_duplicates", href: "/admin/crm/duplicates", subItems: null },
        { id: "pending_users", href: "/admin/pending-users", subItems: null },
        { id: "bulk_upload", href: "/admin/bulk-upload", subItems: null },
      ],
    },
    {
      id: "communication",
      href: null,
      subItems: [
        { id: "messages", href: "/admin/internal-comms", subItems: null },
        { id: "announcements", href: "/admin/announcements", subItems: null },
        { id: "forms", href: "/platform", subItems: null },
      ],
    },
    {
      id: "programs",
      href: null,
      subItems: [
        { id: "all_programs", href: "/admin/programs", subItems: null },
        { id: "create_program", href: "/admin/programs/new", subItems: null },
        { id: "progress", href: "/admin/progress", subItems: null },
      ],
    },
    {
      // PROJECT MANAGEMENT (ventures → projects) is retired from the sidebar;
      // the page still exists and is reached from a Venture and from reminders.
      id: "ventures",
      href: null,
      subItems: [
        { id: "all_ventures", href: "/admin/ventures", subItems: null },
      ],
    },
    {
      id: "investors",
      href: null,
      subItems: [
        { id: "investors_manage", href: "/admin/investors", subItems: null },
        { id: "investors_dashboard", href: "/admin/investors/dashboard", subItems: null },
        { id: "investors_review", href: "/admin/investors/review", subItems: null },
        { id: "investors_campaigns", href: "/admin/investors/campaigns", subItems: null },
        { id: "investors_relationships", href: "/admin/investors/relationships", subItems: null },
      ],
    },
    { id: "finance", href: "/admin/finance", subItems: null },
    {
      id: "operations",
      href: null,
      subItems: [
        { id: "internal_ops_board", href: "/admin/work", subItems: null },
        { id: "all_projects", href: "/admin/projects", subItems: null },
        { id: "create_project", href: "/admin/projects?action=create", subItems: null },
        { id: "tasks", href: "/admin/tasks", subItems: null },
        { id: "blockers", href: "/admin/blockers", subItems: null },
        { id: "standup", href: "/staff/op-report?tab=standup", subItems: null },
        { id: "retro", href: "/staff/op-report?tab=retro", subItems: null },
      ],
    },
    {
      id: "intelligence",
      href: "/admin/intelligence",
      subItems: null,
    },
    {
      id: "reports",
      href: null,
      subItems: [
        { id: "program_reports", href: "/admin/reports/responses", subItems: null },
        { id: "internal_reports", href: "/admin/op-reports", subItems: null },
        { id: "metrics", href: "/admin/metrics", subItems: null },
      ],
    },
    {
      id: "knowledge",
      href: null,
      subItems: [
        { id: "knowledge_base", href: "/admin/knowledge", subItems: null },
      ],
    },
    {
      id: "lms",
      href: null,
      subItems: [
        { id: "lms_courses", href: "/admin/lms/courses", subItems: null },
        { id: "lms_registrations", href: "/admin/lms/registrations", subItems: null },
      ],
    },
    {
      id: "settings",
      href: null,
      subItems: [
        { id: "system", href: "/admin/system", subItems: null },
        // Security & compliance live under Settings, not as a section of their own.
        { id: "security", href: "/admin/security", subItems: null },
        { id: "audit_logs", href: "/admin/audit-logs", subItems: null },
        { id: "access_summary", href: "/admin/access", subItems: null },
        { id: "permissions", href: "/admin/security/permissions", subItems: null },
      ],
    },
  ],

  // Phase H — program_manager / facilitator / investor have no role mask any
  // more either: a profile is not a role, so they normalize to their baseline
  // surface (staff for the staff-only profile, member otherwise).
  program_manager: [
    { id: "dashboard", href: "/staff", subItems: null },
    { id: "weekly_ops", href: "/staff/op-report", subItems: null },
    { id: "programs", href: "/pm/programs", subItems: null },
    { id: "my_projects", href: "/staff/projects", subItems: null },
    {
      id: "communication",
      href: null,
      subItems: [
        { id: "messages", href: "/staff/messages", subItems: null },
        { id: "forms", href: "/platform", subItems: null },
      ],
    },
  ],

  staff: [
    { id: "dashboard", href: "/staff", subItems: null },
    { id: "weekly_ops", href: "/staff/op-report", subItems: null },
    { id: "programs", href: "/pm/programs", subItems: null },
    { id: "my_projects", href: "/staff/projects", subItems: null },
    {
      id: "communication",
      href: null,
      subItems: [
        { id: "messages", href: "/staff/messages", subItems: null },
        { id: "forms", href: "/platform", subItems: null },
      ],
    },
  ],

  facilitator: [{ id: "dashboard", href: "/participant", subItems: null }],

  member: [{ id: "dashboard", href: "/participant", subItems: null }],

  // Phase H — participant / founder have no role mask any more: their surfaces
  // are relationship-driven, so the mask projects to the member baseline.
  participant: [{ id: "dashboard", href: "/participant", subItems: null }],

  founder: [{ id: "dashboard", href: "/participant", subItems: null }],

  team: [
    { id: "dashboard", href: "/team", subItems: null },
    { id: "programs", href: "/team", subItems: null },
  ],

  investor: [{ id: "dashboard", href: "/participant", subItems: null }],

  finance: [
    { id: "dashboard", href: "/finance", subItems: null },
    { id: "profile", href: "/participant/profile", subItems: null },
  ],

  crm: [
    {
      id: "crm",
      href: null,
      subItems: [
        { id: "crm_dashboard", href: "/crm", subItems: null },
        { id: "all_contacts", href: "/crm/contacts", subItems: null },
        { id: "crm_organizations", href: "/crm/organizations", subItems: null },
        { id: "crm_leads", href: "/crm/leads", subItems: null },
        { id: "crm_opportunities", href: "/crm/opportunities", subItems: null },
        { id: "crm_pipelines", href: "/crm/pipelines", subItems: null },
        { id: "crm_activities", href: "/crm/activities", subItems: null },
        { id: "crm_segments", href: "/crm/segments", subItems: null },
        { id: "crm_automations", href: "/crm/automations", subItems: null },
        { id: "crm_timeline", href: "/crm/timeline", subItems: null },
        { id: "crm_membership", href: "/crm/membership", subItems: null },
      ],
    },
    { id: "forms", href: "/platform", subItems: null },
  ],
};

describe("Master navigation — role projections", () => {
  for (const role of Object.keys(FIXTURE)) {
    it(`produces the ${role} navigation exactly`, () => {
      expect(serialize(buildRoleNav(role))).toEqual(FIXTURE[role]);
    });
  }

  it("falls back to a neutral view for unknown roles", () => {
    expect(serialize(buildRoleNav("unknown_role"))).toEqual([
      { id: "dashboard", href: "/admin", subItems: null },
      { id: "projects", href: "/admin/projects", subItems: null },
      { id: "reports", href: "/admin/reports", subItems: null },
    ]);
  });

  it("every ROLE_ACCESS reference resolves to a master node", () => {
    const { ROLE_ACCESS } = require("@/lib/masterNavigation");
    const ids = new Set();
    const visit = (items) =>
      (items || []).forEach((item) => {
        ids.add(item.id);
        if (item.children) visit(item.children);
      });
    visit(require("@/lib/masterNavigation").MASTER_NAVIGATION);
    for (const role of Object.keys(ROLE_ACCESS)) {
      const access = ROLE_ACCESS[role];
      for (const id of access.top || []) expect(ids.has(id)).toBe(true);
      for (const list of Object.values(access.children || {}))
        for (const id of list) expect(ids.has(id)).toBe(true);
      for (const id of Object.keys(access.hrefs || {}))
        expect(ids.has(id)).toBe(true);
      for (const id of Object.keys(access.icons || {}))
        expect(ids.has(id)).toBe(true);
    }
  });

  it("exposes one master tree that covers every projected id", () => {
    const { MASTER_NAVIGATION } = require("@/lib/masterNavigation");
    const ids = new Set();
    const visit = (items) =>
      (items || []).forEach((item) => {
        ids.add(item.id);
        if (item.children) visit(item.children);
      });
    visit(MASTER_NAVIGATION);
    for (const role of Object.keys(FIXTURE)) {
      const collect = (items) =>
        (items || []).forEach((item) => {
          expect(ids.has(item.id)).toBe(true);
          if (item.subItems) collect(item.subItems);
        });
      collect(serialize(buildRoleNav(role)));
    }
  });

  it("defines every navigation concept exactly once and shares it across roles", () => {
    const { MASTER_NAVIGATION } = require("@/lib/masterNavigation");
    const ids = new Map();
    const visit = (items) =>
      (items || []).forEach((item) => {
        const entry = ids.get(item.id);
        if (entry) {
          entry.count += 1;
          // Same concept referenced from multiple parents must be the SAME
          // node object (shared reference) — never a duplicated definition.
          expect(entry.node).toBe(item);
        } else {
          ids.set(item.id, { node: item, count: 1 });
        }
        if (item.children) visit(item.children);
      });
    visit(MASTER_NAVIGATION);
    // The former exception (a SECURITY section whose first child shared its id) is
    // gone: security is now a plain page under Settings, defined once.
    expect(ids.get("security").count).toBe(1);

    // Same master node consumed by multiple roles (no per-role copies):
    // "messages" is a communication child for super_admin/pm and top-level
    // for staff; "programs" is a section for super_admin and a leaf for staff;
    // "forms" is shared too.
    const findIn = (items, id) => {
      for (const item of items || []) {
        if (item.id === id) return item;
        const found = findIn(item.subItems, id);
        if (found) return found;
      }
      return null;
    };
    const shared = [
      ["super_admin", "messages"],
      ["staff", "messages"],
      ["program_manager", "messages"],
      ["super_admin", "programs"],
      ["staff", "programs"],
      ["super_admin", "forms"],
      ["crm", "forms"],
    ];
    for (const [role, id] of shared) {
      const projected = findIn(buildRoleNav(role), id);
      expect(projected).not.toBeNull();
      expect(projected.id).toBe(ids.get(id).node.id);
      expect(projected.name).toBe(ids.get(id).node.name);
    }
  });
});

describe("capability projection — buildAccessNav contract", () => {
  const {
    NAV_CAPABILITY_REQUIREMENTS,
    requirementAlternatives,
    buildRoleNav,
    buildAccessNav,
  } = require("@/lib/masterNavigation");
  const { CAPABILITY_CATALOG } = require("@/models/authorization/constants/feature-module-capability");

  const collect = (items, out = []) => {
    (items || []).forEach((item) => {
      out.push(item);
      collect(item.subItems, out);
    });
    return out;
  };
  const ids = (items) => collect(items).map((item) => item.id);

  test("every requirement resolves to a real catalog capability", () => {
    for (const [, req] of Object.entries(NAV_CAPABILITY_REQUIREMENTS)) {
      const alternatives = requirementAlternatives(req);
      expect(alternatives.length).toBeGreaterThan(0);
      for (const alternative of alternatives) {
        expect(CAPABILITY_CATALOG[alternative.module]).toBeDefined();
        expect(
          CAPABILITY_CATALOG[alternative.module].capabilities[alternative.capability],
        ).toBeDefined();
      }
    }
  });

  test("unknown capabilities fail OPEN on visibility, never on hrefs", () => {
    const nav = buildAccessNav("staff", null);
    expect(ids(nav)).toEqual(ids(buildRoleNav("staff")));
  });

  test("super admin keeps the full admin navigation", () => {
    expect(buildAccessNav("super_admin", null)).toEqual(buildRoleNav("super_admin"));
  });

  test("a granted section is added with only its reachable children", () => {
    const nav = buildAccessNav("staff", { contacts: { view: 1 } });
    const crm = nav.find((item) => item.id === "crm");
    expect(crm).toBeDefined();
    // Only the CRM children that have a non-admin route AND pass their own
    // capability requirement survive (membership needs org_membership.view).
    expect(crm.subItems.map((subItem) => subItem.id)).toEqual([
      "crm_dashboard",
      "all_contacts",
      "crm_timeline",
    ]);
    expect(crm.subItems.map((subItem) => subItem.href)).toEqual([
      "/crm",
      "/crm/contacts",
      "/crm/timeline",
    ]);
  });

  test("a records-only profile gets the commercial objects, not people", () => {
    const nav = buildAccessNav("staff", { crm: { view: 1 } });
    const crm = nav.find((item) => item.id === "crm");
    expect(crm).toBeDefined();
    expect(crm.subItems.map((subItem) => subItem.id)).toEqual([
      "crm_dashboard",
      "crm_organizations",
      "crm_leads",
      "crm_opportunities",
      "crm_pipelines",
      "crm_activities",
      "crm_segments",
      "crm_automations",
    ]);
    expect(crm.subItems.map((subItem) => subItem.href)).toEqual([
      "/crm",
      "/crm/organizations",
      "/crm/leads",
      "/crm/opportunities",
      "/crm/pipelines",
      "/crm/activities",
      "/crm/segments",
      "/crm/automations",
    ]);
  });

  test("membership alone opens the CRM section with only the roster", () => {
    const nav = buildAccessNav("staff", { org_membership: { view: 1 } });
    const crm = nav.find((item) => item.id === "crm");
    expect(crm).toBeDefined();
    expect(crm.subItems.map((subItem) => subItem.id)).toEqual(["crm_membership"]);
    expect(crm.subItems[0].href).toBe("/crm/membership");
  });

  test("membership appears only when org_membership.view is held", () => {
    const without = buildAccessNav("staff", { contacts: { view: 1 } });
    expect(ids(without)).not.toContain("crm_membership");

    const withMembership = buildAccessNav("staff", {
      contacts: { view: 1 },
      org_membership: { view: 1 },
    });
    const crm = withMembership.find((item) => item.id === "crm");
    const membership = crm.subItems.find((subItem) => subItem.id === "crm_membership");
    expect(membership).toBeDefined();
    expect(membership.href).toBe("/crm/membership");
  });

  test("a granted leaf (finance) is added through its non-admin fallback", () => {
    const nav = buildAccessNav("staff", { finance: { view: 1 } });
    const finance = nav.find((item) => item.id === "finance");
    expect(finance).toBeDefined();
    expect(finance.href).toBe("/finance");
  });

  test("a role's own doors keep their hrefs (no /admin surgery on the base)", () => {
    const nav = buildAccessNav("unknown_role", null);
    expect(nav.map((item) => item.href)).toEqual(["/admin", "/admin/projects", "/admin/reports"]);
  });

  test("role-only sections (rituals) are never granted by a capability", () => {
    const everything = {};
    for (const req of Object.values(NAV_CAPABILITY_REQUIREMENTS)) {
      for (const alternative of requirementAlternatives(req)) {
        everything[alternative.module] = {
          ...(everything[alternative.module] || {}),
          [alternative.capability]: 5,
        };
      }
    }
    const staff = ids(buildAccessNav("staff", everything));
    expect(staff).not.toContain("rituals");
  });

  test("lms is capability-grantable and lands on a reachable page per role", () => {
    const everything = {};
    for (const req of Object.values(NAV_CAPABILITY_REQUIREMENTS)) {
      for (const alternative of requirementAlternatives(req)) {
        everything[alternative.module] = {
          ...(everything[alternative.module] || {}),
          [alternative.capability]: 5,
        };
      }
    }
    // Admin-capable role → keeps the admin landing.
    const saLms = buildAccessNav("super_admin", everything).find((item) => item.id === "lms");
    expect(saLms).toBeDefined();
    expect(saLms.subItems[0].href).toBe("/admin/lms/courses");
    // Program manager → the non-admin landing (never an /admin link).
    const pmLms = buildAccessNav("program_manager", everything).find((item) => item.id === "lms");
    expect(pmLms).toBeDefined();
    expect(pmLms.subItems[0].href).toBe("/pm/lms/courses");
  });

  test("non-admin navigation never renders an /admin link", () => {
    const caps = {
      contacts: { view: 1 },
      messaging: { view: 1 },
      reports: { view: 1, create: 1 },
      programs: { view: 1 },
      projects: { view: 1 },
      finance: { view: 1 },
    };
    for (const role of ["staff", "program_manager", "facilitator"]) {
      for (const item of collect(buildAccessNav(role, caps))) {
        if (item.href) expect(item.href.startsWith("/admin")).toBe(false);
      }
    }
  });

  test("every id renders at most once", () => {
    const nav = buildAccessNav("staff", { contacts: { view: 1 }, messaging: { view: 1 } });
    const rendered = ids(nav);
    expect(new Set(rendered).size).toBe(rendered.length);
  });
});

describe("Security lives under Settings", () => {
  it("Super Admin has no Security section: its pages are children of Settings", () => {
    const { MASTER_NAVIGATION } = require("@/lib/masterNavigation");
    const settings = MASTER_NAVIGATION.find((node) => node.id === "settings");
    expect(settings.children.map((child) => child.id)).toEqual(
      expect.arrayContaining(["system", "security", "audit_logs", "access_summary", "permissions"]),
    );
    expect(MASTER_NAVIGATION.some((node) => node.id === "security" && Array.isArray(node.children))).toBe(false);
  });
});
