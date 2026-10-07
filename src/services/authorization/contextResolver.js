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
  getActiveAccessProfileById,
  getRoleDefaultAccessProfile,
  getBaseCapabilityRows,
  getGroupCapabilityRows,
  getFeatureEligibilityRows,
  getContextEligibilityRoles,
} from "@/models/authorization/contextReads";
import {
  rowsToCaps,
  rowsToRestrictions,
  mergeEffectiveCapabilities,
} from "./capabilityMerge";
import { ensureEligibilitySeeded } from "./contextBootstrap";

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

// ─── Context resolution ─────────────────────────────────────────────────────

/**
 * Resolve the FULL authorization context for a user in a fixed, small number
 * of queries (all modules + all eligibility in one pass). This is the
 * egress-safe replacement for per-module resolution loops.
 *
 * @param {{cid: string, role?: string, group_name?: string}} user
 */
export async function resolveAuthorizationContext({ cid, role }) {
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
  // and blocks, the contact row (profile override + group_name fallback) and the
  // effective groups. These four reads are independent of each other — they used
  // to be two separate waves, which cost every cold resolution an extra round
  // trip (~130ms) for nothing.
  const [grantRows, restrictRows, contactRes, groupList, contextRoleRows] = await Promise.all([
    getUserCapabilityGrants(cid),
    getUserCapabilityRestrictions(cid),
    getContactAccessProfileAndGroup(cid),
    getEffectiveGroupsForUser(cid),
    // The context roles this person holds (venture founder, participant,
    // facilitator…) are eligibility identities too: a founder whose stored role
    // is `facilitator` must still be eligible for the Venture they founded.
    getContextEligibilityRoles(cid),
  ]);
  const contextRoles = (contextRoleRows.rows || [])
    .map((row) => row.role_key)
    .filter(Boolean);
  const grants = rowsToCaps(grantRows.rows);
  const restrictions = rowsToRestrictions(restrictRows.rows);

  const contact = contactRes.rows[0] || {};
  let groups = groupList;
  if (groups.length === 0 && contact.group_name) groups = [contact.group_name];

  // 2. Profile resolution (V2 order: user override → role default → legacy).
  //    Both lookups run in parallel; precedence is applied to the results.
  let profileId = null;
  let profileName = null;
  let profileSource = "legacy";
  const [overrideRes, roleDefaultRes] = await Promise.all([
    contact.access_profile_id
      ? getActiveAccessProfileById(contact.access_profile_id)
      : Promise.resolve({ rows: [] }),
    role
      ? getRoleDefaultAccessProfile(role)
      : Promise.resolve({ rows: [] }),
  ]);
  if (overrideRes.rows[0]) {
    profileId = overrideRes.rows[0].id;
    profileName = overrideRes.rows[0].name;
    profileSource = "user";
  } else if (roleDefaultRes.rows[0]) {
    profileId = roleDefaultRes.rows[0].id;
    profileName = roleDefaultRes.rows[0].name;
    profileSource = "role";
  }

  // 3+5+6. Base capabilities (profile caps, or role_capabilities fallback for
  //    profile-less users — V2 legacy fallback, preserved for zero-loser),
  //    group capabilities and eligibility rows are independent reads — run in
  //    parallel instead of three sequential rounds.
  const [capsRes, groupCapsRes, eligRes] = await Promise.all([
    getBaseCapabilityRows({ profileId, role }),
    getGroupCapabilityRows(groups),
    getFeatureEligibilityRows(role, groups, contextRoles),
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
    profile: { profileId, profileName, profileSource },
    eligibility,
    eligibilityRows: eligRes.rows,
    baseCaps,
    groupCaps,
    effective,
    grants,
    restrictions,
  };
}
