/**
 * ImpactOS — Authorization Foundation: ELIGIBILITY ADMINISTRATION (SERVICE)
 *
 * The validation/normalization behind the eligibility configuration API
 * (GET/PUT /api/engineering/permissions/eligibility). Pure except for the two
 * functions that must read the database, which now go through
 * `@/models/authorization/eligibilityAdminReads` (and the shared eligibility-row
 * read in `contextReads`) instead of running SQL here.
 *
 * Semantics:
 *   - eligible = 1  → identity may receive the feature (row upserted)
 *   - eligible = 0  → identity is explicitly denied the feature (row upserted)
 *   - eligible = null → configuration removed (row deleted → fail-closed deny)
 *
 * The resolver consumes exactly these rows — the UI only edits the same
 * configuration the engine enforces.
 *
 * Layer (see docs/LAYER_SPLIT.md): the vocabulary (`FEATURE_KEYS`,
 * `ELIGIBILITY_IDENTITIES`, …) and the validators are decisions and live here.
 * `src/models/authorization/eligibility-admin.js` is a re-export facade, so
 * existing importers and suites are unchanged. This move also removed the last
 * model→service edge: the file no longer sits in `models`.
 */

import { MODULE_TO_FEATURE, FEATURE_ELIGIBILITY_DEFAULTS } from "@/models/authorization/eligibility";
import { FEATURE_ORDER } from "@/models/authorization/eligibility-defaults";
import { PROFILE_KEYS } from "@/models/authorization/profile-catalog";
import { evaluateEligibility } from "./eligibility";
import { getFeatureEligibilityRows } from "@/models/authorization/contextReads";
import {
  getTemplatesGrantingModules,
} from "@/models/authorization/eligibilityAdminReads";
import { listProfileCapabilities } from "@/models/authorization/profileCapabilitiesStore";

const CONFIGURABLE_FEATURES = [
  ...new Set([
    ...Object.values(MODULE_TO_FEATURE),
    ...Object.keys(FEATURE_ELIGIBILITY_DEFAULTS),
  ]),
];

/**
 * Every configurable feature (module-mapped features + seeded features), in the
 * canonical dashboard order. Any unknown/extra feature is appended, sorted, so
 * nothing is ever hidden.
 */
export const FEATURE_KEYS = [
  ...FEATURE_ORDER.filter((feature) => CONFIGURABLE_FEATURES.includes(feature)),
  ...CONFIGURABLE_FEATURES.filter((feature) => !FEATURE_ORDER.includes(feature)).sort(),
];

/**
 * The three identity kinds a ceiling may be written against. `profile`
 * (Phase D) is the contextual function a person HOLDS — distinct from the role
 * on their account — so a rule can say "Member WITH the Founder profile" and
 * distinguish it from a plain Member. It is an eligibility identity, never
 * confused with a role.
 */
export const IDENTITY_TYPES = ["role", "group", "profile"];

/**
 * The agreed eligibility-matrix identities — the ONLY identities the
 * Permission UI shows/configures, split into baseline identities and context
 * roles (see BASELINE_IDENTITIES / CONTEXT_ROLES below). Functions
 * (program_manager, ...) are deliberately NOT eligibility
 * identities — they are profiles/assignments layered on Staff. ROLE_CATALOG
 * remains the full technical catalog (used by the gate-validation tests); this
 * list is the UI-facing subset.
 *
 * The split matters: a person keeps ONE baseline identity and holds context
 * roles additively (Founder of Venture X, Participant in Program A) — the two
 * are different things that happen to share one enforcement table.
 */
/**
 * The baseline identities — the person's relationship with the PLATFORM.
 * If someone stops participating in a program or a venture, this does not
 * change: it is who they are here, not what they are doing here.
 */
export const BASELINE_IDENTITIES = ["super_admin", "staff", "member"];

/**
 * Context roles — what someone IS inside a program, a venture or an investment.
 *
 * They are ceilings too (the engine enforces them the same way), but they must
 * not be mistaken for identities: a person holds them PER CONTEXT, additively,
 * and keeps their baseline identity throughout. Founder = venture membership
 * (venture_own scope), participant = program enrollment, never a platform-wide
 * identity and never an automatic participant surface.
 */
export const CONTEXT_ROLES = [
  "participant",
  "facilitator",
  "investor",
  "founder",
];

/**
 * The agreed eligibility-matrix identities — the ONLY values the Permission UI
 * shows/configures. Functions (program_manager, ...)
 * are deliberately NOT here: they are profiles/assignments layered on Staff.
 * ROLE_CATALOG remains the full technical catalog (gate validation).
 */
export const ELIGIBILITY_IDENTITIES = [
  ...BASELINE_IDENTITIES,
  ...CONTEXT_ROLES,
];

/** The two groups, so the UI can label the matrix honestly (UI-4c). */
export const ELIGIBILITY_IDENTITY_GROUPS = {
  identities: BASELINE_IDENTITIES,
  contextRoles: CONTEXT_ROLES,
};

/** Canonical role catalog: every role referenced by seeds/config plus the
 *  platform role list (teams included via the tasks seed). */
export const ROLE_CATALOG = [
  ...new Set([
    ...Object.values(FEATURE_ELIGIBILITY_DEFAULTS).flat(),
    "super_admin",
    "staff",
    "program_manager",
    "facilitator",
    "participant",
    "member",
    "founder",
    "investor",
    "mentor",
    "finance",
    "team",
    "intern",
    "security_officer",
  ]),
].sort();

/**
 * Validate that a set of template capabilities stays within an eligibility
 * boundary. Eligibility is the HARD ceiling: a default template (access
 * profile) or an individual grant must never grant a capability whose
 * feature the identity is not eligible for.
 *
 * @param {Object} caps  {module: {capability: level}} (template/grants)
 * @param {Object} eligibility  {featureKey: boolean} (from evaluateEligibility)
 * @returns {{valid: boolean, violations: Array<{module, capability, feature}>}}
 *   Unset/missing eligibility rows count as NOT eligible (fail closed).
 */
export function validateCapabilitiesWithinEligibility(caps, eligibility) {
  const violations = [];
  for (const [module, capMap] of Object.entries(caps || {})) {
    const feature = MODULE_TO_FEATURE[module];
    if (!feature) continue; // infra modules without a feature are capability-only
    if (eligibility?.[feature] !== true) {
      for (const capability of Object.keys(capMap || {})) {
        violations.push({ module, capability, feature });
      }
    }
  }
  return { valid: violations.length === 0, violations };
}

/**
 * Validate + normalize an eligibility change batch.
 *
 * @param {Array<{feature_key, identity_type, identity_value, eligible}>} changes
 * @returns {{valid: boolean, errors: string[], normalized: Array}}
 *   normalized entries are {feature_key, identity_type, identity_value, eligible}
 *   where eligible is 0|1|null (null → delete the row).
 */
export function validateEligibilityChanges(changes) {
  const errors = [];
  const normalized = [];
  if (!Array.isArray(changes) || changes.length === 0) {
    return { valid: false, errors: ["no changes"], normalized: [] };
  }
  for (const change of changes) {
    const featureKey = String(change?.feature_key || "");
    const identityType = String(change?.identity_type || "");
    const identityValue = String(change?.identity_value ?? "").trim();
    const eligible = change?.eligible;

    if (!FEATURE_KEYS.includes(featureKey)) {
      errors.push(`unknown feature_key: ${featureKey}`);
      continue;
    }
    if (!IDENTITY_TYPES.includes(identityType)) {
      errors.push(`unknown identity_type: ${identityType}`);
      continue;
    }
    if (!identityValue) {
      errors.push("empty identity_value");
      continue;
    }
    if (identityType === "profile" && !PROFILE_KEYS.includes(identityValue)) {
      errors.push(`unknown profile: ${identityValue}`);
      continue;
    }
    if (eligible !== 0 && eligible !== 1 && eligible !== null) {
      errors.push(`invalid eligible value for ${featureKey}/${identityType}/${identityValue}: ${eligible}`);
      continue;
    }
    normalized.push({ feature_key: featureKey, identity_type: identityType, identity_value: identityValue, eligible });
  }
  return { valid: errors.length === 0 && normalized.length > 0, errors, normalized };
}

/**
 * Server-side enforcement (Phase 2): a profile can never grant capabilities
 * whose feature the target identity is not eligible for. Eligibility is the
 * boundary.
 *
 * The profile is named by its KEY (`profileKey`, the source of truth since the
 * takeover).
 *
 * @param {string} role  the identity role (or the user's role)
 * @param {string[]} groups  the identity's effective groups (or [] for roles)
 * @param {string[]} [profiles]  the identity's ACTIVE profile keys (Phase D)
 * @param {string} [profileKey]  the profile key
 * @returns {{valid: boolean, violations: Array<{module, capability, feature}>}}
 */
export async function assertTemplateCapsEligible({
  role,
  groups = [],
  profiles = [],
  profileKey,
}) {
  const capsRes = profileKey ? await listProfileCapabilities(profileKey) : { rows: [] };
  const caps = {};
  for (const row of capsRes.rows) {
    caps[row.module] ??= {};
    if (Number(row.access_level) > (caps[row.module][row.capability] ?? 0)) {
      caps[row.module][row.capability] = Number(row.access_level);
    }
  }

  const eligRes = await getFeatureEligibilityRows(role, groups, profiles);
  const eligibility = {};
  for (const featureKey of new Set(Object.values(MODULE_TO_FEATURE))) {
    eligibility[featureKey] = evaluateEligibility(eligRes.rows, featureKey);
  }

  return validateCapabilitiesWithinEligibility(caps, eligibility);
}

/**
 * C2 — TEMPLATE IMPACT of an eligibility downgrade.
 *
 * Access-profile templates are role defaults: they store capabilities granted
 * to every contact whose role resolves to the profile. Downgrading a role's
 * eligibility for a feature does NOT touch those stored rows (nothing is ever
 * deleted automatically), so this read-only probe reports which templates still
 * grant capabilities of that feature. The eligibility write uses it to ask for
 * an explicit confirmation before applying the downgrade.
 *
 * @param {string} roleName
 * @param {string} featureKey
 * @returns {Promise<{rows: Array<{id, name, module, capability}>}>}
 */
export async function findTemplatesGrantingFeature(roleName, featureKey) {
  const modules = Object.entries(MODULE_TO_FEATURE)
    .filter(([, feature]) => feature === featureKey)
    .map(([module]) => module);
  if (modules.length === 0) return { rows: [] };

  return getTemplatesGrantingModules(roleName, modules);
}
