/**
 * DELEGATED RECORD CREATION — program / venture / investor.
 *
 * The Super Admin's creation flows used to live only under `/admin/*`, which the
 * admin layout refuses to everyone else. The rights already existed as
 * capabilities (`programs.create`, `ventures.create`, `investor.create`); this
 * suite locks the contract that makes them delegable:
 *
 *   - the three capabilities exist in the catalogue;
 *   - the investor feature's ceiling includes `member`, so the Permission
 *     Center can grant `investor.create` to a personal account;
 *   - creation is an ACTION ON THE DASHBOARD / LIST VIEW, never a sidebar
 *     section of its own (`create_hub` was removed deliberately);
 *   - every creation page lives on the non-admin `/create` surface.
 */

const fs = require("node:fs");
const path = require("node:path");

const {
  CREATION_ACTIONS,
  creationActionForHref,
} = require("@/lib/creationActions");
const {
  MASTER_NAVIGATION,
  NAV_CAPABILITY_REQUIREMENTS,
} = require("@/lib/masterNavigation");
const {
  CAPABILITY_CATALOG,
} = require("@/models/authorization/constants/feature-module-capability");
const {
  FEATURE_ELIGIBILITY_DEFAULTS,
} = require("@/models/authorization/constants/eligibility-defaults");

const ROOT = path.join(__dirname, "..", "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

describe("creation capabilities are delegable", () => {
  test("every creation action names a real catalogue capability", () => {
    expect(CREATION_ACTIONS.map((action) => `${action.module}.${action.capability}`)).toEqual([
      "programs.create",
      "ventures.create",
      "investor.create",
    ]);
    for (const action of CREATION_ACTIONS) {
      expect(CAPABILITY_CATALOG[action.module]).toBeDefined();
      expect(CAPABILITY_CATALOG[action.module].capabilities[action.capability]).toBeDefined();
      expect(action.actionKey.startsWith("creation.")).toBe(true);
    }
  });

  test("the investor ceiling admits a personal account", () => {
    // ELIGIBLE ≠ GRANTED: this only lets an administrator hand the right out.
    expect(FEATURE_ELIGIBILITY_DEFAULTS.investors).toContain("member");
    expect(FEATURE_ELIGIBILITY_DEFAULTS.programs).toContain("member");
    expect(FEATURE_ELIGIBILITY_DEFAULTS.ventures).toContain("member");
  });

  test("every creation page is a non-admin route with a real action behind it", () => {
    for (const action of CREATION_ACTIONS) {
      expect(action.href.startsWith("/admin")).toBe(false);
      expect(creationActionForHref(action.href)).toBe(action);
      const page = `src/app${action.href}/page.js`;
      expect(fs.existsSync(path.join(ROOT, page))).toBe(true);
    }
  });
});

describe("creation is an action, not a sidebar section", () => {
  test("no CREATE node in the master navigation or its requirements", () => {
    const ids = [];
    const visit = (items) =>
      (items || []).forEach((item) => {
        ids.push(item.id);
        visit(item.children);
      });
    visit(MASTER_NAVIGATION);
    expect(ids).not.toContain("create_hub");
    expect(NAV_CAPABILITY_REQUIREMENTS.create_hub).toBeUndefined();
  });

  test("the actions are rendered on the dashboards and the list views", () => {
    // Dashboards (the person's own landing) …
    expect(read("src/components/staff/StaffDashboard.js")).toContain("CreateActions");
    expect(read("src/components/dashboard/ParticipantDashboardHome.js")).toContain("CreateActions");
    // … the neutral hub a personal account lands on without a program …
    expect(read("src/app/workspaces/page.js")).toContain("CreateActions");
    // … and the views the records live in.
    expect(read("src/app/pm/programs/page.js")).toContain('only={["program"]}');
    expect(read("src/components/staff/VenturesView.js")).toContain('only={["venture"]}');
    expect(read("src/app/participant/ventures/page.js")).toContain('only={["venture"]}');
  });

  test("the action row is driven by the shared capability catalogue", () => {
    const src = read("src/components/create/CreateActions.js");
    expect(src).toContain("@/lib/creationActions");
    expect(src).toMatch(/can\(action\.module, action\.capability\)/);
  });
});
