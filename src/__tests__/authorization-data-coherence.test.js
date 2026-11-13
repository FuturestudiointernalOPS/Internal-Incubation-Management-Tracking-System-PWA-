/**
 * Étape 6 — the authorization DATA agrees with the vocabulary.
 *
 * "Who has what" is data; which roles, profiles, features and rights exist is
 * the code's vocabulary. This suite locks the seam between the two: a renamed
 * capability, a deleted profile or a landing address pointing at a page that no
 * longer exists fails here instead of at sign-in.
 *
 * It runs without a database, so CI can enforce it.
 */

const fs = require("node:fs");
const path = require("node:path");

const {
  FEATURE_ORDER,
  MODULE_TO_FEATURE,
} = require("@/models/authorization/constants/features");
const { CAPABILITY_CATALOG } = require(
  "@/models/authorization/constants/feature-module-capability",
);
const {
  PROFILE_CATALOGUE_SEED,
  ROLE_PROFILE_DEFAULTS_SEED,
  FEATURE_ELIGIBILITY_DEFAULTS,
  FEATURE_ELIGIBILITY_PROFILE_DEFAULTS,
  DELEGATED_PROFILE_CAPABILITY_ROWS,
  VENTURE_PORTFOLIO_CAPABILITY_ROWS,
  VENTURE_MEMBER_EDIT_CAPABILITY,
} = require("@/models/authorization/seedData");
const { LANDING_PRIORITY } = require("@/models/authorization/landingData");
const platformModules = require("@/models/platform/registry").default;
const { ROLE_CATALOG } = require("@/services/authorization/eligibilityAdmin");
const { spaceForRole, SPACE_KEYS, SPACES } = require("@/spaces/registry");

const APP = path.join(process.cwd(), "src", "app");

const PROFILE_KEYS = new Set(PROFILE_CATALOGUE_SEED.map((profile) => profile.key));
const FEATURES = new Set(FEATURE_ORDER);
// Every role the seeds, the config and the platform refer to — the canonical
// list the eligibility admin already publishes.
const IDENTITIES = new Set(ROLE_CATALOG);

/** Every `module.capability` used anywhere, as a readable list of problems. */
function unknownCapability(moduleKey, capability) {
  if (!CAPABILITY_CATALOG[moduleKey]) return `module inconnu: ${moduleKey}`;
  if (!CAPABILITY_CATALOG[moduleKey].capabilities?.[capability]) {
    return `capacité inconnue: ${moduleKey}.${capability}`;
  }
  return null;
}

/** The capability rows of one profile, flattened to `[module, capability]`. */
function profileCapabilities(profile) {
  const rows = [];
  for (const [moduleKey, capabilities] of Object.entries(profile.capabilities || {})) {
    for (const capability of Object.keys(capabilities)) {
      rows.push([moduleKey, capability]);
    }
  }
  return rows;
}

/**
 * Whether an address resolves to a page. Route groups (`(contexts)`) are
 * transparent, and a dynamic segment accepts a literal value.
 */
function pageExists(href) {
  const segments = href.split("/").filter(Boolean);
  const walk = (dir, remaining) => {
    if (remaining.length === 0) return fs.existsSync(path.join(dir, "page.js"));
    if (!fs.existsSync(dir)) return false;
    const [head, ...rest] = remaining;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const child = path.join(dir, entry.name);
      if (/^\(.+\)$/.test(entry.name)) {
        if (walk(child, remaining)) return true;
        continue;
      }
      if (entry.name === head || /^\[.+\]$/.test(entry.name)) {
        if (walk(child, rest)) return true;
      }
    }
    return false;
  };
  return walk(APP, segments);
}

describe("seed data — the profile catalogue", () => {
  test("every profile key is unique and every capability exists", () => {
    const seen = new Set();
    const problems = [];
    for (const profile of PROFILE_CATALOGUE_SEED) {
      if (seen.has(profile.key)) problems.push(`profil dupliqué: ${profile.key}`);
      seen.add(profile.key);
      for (const role of profile.allowedRoles || []) {
        if (!IDENTITIES.has(role)) problems.push(`${profile.key}: rôle inconnu (${role})`);
      }
      if (profile.allCapabilities) continue;
      for (const [moduleKey, capability] of profileCapabilities(profile)) {
        const problem = unknownCapability(moduleKey, capability);
        if (problem) problems.push(`${profile.key}: ${problem}`);
      }
    }
    expect(problems).toEqual([]);
  });

  test("every role → profile default points at a real profile", () => {
    const problems = [];
    for (const [role, profileKey] of Object.entries(ROLE_PROFILE_DEFAULTS_SEED)) {
      if (!IDENTITIES.has(role)) problems.push(`rôle inconnu: ${role}`);
      if (!PROFILE_KEYS.has(profileKey)) {
        problems.push(`${role}: profil inconnu (${profileKey})`);
      }
    }
    expect(problems).toEqual([]);
  });

  test("eligibility rows name real features and real identities", () => {
    const problems = [];
    for (const [featureKey, roles] of Object.entries(FEATURE_ELIGIBILITY_DEFAULTS)) {
      if (!FEATURES.has(featureKey)) problems.push(`fonctionnalité inconnue: ${featureKey}`);
      for (const role of roles) {
        if (!IDENTITIES.has(role)) problems.push(`${featureKey}: rôle inconnu (${role})`);
      }
    }
    for (const [featureKey, profiles] of Object.entries(
      FEATURE_ELIGIBILITY_PROFILE_DEFAULTS,
    )) {
      if (!FEATURES.has(featureKey)) problems.push(`fonctionnalité inconnue: ${featureKey}`);
      for (const profileKey of profiles) {
        if (!PROFILE_KEYS.has(profileKey)) {
          problems.push(`${featureKey}: profil inconnu (${profileKey})`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  test("every delegated capability row names a real profile and right", () => {
    const rows = [
      ...DELEGATED_PROFILE_CAPABILITY_ROWS,
      ...VENTURE_PORTFOLIO_CAPABILITY_ROWS,
      VENTURE_MEMBER_EDIT_CAPABILITY,
    ];
    const problems = [];
    for (const [profileKey, moduleKey, capability] of rows) {
      if (!PROFILE_KEYS.has(profileKey)) problems.push(`profil inconnu: ${profileKey}`);
      const problem = unknownCapability(moduleKey, capability);
      if (problem) problems.push(`${profileKey}: ${problem}`);
    }
    expect(problems).toEqual([]);
  });

  test("every capability module maps to a declared feature", () => {
    const problems = [];
    for (const moduleKey of Object.keys(CAPABILITY_CATALOG)) {
      const featureKey = MODULE_TO_FEATURE[moduleKey];
      if (!featureKey) problems.push(`module sans fonctionnalité: ${moduleKey}`);
      else if (!FEATURES.has(featureKey)) {
        problems.push(`${moduleKey}: fonctionnalité inconnue (${featureKey})`);
      }
    }
    expect(problems).toEqual([]);
  });
});

describe("landing data — every destination is real", () => {
  test("the data file is inert", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src", "models", "authorization", "landingData.js"),
      "utf8",
    );
    expect(source).not.toMatch(/^\s*import\b/m);
    expect(source).not.toMatch(/\brequire\s*\(/);
    expect(source).not.toMatch(/@\/lib\/db|db\.execute|client\.query/);
  });

  test("each entry names a real space, profile, role, relationship and right", () => {
    const problems = [];
    for (const entry of LANDING_PRIORITY) {
      if (entry.space && !SPACE_KEYS.includes(entry.space)) {
        problems.push(`${entry.key}: espace inconnu (${entry.space})`);
      }
      if (entry.role && !spaceForRole(entry.role)) {
        problems.push(`${entry.key}: rôle hors espace (${entry.role})`);
      }
      if (entry.profile && !PROFILE_KEYS.has(entry.profile)) {
        problems.push(`${entry.key}: profil inconnu (${entry.profile})`);
      }
      if (entry.capability) {
        const problem = unknownCapability(
          entry.capability.module,
          entry.capability.capability,
        );
        if (problem) problems.push(`${entry.key}: ${problem}`);
      }
      if (entry.kind && !["team", "owned-venture"].includes(entry.kind)) {
        problems.push(`${entry.key}: destination inconnue (${entry.kind})`);
      }
      if (!entry.href && !entry.kind) {
        problems.push(`${entry.key}: ni adresse ni destination dynamique`);
      }
    }
    expect(problems).toEqual([]);
  });

  test("every static address resolves to a page", () => {
    const dead = LANDING_PRIORITY.filter((entry) => entry.href)
      .map((entry) => entry.href)
      .filter((href) => !pageExists(href));
    expect(dead).toEqual([]);
  });

  test("the neutral fallback of each space exists", () => {
    for (const key of SPACE_KEYS) {
      expect(pageExists(SPACES[key].home)).toBe(true);
    }
  });
});

describe("platform modules — every door names a real right", () => {
  test("each module's capability exists in the catalogue", () => {
    const problems = [];
    for (const entry of platformModules) {
      const capability = entry.capability;
      if (!capability) {
        problems.push(`${entry.id}: aucun droit déclaré`);
        continue;
      }
      const problem = unknownCapability(capability.module, capability.capability);
      if (problem) problems.push(`${entry.id}: ${problem}`);
    }
    expect(problems).toEqual([]);
  });

  test("the CRM support exception is a declared capability", () => {
    expect(CAPABILITY_CATALOG.crm.capabilities.next_action_any).toBeTruthy();
  });

  test("the cross-person task read is a declared capability", () => {
    expect(CAPABILITY_CATALOG.tasks.capabilities.view_all).toBeTruthy();
  });

  test("the tasks act/moderation rights are declared capabilities", () => {
    expect(CAPABILITY_CATALOG.tasks.capabilities.act_any).toBeTruthy();
    expect(CAPABILITY_CATALOG.tasks.capabilities.moderate).toBeTruthy();
  });

  test("the cross-member project read is a declared capability", () => {
    expect(CAPABILITY_CATALOG.projects.capabilities.view_all).toBeTruthy();
  });
});
