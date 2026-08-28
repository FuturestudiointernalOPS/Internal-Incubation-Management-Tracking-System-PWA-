/**
 * ImpactOS — Authorization Foundation: RESOLVER
 *
 * The single canonical authorization resolution path for the new
 * IDENTITY → ELIGIBILITY → CAPABILITY → EFFECTIVE ACCESS model.
 *
 * Design rules (Phase 0):
 * - ADDITIVE: existing V1/V2/role gates are untouched and keep working.
 * - V2 semantics preserved exactly: base = access profile (or role_capabilities
 *   fallback for profile-less users), then MAX-merge group grants and
 *   individual grants, then restrictions REMOVE the capability entirely.
 * - Super Admin: allowed unless explicitly restricted (V2 L1370-1385),
 *   including the edge case where an explicit grant downgrades SA.
 * - Eligibility is separate from capability and fails closed (missing = deny).
 * - Authorization is resolved ONCE per user and reused (short-TTL cache),
 *   avoiding per-capability 7-9 query loops (Shared Pooler egress).
 */

import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession, PERMISSION_MODULES, ACCESS_LEVELS } from "@/lib/auth";
import {
  MODULE_TO_FEATURE,
  ensureEligibilitySchema,
  seedDefaultEligibility,
  evaluateEligibility,
} from "./eligibility";
import { ensureCapabilityBackfills } from "./backfill";
import { runAuthzMigration } from "./migrations";
import { getEffectiveGroupsForUser } from "./membership";

const AUTHZ_CONTEXT_TTL_MS = 10000; // short-TTL context cache (mirrors _sessionCache pattern)
const _authzContextCache = new Map();

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
        eligibilitySeeded = true;
      })().finally(() => {
        eligibilitySeedPromise = null;
      });
    }
  }
  return eligibilitySeeded ? Promise.resolve() : eligibilitySeedPromise;
}

// ─── Pure helpers (exported for tests) ──────────────────────────────────────

/** Group DB rows [{module, capability, access_level}] into {module:{cap:level}} (max-merge). */
export function rowsToCaps(rows) {
  const caps = {};
  for (const r of rows || []) {
    caps[r.module] ??= {};
    const lvl = Number(r.access_level ?? 0);
    if (lvl > (caps[r.module][r.capability] ?? 0)) {
      caps[r.module][r.capability] = lvl;
    }
  }
  return caps;
}

/** Group DB rows [{module, capability}] into {module:Set(capabilities)}. */
export function rowsToRestrictions(rows) {
  const restrictions = {};
  for (const r of rows || []) {
    restrictions[r.module] ??= new Set();
    restrictions[r.module].add(r.capability);
  }
  return restrictions;
}

/**
 * V2 merge semantics: effective = MAX(base, group, grants) − restrictions.
 * Restrictions remove the capability entirely (they never lower it).
 */
export function mergeEffectiveCapabilities(baseCaps, groupCaps, grants, restrictions) {
  const merged = {};
  const add = (src) => {
    for (const [mod, caps] of Object.entries(src || {})) {
      merged[mod] ??= {};
      for (const [cap, lvl] of Object.entries(caps)) {
        if (lvl > (merged[mod][cap] ?? 0)) merged[mod][cap] = lvl;
      }
    }
  };
  add(baseCaps);
  add(groupCaps);
  add(grants);
  for (const [mod, caps] of Object.entries(restrictions || {})) {
    if (!merged[mod]) continue;
    for (const cap of caps) delete merged[mod][cap];
  }
  return merged;
}

/** Full capability matrix a Super Admin has by default (all modules, FULL). */
function buildSuperAdminMatrix() {
  const m = {};
  for (const [mod, def] of Object.entries(PERMISSION_MODULES)) {
    m[mod] = {};
    for (const capability of def.capabilities) {
      m[mod][capability] = ACCESS_LEVELS.FULL;
    }
  }
  return m;
}

// ─── Context resolution ─────────────────────────────────────────────────────

/**
 * Resolve the FULL authorization context for a user in a fixed, small number
 * of queries (all modules + all eligibility in one pass). This is the
 * egress-safe replacement for per-module resolution loops.
 *
 * @param {{cid: string, role?: string, group_name?: string}} user
 */
export async function resolveAuthorizationContext({ cid, role, group_name }) {
  if (!cid) throw new Error("resolveAuthorizationContext: cid is required");
  await initDb();
  // Boot-time self-healing (once per process; idempotent). Run in parallel so
  // a cold instance does not pay ~15 sequential round-trips before the first
  // authorization decision (serverless timeout risk on slow databases).
  await Promise.all([ensureEligibilitySeeded(), ensureCapabilityBackfills()]);

  // Grants + restrictions are needed for every user (SA edge case included).
  const [grantRows, restrictRows] = await Promise.all([
    db.execute({
      sql: `SELECT module, capability, access_level FROM user_capabilities
            WHERE user_cid = ? AND (expires_at IS NULL OR expires_at > NOW())`,
      args: [cid],
    }),
    db.execute({
      sql: `SELECT module, capability FROM user_capability_restrictions
            WHERE user_cid = ? AND (expires_at IS NULL OR expires_at > NOW())`,
      args: [cid],
    }),
  ]);
  const grants = rowsToCaps(grantRows.rows);
  const restrictions = rowsToRestrictions(restrictRows.rows);

  // Super Admin: allowed unless explicitly restricted (V2 L1370-1385).
  // Eligibility is bypassed entirely — SA is eligible for every feature.
  if (role === "super_admin") {
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

  // 1. Contact row (profile override + group_name fallback) + groups —
  //    independent reads, run in parallel.
  const [contactRes, groupList] = await Promise.all([
    db.execute({
      sql: "SELECT access_profile_id, group_name FROM contacts WHERE cid = ?",
      args: [cid],
    }),
    getEffectiveGroupsForUser(cid),
  ]);
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
      ? db.execute({
          sql: "SELECT id, name FROM access_profiles WHERE id = ? AND is_active = 1",
          args: [contact.access_profile_id],
        })
      : Promise.resolve({ rows: [] }),
    role
      ? db.execute({
          sql: `SELECT ap.id, ap.name
                FROM role_access_profile_defaults rpd
                JOIN access_profiles ap ON ap.id = rpd.access_profile_id
                WHERE rpd.role_name = ? AND ap.is_active = 1`,
          args: [role],
        })
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
  const capsSql = profileId
    ? "SELECT module, capability, access_level FROM access_profile_capabilities WHERE profile_id = ?"
    : "SELECT module, capability, access_level FROM role_capabilities WHERE role = ?";
  const groupPh = groups.map(() => "?").join(",");
  const eligPh = groups.length ? groups.map(() => "?").join(",") : "NULL";
  const [capsRes, groupCapsRes, eligRes] = await Promise.all([
    db.execute({ sql: capsSql, args: profileId ? [profileId] : [role] }),
    groups.length > 0
      ? db.execute({
          sql: `SELECT module, capability, access_level FROM group_capabilities
                WHERE group_name IN (${groupPh})`,
          args: groups,
        })
      : Promise.resolve({ rows: [] }),
    db.execute({
      sql: `SELECT feature_key, identity_type, identity_value, eligible
            FROM feature_eligibility
            WHERE (identity_type = 'role' AND identity_value = ?)
               OR (identity_type = 'group' AND identity_value IN (${eligPh}))`,
      args: [role, ...groups],
    }),
  ]);
  const baseCaps = rowsToCaps(capsRes.rows);
  const groupCaps = rowsToCaps(groupCapsRes.rows);

  const eligibility = {};
  for (const featureKey of Object.keys(MODULE_TO_FEATURE)) {
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
  const ctx = await resolveAuthorizationContext(user);
  _authzContextCache.set(key, { ctx, expires: Date.now() + AUTHZ_CONTEXT_TTL_MS });
  return ctx;
}

/** Drop a user's cached context (call after grant/restrict/profile/role writes). */
export function invalidateAuthorizationContext(cid) {
  if (!cid) return;
  for (const key of _authzContextCache.keys()) {
    if (key.startsWith(`${cid}|`)) _authzContextCache.delete(key);
  }
}

/**
 * Drop ALL cached contexts (call after eligibility configuration writes — a
 * role/group change can affect any user). The cache is small and short-TTL
 * (10s), so a full clear is egress-safe.
 */
export function invalidateAllAuthorizationContexts() {
  _authzContextCache.clear();
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
      (r) => r.feature_key === featureKey,
    );
    eligibility[featureKey] = {
      eligible: evaluateEligibility(rows, featureKey),
      sources: rows.map((r) => ({
        identity_type: r.identity_type,
        identity_value: r.identity_value,
        eligible: Number(r.eligible),
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
  } catch (e) {
    console.error("[Authorization] can() error:", e.message);
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
      return NextResponse.json(
        { success: false, error: "errors.authRequired" },
        { status: 401 },
      );
    }
    const ctx = await getAuthorizationContext(session);
    if (!authorize(ctx, module, capability, minLevel)) {
      return NextResponse.json(
        { success: false, error: "errors.insufficientPermissions" },
        { status: 403 },
      );
    }
    return null;
  } catch (e) {
    console.error("[Authorization] requireAuthorization error:", e.message);
    return NextResponse.json(
      { success: false, error: "errors.authzSystemFailure" },
      { status: 500 },
    );
  }
}
