/**
 * Phase 2 — legacy gate migration (no more staff compatibility bypasses).
 *
 * The staff bypass on program create/edit/templates is gone: program writes
 * now require the programs.create / programs.edit capability through the
 * resolver (eligibility boundary included). Plain staff without the capability
 * are denied; PMs (staff + Program Manager profile) are allowed.
 */
const { authorize, mergeEffectiveCapabilities } = require("@/lib/authorization/resolver");
const { MODULE_TO_FEATURE } = require("@/lib/authorization/eligibility");

function ctx({ role = "staff", eligibility = {}, profileCaps = {}, grants = {}, restrictions = {} }) {
  return {
    cid: "U1",
    role,
    isSuperAdmin: false,
    eligibility,
    effective: mergeEffectiveCapabilities(profileCaps, {}, grants, restrictions),
    grants,
    restrictions,
  };
}

const STAFF_ELIG = Object.fromEntries(
  Object.keys(MODULE_TO_FEATURE).map((m) => [MODULE_TO_FEATURE[m], true]),
);

// New Staff Default (post Phase 3): NO programs caps.
const STAFF_DEFAULT = {
  reports: { create: 2 },
  projects: { view: 1, create: 2, edit: 3, delete: 4 },
  tasks: { view: 1, create: 2, edit: 3, delete: 4 },
  messaging: { view: 1, send: 2 },
};

// Program Manager profile carries programs.create/edit.
const PM_PROFILE = {
  ...STAFF_DEFAULT,
  programs: { view: 1, create: 2, edit: 5, delete: 0, publish: 4 },
};

describe("Phase 2 — program write gates (no staff bypass)", () => {
  test("plain staff (no programs caps): program create and edit are DENIED", () => {
    const staff = ctx({ eligibility: STAFF_ELIG, profileCaps: STAFF_DEFAULT });
    expect(authorize(staff, "programs", "create")).toBe(false);
    expect(authorize(staff, "programs", "edit")).toBe(false);
  });

  test("staff with Program Manager profile: create + edit ALLOWED", () => {
    const pm = ctx({ eligibility: STAFF_ELIG, profileCaps: PM_PROFILE });
    expect(authorize(pm, "programs", "create")).toBe(true);
    expect(authorize(pm, "programs", "edit")).toBe(true);
  });

  test("staff with individual programs.edit grant: edit ALLOWED, create still denied", () => {
    const granted = ctx({ eligibility: STAFF_ELIG, profileCaps: STAFF_DEFAULT, grants: { programs: { edit: 3 } } });
    expect(authorize(granted, "programs", "edit")).toBe(true);
    expect(authorize(granted, "programs", "create")).toBe(false);
  });

  test("staff who is NOT eligible for programs: even a grant cannot bypass eligibility", () => {
    const ineligible = ctx({ eligibility: { ...STAFF_ELIG, program_management: false }, profileCaps: STAFF_DEFAULT, grants: { programs: { edit: 3 } } });
    expect(authorize(ineligible, "programs", "edit")).toBe(false);
  });

  test("super admin bypass preserved for program writes", () => {
    const sa = { cid: "sa", role: "super_admin", isSuperAdmin: true, eligibility: {}, effective: {}, grants: {}, restrictions: {} };
    expect(authorize(sa, "programs", "create")).toBe(true);
    expect(authorize(sa, "programs", "edit")).toBe(true);
  });
});
