/**
 * CONTEXT RESOLUTION (SERVICE layer).
 *
 * Resolves the FULL authorization context for one person, in a fixed small
 * number of waves:
 *
 *   personal grants + blocks
 *   + base capabilities (assigned profile, or the role fallback)
 *   + group capabilities
 *   − explicit restrictions
 *   = effective capabilities, gated by feature eligibility (fails closed)
 *
 * The ordering here is load-bearing and was NOT changed by the split:
 *   - Super Admin resolves through a dedicated early branch that pays only the
 *     grants/restrictions read and bypasses eligibility entirely.
 *   - The identity read is ONE wave of five (grants, restrictions, contact,
 *     effective groups, active profiles); it used to be two waves, costing
 *     every cold resolution an extra round trip for nothing.
 *   - Profile precedence is user override → role default → legacy, with both
 *     lookups run in parallel and the precedence applied to the results.
 *
 * No SQL and no HTTP here: every read goes through
 * `@/models/authorization/contextReads`. Imports the bootstrap by SIBLING path
 * (`./contextBootstrap`), never through the barrel, so this module stays free of
 * a cycle.
 *
 * Split out of `context.js` (560 lines). Behaviour identical.
 */

import { initDb } from "@/lib/db";
import { CAPABILITY_CATALOG } from "@/models/authorization/constants/feature-module-capability";
import { ACCESS_LEVELS } from "@/server/authz/capabilities";
import { MODULE_TO_FEATURE } from "@/models/authorization/eligibility";
import { explainEligibility } from "./eligibility";
import { ensureCapabilityBackfills } from "@/models/authorization/backfill";
import { getEffectiveGroupsForUser } from "./membership";
import {
  getUserCapabilityGrants,
  getUserCapabilityRestrictions,
  getContactAccessProfileAndGroup,
  resolveContactBaseProfile,
  resolveRoleDefaultBaseProfile,
  getBaseCapabilityRows,
  getGroupCapabilityRows,
  getFeatureEligibilityRows,
} from "@/models/authorization/contextReads";
import {
  rowsToCaps,
  rowsToRestrictions,
  mergeEffectiveCapabilities,
} from "./capabilityMerge";
import { ensureEligibilitySeeded } from "./contextBootstrap";
import { listActiveProfileKeys } from "@/models/authorization/profileAssignmentsStore";

/**
 * Étape 2 — the owner through the SAME decision path. Default OFF: the
 * historical bypass stays until the production reference is verified. When the
 * flag is on, the owner is subject to feature eligibility and the account gate
 * like everyone else; its rights still come from the `super_admin_default`
 * profile, so a revoked right denies the owner exactly as it denies anyone else.
 */
export const ownerThroughEngineEnabled = () =>
  process.env.AUTHZ_OWNER_THROUGH_ENGINE === "true";

/**
 * The person's ACTIVE profile keys, fail-soft. A missing registry table reads
 * as "no profile" rather than failing every authorization decision — the table
 * is created by its own screen/route, and until then eligibility behaves as if
 * no profile row existed.
 */
async function safeActiveProfileKeys(cid) {
  try {
    const res = await listActiveProfileKeys(cid);
    return (res?.rows || []).map((row) => String(row.profile_key));
  } catch (error) {
    console.warn(`[Authz] active profile keys unavailable for ${cid}:`, error.message);
    return [];
  }
}

/**
 * Full capability matrix a Super Admin has by default (every module, FULL).
 *
 * Built from the WHOLE catalogue, not `PERMISSION_MODULES`: a `registryOnly`
 * module (`duplicates`, `bulk_upload`) is enforced at the route layer and has no
 * enumerable vocabulary for other profiles, but the platform owner holds it too
 * — and must be able to have it revoked like any other right.
 */
function buildSuperAdminMatrix() {
  const matrix = {};
  for (const [module, definition] of Object.entries(CAPABILITY_CATALOG)) {
    matrix[module] = {};
    for (const capability of Object.keys(definition.capabilities || {})) {
      matrix[module][capability] = ACCESS_LEVELS.FULL;
    }
  }
  return matrix;
}

/**
 * Read the single BASE profile a resolution result names — a PROFILE KEY.
 * Returns null when none answered (a profile-less identity).
 */
export function pickBaseProfile(rows) {
  const list = rows || [];
  const keyed = list.find((row) => row.profile_key);
  if (!keyed) return null;
  return {
    profileKey: String(keyed.profile_key),
    profileId: null,
    profileName: keyed.label || String(keyed.profile_key),
  };
}

// ─── Context resolution ─────────────────────────────────────────────────────

/**
 * Resolve the FULL authorization context for a user in a fixed, small number
 * of queries (all modules + all eligibility in one pass). This is the
 * egress-safe replacement for per-module resolution loops.
 *
 * @param {{cid: string, role?: string, group_name?: string}} user
 */
export async function resolveAuthorizationContext({ cid, role, profiles }) {
  if (!cid) throw new Error("resolveAuthorizationContext: cid is required");
  await initDb();
  // One-time migrations do NOT run here (they are applied on every deployed
  // database — see `oneTimeMigrationsEnabled`). Both calls still exist so the
  // deliberate run (`AUTHZ_RUN_MIGRATIONS=true`) happens before the first
  // decision; otherwise the first one ensures the eligibility TABLE and the
  // second returns immediately.
  await Promise.all([ensureEligibilitySeeded(), ensureCapabilityBackfills()]);

  // Super Admin: eligible everywhere (the bypass for eligibility is preserved),
  // but the RIGHT MATRIX is data too. The default profile's capabilities are the
  // rights, so an administrator can grant or revoke one — including on a Super
  // Admin — from the Permissions screen. A database with no default profile for
  // the role (fresh or legacy) keeps the historical full matrix as a fallback.
  //
  // The role is known before any query, so this branch pays only the
  // grants/restrictions read plus the default profile's capability rows — never
  // the group or eligibility lookups.
  if (role === "super_admin" && !ownerThroughEngineEnabled()) {
    const [grantRows, restrictRows, baseProfileRes] = await Promise.all([
      getUserCapabilityGrants(cid),
      getUserCapabilityRestrictions(cid),
      resolveRoleDefaultBaseProfile(role),
    ]);
    const grants = rowsToCaps(grantRows.rows);
    const restrictions = rowsToRestrictions(restrictRows.rows);
    const basePick = pickBaseProfile(baseProfileRes.rows);
    let saMatrix = buildSuperAdminMatrix();
    if (basePick?.profileKey) {
      // The profile EXISTS: its rows are authoritative, even when empty. Falling
      // back to the full matrix here would make a deliberate revocation
      // impossible to express.
      const capsRes = await getBaseCapabilityRows({ profileKey: basePick.profileKey });
      saMatrix = rowsToCaps(capsRes.rows);
    }
    return {
      cid,
      role,
      isSuperAdmin: true,
      ownerThroughEngine: false,
      // Super Admin bypasses the account gate as well (spec §11 is enforced by
      // the sign-in route for this identity; see BACKLOG for the open point).
      accountStatus: null,
      groups: [],
      profiles: [],
      profile: null,
      eligibility: null,
      eligibilityRows: [],
      // D4 — sections a PROFILE opens despite the role's explicit deny. Super
      // Admin bypasses eligibility, so it can never have a section warning.
      eligibilityWarnings: {},
      baseCaps: saMatrix,
      groupCaps: {},
      effective: mergeEffectiveCapabilities(saMatrix, {}, grants, restrictions),
      grants,
      restrictions,
    };
  }

  // One wave for everything that needs only the identity: the personal grants
  // and blocks, the contact row (profile override + group_name fallback), the
  // effective groups, and the person's ACTIVE profiles (Phase D — the ceilings
  // keyed on a contextual function). These reads are independent of each other.
  const [grantRows, restrictRows, contactRes, groupList, activeProfiles] = await Promise.all([
    getUserCapabilityGrants(cid),
    getUserCapabilityRestrictions(cid),
    getContactAccessProfileAndGroup(cid),
    getEffectiveGroupsForUser(cid),
    // A caller that already read them (the cache layer builds its key from them)
    // passes them in, so the resolver does not repeat the query.
    profiles && Array.isArray(profiles) ? Promise.resolve(profiles) : safeActiveProfileKeys(cid),
  ]);
  const effectiveProfiles = activeProfiles || [];
  const grants = rowsToCaps(grantRows.rows);
  const restrictions = rowsToRestrictions(restrictRows.rows);

  const contact = contactRes.rows[0] || {};
  let groups = groupList;
  if (groups.length === 0 && contact.group_name) groups = [contact.group_name];

  // 2. Profile resolution (V2 order: user override → role default → legacy).
  //    The PROFILE KEY is the only source — the access-profile fallback is gone
  //    with the takeover (docs/PROFILES_TAKEOVER_MIGRATION.md).
  let profileId = null;
  let profileKey = null;
  let profileName = null;
  let profileSource = "none";
  const [overrideRes, roleDefaultRes] = await Promise.all([
    contact.profile_key
      ? resolveContactBaseProfile({ profileKey: contact.profile_key ?? null })
      : Promise.resolve({ rows: [] }),
    role
      ? resolveRoleDefaultBaseProfile(role)
      : Promise.resolve({ rows: [] }),
  ]);
  const overridePick = pickBaseProfile(overrideRes.rows);
  const rolePick = pickBaseProfile(roleDefaultRes.rows);
  if (overridePick) {
    ({ profileKey, profileId, profileName } = overridePick);
    profileSource = "user";
  } else if (rolePick) {
    ({ profileKey, profileId, profileName } = rolePick);
    profileSource = "role";
  }

  // 3+5+6. Base capabilities (the resolved profile's caps — a profile-less
  //    identity has none), group capabilities and eligibility rows are
  //    independent reads — run in parallel instead of three sequential rounds.
  const [capsRes, groupCapsRes, eligRes] = await Promise.all([
    getBaseCapabilityRows({ profileKey }),
    getGroupCapabilityRows(groups),
    getFeatureEligibilityRows(role, groups, effectiveProfiles),
  ]);
  const baseCaps = rowsToCaps(capsRes.rows);
  const groupCaps = rowsToCaps(groupCapsRes.rows);

  // D4 — the eligibility verdict is the UNION of the person's identities. The
  // very same pass records the one divergence the arbitrage flags: a section a
  // PROFILE opens while the ROLE explicitly denies it (a SECTION warning, never
  // a refusal). The verdict and its justification come from one pure function,
  // so they can never drift apart.
  const eligibility = {};
  const eligibilityWarnings = {};
  for (const featureKey of new Set(Object.values(MODULE_TO_FEATURE))) {
    const verdict = explainEligibility(eligRes.rows, featureKey);
    eligibility[featureKey] = verdict.eligible;
    if (verdict.openedByProfile) {
      eligibilityWarnings[featureKey] = "opened_by_profile";
    }
  }

  // 7. Effective capabilities (V2 merge semantics).
  const effective = mergeEffectiveCapabilities(baseCaps, groupCaps, grants, restrictions);

  return {
    cid,
    role,
    isSuperAdmin: role === "super_admin",
    ownerThroughEngine:
      role === "super_admin" && ownerThroughEngineEnabled(),
    // Spec §11 — the account gate: `contacts.status`, read in the same wave as
    // the profile override. `null` when no contact row exists (behaviour kept).
    accountStatus: contact.status ?? null,
    groups,
    profiles: effectiveProfiles,
    profile: { profileId, profileName, profileSource, profileKey },
    eligibility,
    eligibilityWarnings,
    eligibilityRows: eligRes.rows,
    baseCaps,
    groupCaps,
    effective,
    grants,
    restrictions,
  };
}
