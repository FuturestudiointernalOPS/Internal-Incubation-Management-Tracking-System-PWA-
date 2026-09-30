/**
 * Authorization — context resolution and decision (SERVICE layer).
 *
 * Answers "may this caller do this, to this?" by combining the raw reads from
 * `@/models/authorization/contextReads` into an effective access picture:
 *
 *   personal grants + blocks
 *   + base capabilities (assigned profile, or the role fallback)
 *   + group capabilities
 *   − explicit restrictions
 *   = effective capabilities, gated by feature eligibility (fails closed)
 *
 * Layer rules (see docs/LAYER_SPLIT.md):
 *  - No SQL here. Every read goes through the repository module next to this
 *    one; this file only shapes rows and decides.
 *  - The decision (`authorize`) is pure: give it a resolved context and it
 *    answers without touching the database. That is what makes the permission
 *    rules testable on their own.
 *
 * Migrated from `src/models/authorization/resolver.js`, which is kept as a
 * re-export facade so existing importers (and the endpoint suites that mock
 * that path) keep working unchanged. Behaviour is identical — only the code
 * moved and the reads were named.
 *
 * NOTE (known, deferred): `requireAuthorization` still builds the refusal
 * response here. Shaping an HTTP answer is controller work; extracting it is
 * tracked in docs/LAYER_SPLIT.md and left out of this first slice so the
 * decision surface is not disturbed.
 */

import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getSession } from "@/server/auth/session";
import { PERMISSION_MODULES, ACCESS_LEVELS } from "@/server/authz/capabilities";
import {
  MODULE_TO_FEATURE,
  ensureEligibilitySchema,
  seedDefaultEligibility,
  seedLmsFeatureEligibility,
  seedVenturesMemberEligibility,
  seedVenturesFounderEligibility,
  seedTemplateCeilingEligibility,
  seedProgramAssignmentEligibility,
} from "@/models/authorization/eligibility";
import { evaluateEligibility } from "./eligibility";
import { ensureCapabilityBackfills } from "@/models/authorization/backfill";
import { runAuthzMigration } from "@/models/authorization/migrations";
import { getEffectiveGroupsForUser } from "./membership";
import {
  dropWorkspaceContext,
  dropAllWorkspaceContexts,
} from "@/lib/workspaceContextCache";
import {
  getUserCapabilityGrants,
  getUserCapabilityRestrictions,
  getContactAccessProfileAndGroup,
  getActiveAccessProfileById,
  getRoleDefaultAccessProfile,
  getBaseCapabilityRows,
  getGroupCapabilityRows,
  getFeatureEligibilityRows,
} from "@/models/authorization/contextReads";

const AUTHZ_CONTEXT_TTL_MS = 60000; // 60s context cache (egress-neutral; invalidated immediately on permission writes)
const _authzContextCache = new Map();
// Contexts currently being resolved, keyed like the cache. A page load issues
// several authorized requests at once; on a cold cache they all miss the check
// above and each would run the same ~6 resolution queries in parallel (observed
// as a burst of identical slow queries). The first caller resolves; the others
// await the same promise.
const _authzContextInflight = new Map();

let eligibilitySeeded = false;
let eligibilitySeedPromise = null;

/** Seed the eligibility table ONCE per database (bootstrap), then stop. */
function ensureEligibilitySeeded() {
  if (!eligibilitySeeded) {
    if (!eligibilitySeedPromise) {
      eligibilitySeedPromise = (async () => {
        await ensureEligibilitySchema();
        await runAuthzMigration(
          "eligibility-bootstrap-seed",
          seedDefaultEligibility,
        );
        // Databases that bootstrapped before the LMS feature existed get the
        // new feature's default rows exactly once (never overwrites edits).
        // v2 re-runs the seed after developer was added to the LMS allowlist
        // (ON CONFLICT DO NOTHING — idempotent, never touches admin edits).
        await runAuthzMigration(
          "eligibility-lms-bootstrap-v2",
          seedLmsFeatureEligibility,
        );
        // Phase 6: member-baseline founders need the ventures feature to be
        // eligible for their baseline identity (the capability alone is not
        // enough — eligibility is checked first and fails closed).
        await runAuthzMigration(
          "eligibility-ventures-member-v1",
          seedVenturesMemberEligibility,
        );
        // Same gap for the founder baseline: `founder` was added to the ventures
        // defaults after this database bootstrapped, so it needs its own
        // catch-up (insert-only, separate marker).
        await runAuthzMigration(
          "eligibility-ventures-founder-v1",
          seedVenturesFounderEligibility,
        );
        // The seeded default templates (Participant Default, Mentor) grant
        // capabilities their own roles had no eligibility row for, which made
        // those templates unsavable from the Permissions UI. Insert-only
        // catch-up for the rows that were never configured on any database that
        // bootstrapped before the two were reconciled.
        await runAuthzMigration(
          "eligibility-template-ceiling-v1",
          seedTemplateCeilingEligibility,
        );
        // Assignment-derived PROGRAM access (facilitator / program manager).
        // Same gap as the ventures/member row above: the ceiling must allow the
        // baseline identities these contextual roles resolve to, or the
        // assignment-derived capability is refused before it is ever read.
        await runAuthzMigration(
          "eligibility-programs-assignment-v1",
          seedProgramAssignmentEligibility,
        );
      })()
        // A one-time seed is DATA work, and the authorization gate awaits this
        // call: a failure is reported and never propagated, so a single missing
        // column cannot turn every gated request into a 500. The migration
        // marker is still unwritten, so the seed does retry on the next boot.
        .catch((error) => {
          console.error(
            "[Authz] one-time eligibility seed failed (not recorded, retried on the next boot):",
            error.message,
          );
        })
        .finally(() => {
          eligibilitySeedPromise = null;
          // Attempted once per process whatever the outcome: leaving this false
          // would re-run the seed and its marker checks on EVERY request.
          eligibilitySeeded = true;
        });
    }
  }
  return eligibilitySeeded ? Promise.resolve() : eligibilitySeedPromise;
}

// ─── Pure helpers (exported for tests) ──────────────────────────────────────

/** Group DB rows [{module, capability, access_level}] into {module:{cap:level}} (max-merge). */
export function rowsToCaps(rows) {
  const capabilities = {};
  for (const row of rows || []) {
    capabilities[row.module] ??= {};
    const level = Number(row.access_level ?? 0);
    if (level > (capabilities[row.module][row.capability] ?? 0)) {
      capabilities[row.module][row.capability] = level;
    }
  }
  return capabilities;
}

/** Group DB rows [{module, capability}] into {module:Set(capabilities)}. */
export function rowsToRestrictions(rows) {
  const restrictions = {};
  for (const row of rows || []) {
    restrictions[row.module] ??= new Set();
    restrictions[row.module].add(row.capability);
  }
  return restrictions;
}

/**
 * JSON projection of a restrictions map (`{module: Set(capability)}`).
 *
 * Restrictions are Sets because merge/authorize iterate them server-side, but a
 * Set does not survive JSON (`JSON.stringify(new Set(["view"]))` is `{}`). A
 * client reading the source layers over the wire would then see NO restriction
 * at all and report a restricted capability as allowed. Project the Sets into
 * the `{module: {capability: true}}` shape the client reads so the wire format
 * and the runtime format agree. Tolerance for the object shape keeps the
 * projection idempotent.
 */
export function restrictionsToJson(restrictions) {
  const output = {};
  for (const [module, capabilities] of Object.entries(restrictions || {})) {
    output[module] = {};
    const capabilityList =
      capabilities instanceof Set
        ? capabilities
        : Object.keys(capabilities || {});
    for (const capability of capabilityList) output[module][capability] = true;
  }
  return output;
}

/**
 * V2 merge semantics: effective = MAX(base, group, grants) − restrictions.
 * Restrictions remove the capability entirely (they never lower it).
 */
export function mergeEffectiveCapabilities(baseCaps, groupCaps, grants, restrictions) {
  const merged = {};
  const add = (sourceCaps) => {
    for (const [module, capabilities] of Object.entries(sourceCaps || {})) {
      merged[module] ??= {};
      for (const [capability, level] of Object.entries(capabilities)) {
        if (level > (merged[module][capability] ?? 0)) merged[module][capability] = level;
      }
    }
  };
  add(baseCaps);
  add(groupCaps);
  add(grants);
  for (const [module, capabilities] of Object.entries(restrictions || {})) {
    if (!merged[module]) continue;
    for (const capability of capabilities) delete merged[module][capability];
  }
  return merged;
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
  const [grantRows, restrictRows, contactRes, groupList] = await Promise.all([
    getUserCapabilityGrants(cid),
    getUserCapabilityRestrictions(cid),
    getContactAccessProfileAndGroup(cid),
    getEffectiveGroupsForUser(cid),
  ]);
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
    getFeatureEligibilityRows(role, groups),
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

/**
 * Cached context accessor — resolve ONCE per user per TTL window and reuse.
 * Compatible with the existing serverless architecture (mirrors the 5s
 * _sessionCache pattern in auth.js, extended to 10s for authorization).
 */
export async function getAuthorizationContext(user) {
  if (!user?.cid) return null;
  const key = `${user.cid}|${user.role || ""}`;
  const cached = _authzContextCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.ctx;

  // Share one resolution between callers that arrive before it completes.
  const inflight = _authzContextInflight.get(key);
  if (inflight) return inflight;

  const pending = resolveAuthorizationContext(user)
    .then((ctx) => {
      _authzContextCache.set(key, { ctx, expires: Date.now() + AUTHZ_CONTEXT_TTL_MS });
      return ctx;
    })
    .finally(() => {
      if (_authzContextInflight.get(key) === pending) {
        _authzContextInflight.delete(key);
      }
    });

  _authzContextInflight.set(key, pending);
  return pending;
}

/**
 * Drop a user's cached context (call after grant/restrict/profile/role writes).
 *
 * The post-login navigation list is derived from the same access facts, so it is
 * dropped here too rather than at its own set of call sites: whoever remembers to
 * drop this one has dropped that one, and a future writer cannot drop one without
 * the other (see src/lib/workspaceContextCache.js).
 */
export function invalidateAuthorizationContext(cid) {
  if (!cid) return;
  for (const key of _authzContextCache.keys()) {
    if (key.startsWith(`${cid}|`)) _authzContextCache.delete(key);
  }
  for (const key of _authzContextInflight.keys()) {
    if (key.startsWith(`${cid}|`)) _authzContextInflight.delete(key);
  }
  dropWorkspaceContext(cid);
}

/**
 * Drop ALL cached contexts (call after eligibility configuration writes — a
 * role/group change can affect any user). The cache is small and short-TTL
 * (10s), so a full clear is egress-safe.
 */
export function invalidateAllAuthorizationContexts() {
  _authzContextCache.clear();
  _authzContextInflight.clear();
  dropAllWorkspaceContexts();
}

// ─── Authorization decision ─────────────────────────────────────────────────

/**
 * Pure decision: "Can this context perform ACTION on FEATURE?"
 *
 * Super Admin: DENY only if explicitly restricted (or downgraded by an
 * explicit grant below minLevel — V2 edge case, preserved).
 * Everyone else: ELIGIBLE (feature) AND effective level >= minLevel.
 */
export function authorize(ctx, module, capability, minLevel = 1) {
  if (!ctx || !module || !capability) return false;

  if (ctx.isSuperAdmin) {
    if (ctx.restrictions?.[module]?.has(capability)) return false;
    const grantLevel = ctx.grants?.[module]?.[capability];
    if (grantLevel !== undefined) return Number(grantLevel) >= minLevel;
    return true;
  }

  const featureKey = MODULE_TO_FEATURE[module];
  if (featureKey && ctx.eligibility?.[featureKey] !== true) return false;
  return Number(ctx.effective?.[module]?.[capability] ?? 0) >= minLevel;
}

/** Effective permission matrix ({module:{capability:level}}) for UI display. */
export function effectivePermissionsFromContext(ctx) {
  return ctx?.effective || {};
}

/**
 * Pure "who has access and why" explanation for a resolved context.
 * Returns per-feature eligibility (with the identity rows that produced it)
 * and the raw capability inputs per module (profile/role base, group caps,
 * individual grants) alongside the merged effective matrix.
 */
export function buildPermissionExplanation(ctx) {
  if (!ctx) return null;

  if (ctx.isSuperAdmin) {
    const eligibility = {};
    for (const featureKey of new Set(Object.values(MODULE_TO_FEATURE))) {
      eligibility[featureKey] = {
        eligible: true,
        source: "super_admin bypass",
      };
    }
    return {
      eligibility,
      sources: {
        profile: ctx.baseCaps || {},
        groups: ctx.groupCaps || {},
        grants: ctx.grants || {},
      },
    };
  }

  const eligibility = {};
  for (const featureKey of new Set(Object.values(MODULE_TO_FEATURE))) {
    const rows = (ctx.eligibilityRows || []).filter(
      (row) => row.feature_key === featureKey,
    );
    eligibility[featureKey] = {
      eligible: evaluateEligibility(rows, featureKey),
      sources: rows.map((row) => ({
        identity_type: row.identity_type,
        identity_value: row.identity_value,
        eligible: Number(row.eligible),
      })),
    };
  }

  return {
    eligibility,
    sources: {
      profile: ctx.baseCaps || {},
      groups: ctx.groupCaps || {},
      grants: ctx.grants || {},
    },
  };
}

/**
 * Convenience: resolve + check in one call (for server components / helpers).
 * Fails closed on any error.
 */
export async function can(user, module, capability, minLevel = 1) {
  try {
    const ctx = await getAuthorizationContext(user);
    return authorize(ctx, module, capability, minLevel);
  } catch (error) {
    console.error("[Authorization] can() error:", error.message);
    return false;
  }
}

/**
 * Route helper — drop-in for requireCapabilityV2, same 401/403 return shape.
 * DB failures surface as 500 (fail-open-to-error) instead of silently 403,
 * avoiding spurious mass-denial during transient Supabase issues.
 */
export async function requireAuthorization(module, capability, minLevel = 1) {
  try {
    const session = await getSession();
    if (!session) {
      logger.debug("authorization_unauthenticated", {
        resourceType: module,
        action: capability,
      });
      return NextResponse.json(
        { success: false, error: "errors.authRequired" },
        { status: 401 },
      );
    }
    const ctx = await getAuthorizationContext(session);
    if (!authorize(ctx, module, capability, minLevel)) {
      // A denial is the security signal worth counting. It records WHO was
      // refused, WHAT they tried and WHY as an enum — never the payload they
      // sent, which is where business data lives.
      logger.warn("authorization_denied", {
        userId: session.cid,
        role: session.role,
        resourceType: module,
        action: capability,
        minLevel,
        reason: "missing_permission",
      });
      return NextResponse.json(
        { success: false, error: "errors.insufficientPermissions" },
        { status: 403 },
      );
    }
    return null;
  } catch (error) {
    logger.error("authorization_error", {
      resourceType: module,
      action: capability,
      error: error.message,
    });
    return NextResponse.json(
      { success: false, error: "errors.authzSystemFailure" },
      { status: 500 },
    );
  }
}
