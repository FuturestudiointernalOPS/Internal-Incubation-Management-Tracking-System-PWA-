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
        { id: "crm_dashboard", href: "/admin/crm", subItems: null },
        { id: "all_contacts", href: "/admin/communications/contacts", subItems: null },
        { id: "crm_membership", href: "/admin/crm/membership", subItems: null },
        { id: "crm_timeline", href: "/admin/crm/timeline", subItems: null },
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
      id: "ventures",
      href: null,
      subItems: [
        { id: "all_ventures", href: "/admin/ventures", subItems: null },
        { id: "register_venture", href: "/admin/ventures/register", subItems: null },
      ],
    },
    {
      id: "investors",
      href: null,
      subItems: [
        { id: "investors_manage", href: "/admin/investors", subItems: null },
        { id: "investors_dashboard", href: "/admin/investors/dashboard", subItems: null },
        { id: "investors_review", href: "/admin/investors/review", subItems: null },
        { id: "investors_overview", href: "/admin/investors/overview", subItems: null },
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
        { id: "intelligence", href: "/admin/intelligence", subItems: null },
      ],
    },
    {
      id: "security",
      href: null,
      subItems: [
        { id: "security", href: "/admin/security", subItems: null },
        { id: "audit_logs", href: "/admin/audit-logs", subItems: null },
        { id: "access_summary", href: "/admin/access", subItems: null },
        { id: "permissions", href: "/admin/security/permissions", subItems: null },
      ],
    },
    {
      id: "settings",
      href: null,
      subItems: [
        { id: "integrations", href: "/admin/integrations", subItems: null },
        { id: "engineering_dashboard", href: "/admin/engineering", subItems: null },
        { id: "system", href: "/admin/system", subItems: null },
      ],
    },
  ],

  admin: [
    { id: "dashboard", href: "/admin", subItems: null },
    { id: "projects", href: "/admin/projects", subItems: null },
    { id: "reports", href: "/admin/reports", subItems: null },
  ],

  program_manager: [
    { id: "dashboard", href: "/pm", subItems: null },
    { id: "programs", href: "/pm/programs", subItems: null },
    {
      id: "communication",
      href: null,
      subItems: [
        { id: "groups", href: "/pm/communications/contacts", subItems: null },
        { id: "messages", href: "/pm/messages", subItems: null },
      ],
    },
    {
      id: "reports",
      href: null,
      subItems: [
        { id: "internal_reports", href: "/staff/op-report", subItems: null },
        { id: "my_projects", href: "/staff/projects", subItems: null },
      ],
    },
  ],

  staff: [
    { id: "dashboard", href: "/staff", subItems: null },
    { id: "weekly_ops", href: "/staff/op-report", subItems: null },
    { id: "programs", href: "/pm/programs", subItems: null },
    { id: "my_projects", href: "/staff/projects", subItems: null },
    { id: "messages", href: "/staff/messages", subItems: null },
  ],

  teacher: [
    { id: "dashboard", href: "/teacher", subItems: null },
    {
      id: "communication",
      href: null,
      subItems: [{ id: "groups", href: "/pm/communications/contacts", subItems: null }],
    },
    {
      id: "programs",
      href: null,
      subItems: [{ id: "all_programs", href: "/pm/programs", subItems: null }],
    },
  ],

  facilitator: [
    { id: "dashboard", href: "/facilitator", subItems: null },
    { id: "my_programs", href: "/facilitator/programs", subItems: null },
    { id: "reviews", href: "/facilitator/reviews", subItems: null },
    { id: "profile", href: "/facilitator/profile", subItems: null },
  ],

  developer: [
    { id: "dashboard", href: "/developer", subItems: null },
    { id: "my_tasks", href: "/developer/my-tasks", subItems: null },
    { id: "assigned_tasks", href: "/developer/assigned-tasks", subItems: null },
    {
      id: "rituals",
      href: null,
      subItems: [
        { id: "standup", href: "/staff/op-report?tab=standup", subItems: null },
        { id: "retro", href: "/staff/op-report?tab=retro", subItems: null },
      ],
    },
    { id: "projects", href: "/staff/projects", subItems: null },
    { id: "notifications", href: "/developer/notifications", subItems: null },
    { id: "messages", href: "/staff/messages", subItems: null },
  ],

  member: [{ id: "dashboard", href: "/workspaces", subItems: null }],

  participant: [
    { id: "dashboard", href: "/participant", subItems: null },
    { id: "programs", href: "/participant/dashboard", subItems: null },
    { id: "certificates", href: "/participant/certificates", subItems: null },
  ],

  founder: [
    { id: "dashboard", href: "/participant", subItems: null },
    { id: "programs", href: "/participant/dashboard", subItems: null },
    { id: "ventures", href: "/participant/ventures", subItems: null },
    { id: "timeline", href: "/participant/profile#timeline", subItems: null },
  ],

  team: [
    { id: "dashboard", href: "/team", subItems: null },
    { id: "programs", href: "/team", subItems: null },
  ],

  investor: [
    { id: "dashboard", href: "/investor/dashboard", subItems: null },
    { id: "pipeline", href: "/investor/pipeline", subItems: null },
    { id: "portfolio", href: "/investor/portfolio", subItems: null },
    { id: "activity", href: "/investor/history", subItems: null },
    { id: "profile", href: "/investor/profile", subItems: null },
  ],

  finance: [
    { id: "dashboard", href: "/finance", subItems: null },
    { id: "profile", href: "/participant/profile", subItems: null },
  ],

  crm: [
    { id: "crm_dashboard", href: "/crm", subItems: null },
    { id: "forms", href: "/platform", subItems: null },
  ],
};

describe("Master navigation — role projections", () => {
  for (const role of Object.keys(FIXTURE)) {
    it(`produces the ${role} navigation exactly`, () => {
      expect(serialize(buildRoleNav(role))).toEqual(FIXTURE[role]);
    });
  }

  it("falls back to the admin view for unknown roles", () => {
    expect(serialize(buildRoleNav("unknown_role"))).toEqual(FIXTURE.admin);
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
          if (item.id !== "security") {
            // Same concept referenced from multiple parents must be the SAME
            // node object (shared reference) — never a duplicated definition.
            expect(entry.node).toBe(item);
          }
        } else {
          ids.set(item.id, { node: item, count: 1 });
        }
        if (item.children) visit(item.children);
      });
    visit(MASTER_NAVIGATION);
    // KNOWN LEGACY EXCEPTION (documented, not fixed in this phase): the
    // SECURITY section and its first child share the id "security". The
    // projection keeps them distinct via the parent-children lookup. Any
    // other duplicate id is a copy and fails above.
    expect(ids.get("security").count).toBe(2);

    // Same master node consumed by multiple roles (no per-role copies):
    // "messages" is a communication child for super_admin/pm and top-level
    // for staff/developer; "programs" is a section for super_admin and a
    // leaf for staff/participant/founder; "forms" is shared too.
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
      ["developer", "messages"],
      ["super_admin", "programs"],
      ["staff", "programs"],
      ["participant", "programs"],
      ["founder", "programs"],
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
