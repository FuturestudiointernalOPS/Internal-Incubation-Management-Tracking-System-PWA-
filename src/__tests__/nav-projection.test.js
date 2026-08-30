/**
 * Capability-projected navigation (pending register item #4).
 *
 * buildRoleNav(role) is UNCHANGED (the behavior-neutrality contract in
 * navigation.test.js still governs it). projectNavForCapabilities adds a
 * visibility filter on top for roles with projection rules (staff today):
 *  - `hide` nodes disappear when the capability is missing
 *  - `show` sections appear as leaf links when the capability is present
 * This is VISIBILITY ONLY — the server remains authoritative.
 */
const {
  buildRoleNav,
  projectNavForCapabilities,
  hasCapability,
} = require("@/lib/masterNavigation");

const staffNav = buildRoleNav("staff");
const ids = (nav) => nav.map((i) => i.id);

// New Staff default effective matrix (post Phase 3 configuration).
const STAFF_EFFECTIVE = {
  reports: { create: 2 }, // weekly ops
  projects: { view: 1, create: 2, edit: 3, delete: 4 },
  tasks: { view: 1, create: 2, edit: 3, delete: 4 },
  messaging: { view: 1, send: 2 },
  internal_comms: { create_announcements: 2, moderate: 3 },
  investor: { view: 1, create: 2, edit: 3 },
};

describe("projectNavForCapabilities (staff)", () => {
  test("plain staff (new default): programs hidden, weekly ops/projects/messages stay", () => {
    const projected = projectNavForCapabilities(staffNav, STAFF_EFFECTIVE, "staff");
    const out = ids(projected);
    expect(out).toContain("dashboard");
    expect(out).toContain("weekly_ops"); // reports.create present
    expect(out).toContain("my_projects"); // projects.view present
    expect(out).toContain("messages"); // messaging.view present
    expect(out).not.toContain("programs"); // no programs.view → hidden
    expect(out).not.toContain("crm"); // no CRM yet
  });

  test("staff-PM (programs.view present): programs stays visible", () => {
    const pmEffective = { ...STAFF_EFFECTIVE, programs: { view: 1, edit: 3 } };
    const projected = projectNavForCapabilities(staffNav, pmEffective, "staff");
    expect(ids(projected)).toContain("programs");
  });

  test("staff granted CRM (contacts.view): CRM section appears as a leaf link", () => {
    const granted = { ...STAFF_EFFECTIVE, contacts: { view: 1 } };
    const projected = projectNavForCapabilities(staffNav, granted, "staff");
    const crm = projected.find((i) => i.id === "crm");
    expect(crm).toBeDefined();
    expect(crm.href).toBe("/admin/crm");
    expect(crm.subItems).toBeUndefined(); // leaf, never the admin child list
  });

  test("staff without contacts: no CRM section", () => {
    const projected = projectNavForCapabilities(staffNav, STAFF_EFFECTIVE, "staff");
    expect(ids(projected)).not.toContain("crm");
  });

  test("staff granted finance: finance appears; security/knowledge/reports/ventures/investors follow the same rule", () => {
    const granted = {
      ...STAFF_EFFECTIVE,
      finance: { view: 1 },
      settings: { view: 1 },
      knowledge: { view: 1 },
      reports: { view: 1, create: 2 },
      ventures: { view: 1 },
      investor: { view: 1 },
    };
    const projected = projectNavForCapabilities(staffNav, granted, "staff");
    const out = ids(projected);
    for (const id of ["finance", "security", "knowledge", "reports", "ventures", "investors"]) {
      expect(out).toContain(id);
    }
  });

  test("no effective matrix: nav unchanged (fail-open on visibility)", () => {
    expect(projectNavForCapabilities(staffNav, null, "staff")).toBe(staffNav);
  });
});

describe("projectNavForCapabilities (other roles)", () => {
  test("participant / facilitator / developer / super_admin pass through unchanged", () => {
    for (const role of ["participant", "facilitator", "developer", "super_admin"]) {
      const nav = buildRoleNav(role);
      expect(projectNavForCapabilities(nav, STAFF_EFFECTIVE, role)).toBe(nav);
    }
  });
});

describe("hasCapability", () => {
  test("checks level against the effective matrix", () => {
    const eff = { contacts: { view: 3 } };
    expect(hasCapability(eff, "contacts", "view")).toBe(true);
    expect(hasCapability(eff, "contacts", "delete")).toBe(false);
    expect(hasCapability(eff, "finance", "view")).toBe(false);
    expect(hasCapability({}, "contacts", "view")).toBe(false);
    expect(hasCapability(null, "contacts", "view")).toBe(false);
  });
});
