/**
 * The approved prototype centre — the contract the four sections rest on.
 *
 * Locks:
 *   1. Every string the centre renders resolves in ENGLISH AND FRENCH,
 *      including the families built at call time (`source.*`, `risk.*`,
 *      the person's tabs) — a missing one renders the raw key at the user.
 *   2. Health: the gap alert reads `profile_key` (the registry's own column),
 *      and a badge can never claim an alert the Journal does not show.
 *   3. The navigation vocabulary — four doors, their tabs, the person's tabs —
 *      stays in one module shared by the shell and the routes.
 */

const fs = require("fs");
const path = require("path");

const EN = require("@/locales/en/engineering.json");
const FR = require("@/locales/fr/engineering.json");
const {
  computeAlerts,
  journalKpis,
} = require("@/components/permissions/prototype/prototypeAlerts");
const {
  PERSON_TABS,
  PROTOTYPE_SECTIONS,
  PROTOTYPE_TABS,
  firstTab,
  sectionTabs,
} = require("@/components/permissions/prototype/prototypeNav");
const { PERMISSION_NAV } = require("@/components/permissions/permissionNav");

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const resolveKey = (bundle, dotted) =>
  dotted.split(".").reduce((acc, part) => (acc == null ? undefined : acc[part]), bundle);

/** Every literal `t("…")` key the centre's sources ask for. */
function staticKeys() {
  const files = [
    "src/components/permissions/PermissionPrototype.js",
    "src/components/permissions/prototype/prototypeAlerts.js",
    ...fs
      .readdirSync(path.join(process.cwd(), "src/components/permissions/prototype"))
      .filter((name) => name.endsWith(".js"))
      .map((name) => `src/components/permissions/prototype/${name}`),
    ...fs
      .readdirSync(path.join(process.cwd(), "src/components/permissions/prototype/sections"))
      .filter((name) => name.endsWith(".js"))
      .map((name) => `src/components/permissions/prototype/sections/${name}`),
    ...fs
      .readdirSync(path.join(process.cwd(), "src/components/permissions/prototype/drawers"))
      .filter((name) => name.endsWith(".js"))
      .map((name) => `src/components/permissions/prototype/drawers/${name}`),
  ];
  const keys = new Set();
  for (const file of files) {
    const source = read(file);
    for (const match of source.matchAll(/t\(\s*"(engineering\.permissions\.[^"]+)"/g)) {
      keys.add(match[1]);
    }
  }
  return [...keys].sort();
}

/** The key families the sources build with a template literal. */
function dynamicKeys() {
  const namespaces = {
    "engineering.permissions.prototype.source": [
      "direct",
      "group",
      "none",
      "profile",
      "restriction",
    ],
    "engineering.permissions.prototype.risk": ["critical", "high", "normal"],
    "engineering.permissions.prototype.tabs": ["history", "rights", "why"],
    "engineering.permissions.prototype.sections": PROTOTYPE_SECTIONS,
    "engineering.permissions.prototype.intro": PROTOTYPE_SECTIONS,
    "engineering.permissions": [
      "profileBadge_roleDefault",
      "profileBadge_inactive",
      "profileBadge_superAdmin",
    ],
  };
  return Object.entries(namespaces).flatMap(([prefix, suffixes]) =>
    suffixes.map((suffix) => `${prefix}.${suffix}`),
  );
}

describe("the centre's strings exist in both languages", () => {
  test("every literal key resolves in English and French", () => {
    const keys = staticKeys();
    expect(keys.length).toBeGreaterThan(80);
    for (const key of keys) {
      expect(typeof resolveKey(EN, key)).toBe("string");
      expect(typeof resolveKey(FR, key)).toBe("string");
    }
  });

  test("the key families built at call time resolve too", () => {
    for (const key of dynamicKeys()) {
      expect(typeof resolveKey(EN, key)).toBe("string");
      expect(typeof resolveKey(FR, key)).toBe("string");
    }
  });

  test("alert messages carry the parameters their text promises", () => {
    for (const key of ["alerts.deadRights", "alerts.contextGap", "alerts.scopePending"]) {
      expect(resolveKey(EN, `engineering.permissions.prototype.${key}`)).toMatch(/\{/);
      expect(resolveKey(FR, `engineering.permissions.prototype.${key}`)).toMatch(/\{/);
    }
  });
});

describe("health", () => {
  const bundle = (over = {}) => ({
    contacts: [{ cid: "c1", role: "program_manager" }],
    profiles: [{ id: 7, name: "Program Manager" }],
    profileCapsById: { 7: { contacts: { view: {} } } },
    roleDefaults: { program_manager: { profileId: 7 } },
    eligibilityMatrix: { program_manager: { crm: 1 } },
    contextRoles: [],
    moduleToFeature: { contacts: "crm" },
    ...over,
  });

  test("a contextual link with no profile_key is a gap", () => {
    const { alerts, badges } = computeAlerts(
      bundle({ contextRoles: [{ context: "global", role_key: "staff", profile_key: null }] }),
    );
    const gap = alerts.find((alert) => alert.id === "context-role-gaps");
    expect(gap).toBeTruthy();
    expect(gap.params.count).toBe(1);
    expect(gap.section).toBe("profiles");
    expect(badges.profiles).toBe(1);
    // A row carrying a profile is not a gap — the registry's own column.
    expect(
      computeAlerts(
        bundle({ contextRoles: [{ context: "global", role_key: "staff", profile_key: "pm" }] }),
      ).alerts.some((alert) => alert.id === "context-role-gaps"),
    ).toBe(false);
  });

  test("a dead right needs a ceiling that denies it AND someone sitting under it", () => {
    const denied = computeAlerts(bundle({ eligibilityMatrix: { program_manager: { crm: 0 } } }));
    const dead = denied.alerts.find((alert) => alert.id.startsWith("dead-"));
    expect(dead).toBeTruthy();
    expect(dead.key).toBe("engineering.permissions.prototype.alerts.deadRights");
    expect(dead.params).toEqual({ role: "program_manager", feature: "crm", profile: "Program Manager" });
    expect(denied.badges.rules).toBe(denied.alerts.filter((alert) => alert.section === "rules").length);

    // Nobody holds the role → configuration, not an incident.
    const empty = computeAlerts(
      bundle({ contacts: [], eligibilityMatrix: { program_manager: { crm: 0 } } }),
    );
    expect(empty.alerts.some((alert) => alert.id.startsWith("dead-"))).toBe(false);
  });

  test("every badge shown in the nav has a matching alert", () => {
    const { alerts, badges } = computeAlerts(
      bundle({ eligibilityMatrix: { program_manager: { crm: 0 } } }),
    );
    for (const section of PROTOTYPE_SECTIONS) {
      const claimed = alerts.filter((alert) => alert.section === section).length;
      expect(badges[section]).toBe(claimed);
    }
  });

  test("the journal's four numbers come from the bundle", () => {
    const kpis = journalKpis({
      contacts: [
        { role: "super_admin" },
        { role: "staff", invitation_expires_at: new Date(Date.now() + 86400000).toISOString() },
        { role: "staff", invitation_expires_at: "2020-01-01T00:00:00Z" },
      ],
      profiles: [{ id: 1 }, { id: 2 }],
      auditTotal: 42,
    });
    expect(kpis).toEqual({ superAdmins: 1, profiles: 2, changes: 42, expiring: 1 });
  });
});

describe("the navigation vocabulary", () => {
  test("four doors, each with its tabs, and a first tab to open on", () => {
    expect(PROTOTYPE_SECTIONS).toEqual(["people", "profiles", "rules", "journal"]);
    for (const section of PROTOTYPE_SECTIONS) {
      expect(sectionTabs(section)).toEqual(PROTOTYPE_TABS[section]);
      expect(firstTab(section)).toBe(PROTOTYPE_TABS[section][0] || "");
    }
    expect(PROTOTYPE_TABS.journal).toEqual([]);
    expect(PERSON_TABS).toEqual(["rights", "why", "scope", "responsibilities", "history"]);
  });

  test("each door of the real routing maps onto a section", () => {
    const { NAV_KEY_TO_SECTION } = require("@/components/permissions/prototype/prototypeNav");
    const mapped = PERMISSION_NAV.map((item) => NAV_KEY_TO_SECTION[item.key]);
    expect(mapped).toEqual(["people", "profiles", "rules", "journal"]);
  });
});
