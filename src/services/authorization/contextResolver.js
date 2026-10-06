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
 *   - The identity read is ONE wave of four (grants, restrictions, contact,
 *     effective groups); it used to be two waves, costing every cold
 *     resolution an extra round trip for nothing.
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
import { PERMISSION_MODULES, ACCESS_LEVELS } from "@/server/authz/capabilities";
import { MODULE_TO_FEATURE } from "@/models/authorization/eligibility";
import { evaluateEligibility } from "./eligibility";
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

/** Full capability matrix a Super Admin has by default (all modules, FULL). */
function buildSuperAdminMatrix() {
  const matrix = {};
  for (const [module, definition] of Object.entries(PERMISSION_MODULES)) {
    matrix[module] = {};
    for (const capability of definition.capabilities) {
      matrix[module][capability] = ACCESS_LEVELS.FULL;
    }
  }
  return matrix;
}

/**
 * Read the single BASE profile a resolution result names — a PROFILE KEY when
 * the profile-key path answered, else the legacy access profile (id + name).
 * Returns null when neither answered (a profile-less identity).
 *
 * The UNION-ed queries return the profile-key row first, so a database that has
 * both is read through the key (the source of truth from tranche 3 on).
 */
function pickBaseProfile(rows) {
  const list = rows || [];
  const keyed = list.find((row) => row.profile_key);
  if (keyed) {
    return {
      profileKey: String(keyed.profile_key),
      profileId: null,
      profileName: keyed.label || String(keyed.profile_key),
    };
  }
  const legacy = list.find((row) => row.legacy_id !== null && row.legacy_id !== undefined);
  if (legacy) {
    return { profileKey: null, profileId: legacy.legacy_id, profileName: legacy.legacy_name };
  }
  return null;
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
  // Boot-time self-healing (once per process; idempotent). Run in parallel so
  // a cold instance does not pay ~15 sequential round-trips before the first
  // authorization decision (serverless timeout risk on slow databases).
  await Promise.all([ensureEligibilitySeeded(), ensureCapabilityBackfills()]);

  // Super Admin: allowed unless explicitly restricted (V2 L1370-1385).
  // Eligibility is bypassed entirely — SA is eligible for every feature.
  // The role is known before any query, so this branch deliberately pays only
  // the grants/restrictions read and never the profile/group lookups.
  if (role === "super_admin") {
    const [grantRows, restrictRows] = await Promise.all([
      getUserCapabilityGrants(cid),
      getUserCapabilityRestrictions(cid),
    ]);
    const grants = rowsToCaps(grantRows.rows);
    const restrictions = rowsToRestrictions(restrictRows.rows);
    const saMatrix = buildSuperAdminMatrix();
    return {
      cid,
      role,
      isSuperAdmin: true,
      groups: [],
      profiles: [],
      profile: null,
      eligibility: null,
      eligibilityRows: [],
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
  //    Tranche 3: the PROFILE-KEY path wins (docs/PROFILES_TAKEOVER_MIGRATION.md);
  //    the legacy access-profile path is still consulted in the same statement, so
  //    the wave count is unchanged and a template the migration could not map
  //    still resolves.
  let profileId = null;
  let profileKey = null;
  let profileName = null;
  let profileSource = "legacy";
  const [overrideRes, roleDefaultRes] = await Promise.all([
    contact.access_profile_id || contact.profile_key
      ? resolveContactBaseProfile({
          profileKey: contact.profile_key ?? null,
          accessProfileId: contact.access_profile_id ?? null,
        })
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

  // 3+5+6. Base capabilities (profile caps, or role_capabilities fallback for
  //    profile-less users — V2 legacy fallback, preserved for zero-loser),
  //    group capabilities and eligibility rows are independent reads — run in
  //    parallel instead of three sequential rounds.
  const [capsRes, groupCapsRes, eligRes] = await Promise.all([
    getBaseCapabilityRows({ profileId, profileKey, role }),
    getGroupCapabilityRows(groups),
    getFeatureEligibilityRows(role, groups, effectiveProfiles),
  ]);
  const baseCaps = rowsToCaps(capsRes.rows);
  const groupCaps = rowsToCaps(groupCapsRes.rows);

  const eligibility = {};
  for (const featureKey of new Set(Object.values(MODULE_TO_FEATURE))) {
    eligibility[featureKey] = evaluateEligibility(eligRes.rows, featureKey);
  }

  // 7. Effective capabilities (V2 merge semantics).
  const effective = mergeEffectiveCapabilities(baseCaps, groupCaps, grants, restrictions);

  return {
    cid,
    role,
    isSuperAdmin: false,
    groups,
    profiles: effectiveProfiles,
    profile: { profileId, profileName, profileSource, profileKey },
    eligibility,
    eligibilityRows: eligRes.rows,
    baseCaps,
    groupCaps,
    effective,
    grants,
    restrictions,
  };
}
