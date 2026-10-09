/**
 * AUTHORIZATION DECISIONS (SERVICE layer).
 *
 * The pure decision surface: give it an already-resolved context and it answers
 * without touching a database. That is what makes the permission rules testable
 * on their own, and it is why this module reads no session and no repository.
 *
 * The rules, unchanged:
 *   - Super Admin is DENIED only if explicitly restricted, or downgraded by an
 *     explicit grant below minLevel. Eligibility is bypassed entirely.
 *   - Everyone else is ELIGIBLE (the feature, which fails closed) AND their
 *     effective level >= minLevel.
 *   - `buildPermissionExplanation` reports the identity rows that produced each
 *     eligibility verdict, because "why does this person have access" is a
 *     question an administrator asks with the data in front of them.
 *
 * Split out of `context.js` (560 lines). Behaviour identical.
 */

import { MODULE_TO_FEATURE } from "@/models/authorization/eligibility";
import { evaluateEligibility } from "./eligibility";

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
      // Phase G — the contextual identity the rest of the answer is written
      // against. Super Admin bypasses eligibility and holds no profile.
      contextualProfiles: [],
      accessProfile: ctx.profile || null,
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
    // Phase G — the active contextual profiles this person holds (they feed the
    // eligibility rows above) and the access template they resolve to, so the
    // explanation can answer "which contextual function put them here" beside
    // the raw capability sources.
    contextualProfiles: ctx.profiles || [],
    accessProfile: ctx.profile || null,
  };
}
